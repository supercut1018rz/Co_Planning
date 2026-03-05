'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db } from '../../lib/firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface InteractivePlanningMapProps {
  generatedSidewalks: any[];
  startPoint?: { lat: number; lng: number } | null; // used to prefill marker form
  selectedSidewalkId?: number | null;
  allSidewalks?: any[];
  onRequestMapClick?: (lat: number, lng: number) => void;
  controlPanelPortalId?: string; // if provided, render control panel into this DOM node
}

const center: [number, number] = [39.2037, -76.8610];

// Map click handler component
function MapClickHandler({ 
  onMapClick
}: { 
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  
  return null;
}

// Map auto-fly-to component
function MapFlyTo({ 
  selectedSidewalk 
}: { 
  selectedSidewalk: any | null;
}) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedSidewalk && selectedSidewalk.geometry) {
      try {
        const coords = selectedSidewalk.geometry.coordinates;
        if (coords && coords.length > 0) {
          // Calculate the center point of the sidewalk
          const lats = coords.map((c: any) => c[1]);
          const lngs = coords.map((c: any) => c[0]);
          const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
          const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
          
          // Fly to this position
          map.flyTo([centerLat, centerLng], 17, {
            duration: 1.5,
            easeLinearity: 0.5
          });
        }
      } catch (error) {
        console.error('Failed to fly to sidewalk:', error);
      }
    }
  }, [selectedSidewalk, map]);
  
  return null;
}

// Create custom icon
const createCustomIcon = (color: string, label: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position: relative;">
        <div style="
          background-color: ${color};
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          border: 3px solid white;
          transform: rotate(-45deg);
          box-shadow: 0 3px 8px rgba(0,0,0,0.4);
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -60%) rotate(45deg);
          color: white;
          font-weight: bold;
          font-size: 14px;
        ">${label}</div>
      </div>
    `,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
  });
};

interface RoadPath {
  id: string;
  coordinates: Array<{ lat: number; lng: number }>;
  type: string;
}

const InteractivePlanningMap: React.FC<InteractivePlanningMapProps> = ({ 
  generatedSidewalks,
  startPoint: externalStart,
  selectedSidewalkId,
  allSidewalks = [],
  onRequestMapClick,
  controlPanelPortalId
}) => {
  const [boundary, setBoundary] = useState<Array<[number, number]>>([]);
  
  // Road network data related state - split into two independent layers
  const [showControlPanel, setShowControlPanel] = useState<boolean>(true);
  
  // First layer: Pedestrian network (lightweight)
  const [showPedNetwork, setShowPedNetwork] = useState<boolean>(true);
  const [pedPaths, setPedPaths] = useState<RoadPath[]>([]);
  const [pedLoading, setPedLoading] = useState<boolean>(false);
  const [pedError, setPedError] = useState<string>('');
  
  // Second layer: Background roads (optional, heavier)
  const [showRoadNetwork, setShowRoadNetwork] = useState<boolean>(false);
  const [roadPaths, setRoadPaths] = useState<RoadPath[]>([]);
  const [roadLoading, setRoadLoading] = useState<boolean>(false);
  const [roadError, setRoadError] = useState<string>('');
  
  // Request marker states (migrated from main map)
  const [markers, setMarkers] = useState<Array<{
    id: string;
    lat: number;
    lng: number;
    description: string;
    image?: string | null;
  }>>([]);
  const [markerForm, setMarkerForm] = useState<{
    lat: string;
    lng: string;
    description: string;
    image?: string | null;
  }>({
    lat: externalStart ? externalStart.lat.toString() : '',
    lng: externalStart ? externalStart.lng.toString() : '',
    description: '',
    image: null,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Street view (Mapillary) related states
  const [streetViewMode, setStreetViewMode] = useState<boolean>(false);
  const [streetViewLocation, setStreetViewLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [streetViewImages, setStreetViewImages] = useState<{ [key: string]: any }>({});
  const [streetViewLoading, setStreetViewLoading] = useState<boolean>(false);
  const [showStreetViewPanel, setShowStreetViewPanel] = useState<boolean>(false);

  // Load markers from Firestore in real time
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let isSubscribed = true;

    const setupListener = async () => {
      try {
        const markersCollection = collection(db, 'markers');
        unsubscribe = onSnapshot(
          markersCollection,
          (snapshot) => {
            if (!isSubscribed) return;
            const data = snapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as any),
            }));
            setMarkers(data);
          },
          (error) => {
            // Ignore abort errors (this is normal cleanup behavior)
            if (error.name !== 'AbortError' && error.code !== 'cancelled') {
              console.error('Failed to load markers from Firestore:', error);
            }
          }
        );
      } catch (error: any) {
        // Ignore abort errors
        if (error.name !== 'AbortError' && error.code !== 'cancelled') {
          console.error('Error setting up marker listener:', error);
        }
      }
    };

    setupListener();

    return () => {
      isSubscribed = false;
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error: any) {
          // Silently ignore cleanup errors
          if (error.name !== 'AbortError' && error.code !== 'cancelled') {
            console.error('Error unsubscribing:', error);
          }
        }
      }
    };
  }, []);

  // Sync start/end points passed from external
  useEffect(() => {
    if (externalStart) {
      setMarkerForm((prev) => ({
        ...prev,
        lat: externalStart.lat.toString(),
        lng: externalStart.lng.toString(),
      }));
    }
  }, [externalStart]);

  // Load Howard County boundary
  useEffect(() => {
    const fetchBoundary = async () => {
      try {
        const response = await fetch(
          'https://nominatim.openstreetmap.org/search?county=Howard&state=Maryland&country=USA&format=json&polygon_geojson=1&limit=1',
          {
            headers: {
              'User-Agent': 'Howard-County-Sidewalk-Map/1.0'
            }
          }
        );

        const data = await response.json();
        
        if (data && data.length > 0 && data[0].geojson) {
          const geojson = data[0].geojson;
          let coordinates: any[] = [];

          if (geojson.type === 'Polygon') {
            coordinates = geojson.coordinates[0];
          } else if (geojson.type === 'MultiPolygon') {
            coordinates = geojson.coordinates[0][0];
          }

          // Keep all boundary points, do not sample (to avoid polygon distortion causing Overpass query to miss data)
          const boundaryPoints: [number, number][] = coordinates
            .map((coord: any) => [coord[1], coord[0]] as [number, number]);
          
          setBoundary(boundaryPoints);
        }
      } catch (error) {
        console.error('Failed to load boundary:', error);
      }
    };

    fetchBoundary();
  }, []);

  // First layer: Load pedestrian network (high priority, lightweight)
  useEffect(() => {
    if (!showPedNetwork || boundary.length === 0) {
      return;
    }

    const fetchPedNetwork = async () => {
      try {
        setPedLoading(true);
        setPedError('');
        
        const polyCoords = boundary
          .map(point => `${point[0]} ${point[1]}`)
          .join(' ');
        
        // Only query pedestrian-related facilities (lightweight)
        const query = `
          [out:json][timeout:60];
          (
            way["highway"="footway"](poly:"${polyCoords}");
            way["highway"="pedestrian"](poly:"${polyCoords}");
            way["highway"="steps"](poly:"${polyCoords}");
            way["highway"="path"]["foot"!="no"](poly:"${polyCoords}");
            way["footway"="sidewalk"](poly:"${polyCoords}");
            way["footway"="crossing"](poly:"${polyCoords}");
            way["highway"="crossing"](poly:"${polyCoords}");
            way["sidewalk"="both"](poly:"${polyCoords}");
            way["sidewalk"="left"](poly:"${polyCoords}");
            way["sidewalk"="right"](poly:"${polyCoords}");
            way["sidewalk"="yes"](poly:"${polyCoords}");
            way["highway"="living_street"](poly:"${polyCoords}");
            way["highway"="cycleway"](poly:"${polyCoords}");
          );
          out geom;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query,
        });

        if (!response.ok) {
          setPedError('Failed to fetch pedestrian network');
          setPedPaths([]);
          return;
        }

        const data = await response.json();
        
        const paths: RoadPath[] = data.elements
          .filter((element: any) => element.type === 'way' && element.geometry && element.geometry.length >= 2)
          .map((element: any) => {
            const coordinates = element.geometry.map((node: any) => ({
              lat: node.lat,
              lng: node.lon,
            }));

            const tags = element.tags || {};
            let type = 'footway';
            
            if (tags.footway === 'crossing' || tags.highway === 'crossing') {
              type = 'crossing';
            } else if (tags.footway === 'sidewalk' || tags.sidewalk) {
              type = 'sidewalk';
            } else if (tags.highway === 'steps') {
              type = 'steps';
            } else if (tags.highway === 'pedestrian' || tags.highway === 'living_street') {
              type = 'pedestrian';
            } else if (tags.highway === 'cycleway') {
              type = 'cycleway';
            }

            return {
              id: element.id.toString(),
              coordinates,
              type,
            };
          });

        setPedPaths(paths);
        console.log(`✅ Loaded ${paths.length} pedestrian network segments`);
      } catch (error: any) {
        console.error('Failed to load pedestrian network:', error);
        setPedError('Failed to fetch pedestrian network');
      } finally {
        setPedLoading(false);
      }
    };

    fetchPedNetwork();
  }, [showPedNetwork, boundary]);

  // Second layer: Load background roads (optional, heavier)
  useEffect(() => {
    if (!showRoadNetwork || boundary.length === 0) {
      return;
    }

    const fetchRoadNetwork = async () => {
      try {
        setRoadLoading(true);
        setRoadError('');
        
        const polyCoords = boundary
          .map(point => `${point[0]} ${point[1]}`)
          .join(' ');
        
        // Only query major roads (reduce load)
        const query = `
          [out:json][timeout:90];
          (
            way["highway"="primary"](poly:"${polyCoords}");
            way["highway"="primary_link"](poly:"${polyCoords}");
            way["highway"="secondary"](poly:"${polyCoords}");
            way["highway"="secondary_link"](poly:"${polyCoords}");
            way["highway"="tertiary"](poly:"${polyCoords}");
            way["highway"="tertiary_link"](poly:"${polyCoords}");
            way["highway"="residential"](poly:"${polyCoords}");
            way["highway"="unclassified"](poly:"${polyCoords}");
          );
          out geom;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query,
        });

        if (!response.ok) {
          setRoadError('Failed to fetch road network');
          setRoadPaths([]);
          return;
        }

        const data = await response.json();
        
        const paths: RoadPath[] = data.elements
          .filter((element: any) => element.type === 'way' && element.geometry && element.geometry.length >= 2)
          .map((element: any) => {
            const coordinates = element.geometry.map((node: any) => ({
              lat: node.lat,
              lng: node.lon,
            }));

            const tags = element.tags || {};
            let type = 'road';
            
            if (tags.highway && ['primary', 'secondary', 'tertiary'].some(t => tags.highway.includes(t))) {
              type = 'major_road';
            }

            return {
              id: element.id.toString(),
              coordinates,
              type,
            };
          });

        setRoadPaths(paths);
        console.log(`✅ Loaded ${paths.length} background road segments`);
      } catch (error: any) {
        console.error('Failed to load background roads:', error);
        setRoadError('Failed to fetch road network');
      } finally {
        setRoadLoading(false);
      }
    };

    fetchRoadNetwork();
  }, [showRoadNetwork, boundary]);

  const handleMapClick = async (lat: number, lng: number) => {
    // If in street view mode, fetch images
    if (streetViewMode) {
      setStreetViewLocation({ lat, lng });
      setShowStreetViewPanel(true);
      setStreetViewLoading(true);
      
      try {
        const response = await fetch(`/api/mapillary-images?lat=${lat}&lng=${lng}`);
        const data = await response.json();
        
        if (data.images) {
          setStreetViewImages(data.images);
        } else {
          setStreetViewImages({});
        }
      } catch (error) {
        console.error('Failed to fetch street view images:', error);
        setStreetViewImages({});
      } finally {
        setStreetViewLoading(false);
      }
      return;
    }

    // Request marker mode: fill form with clicked location
    setMarkerForm((prev) => ({
      ...prev,
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
    }));

    if (onRequestMapClick) {
      onRequestMapClick(lat, lng);
    }
  };

  const handleReset = () => {
    setMarkerForm({
      lat: '',
      lng: '',
      description: '',
      image: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Return color based on road type
  const getRoadColor = (type: string): string => {
    switch (type) {
      case 'crossing':
        return '#FF6B6B';
      case 'sidewalk':
        return '#4ECDC4';
      case 'major_road':
        return '#2E86DE';
      case 'pedestrian':
        return '#10AC84';
      case 'steps':
        return '#EE5A6F';
      case 'footway':
        return '#FF9F43';
      default:
        return '#95A5A6';
    }
  };

  // Return opacity based on road type
  const getRoadOpacity = (type: string): number => {
    switch (type) {
      case 'crossing':
      case 'sidewalk':
        return 0.7;
      case 'major_road':
        return 0.5;
      default:
        return 0.4;
    }
  };

  // Return line width based on road type
  const getRoadWeight = (type: string): number => {
    switch (type) {
      case 'crossing':
        return 3;
      case 'sidewalk':
      case 'pedestrian':
        return 2.5;
      case 'major_road':
        return 3;
      default:
        return 2;
    }
  };

  // Control panel content (can be rendered via Portal or as floating panel)
  const controlPanelContent = (
    <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm w-96">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <span className="mr-2">📍</span> Add Request Marker
        </h3>
        {!controlPanelPortalId && (
          <button
            onClick={() => setShowControlPanel(false)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            title="Hide panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      <p className="text-xs text-gray-600 mb-3">
        Click on the map to select a location, or manually enter coordinates.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs text-gray-700 block mb-1">Latitude</label>
          <input
            type="number"
            value={markerForm.lat}
            onChange={(e) => setMarkerForm((prev) => ({ ...prev, lat: e.target.value }))}
            className="w-full border border-gray-200 rounded px-2 py-2 text-sm"
            placeholder="Latitude"
          />
        </div>
        <div>
          <label className="text-xs text-gray-700 block mb-1">Longitude</label>
          <input
            type="number"
            value={markerForm.lng}
            onChange={(e) => setMarkerForm((prev) => ({ ...prev, lng: e.target.value }))}
            className="w-full border border-gray-200 rounded px-2 py-2 text-sm"
            placeholder="Longitude"
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-gray-700 block mb-1">Description</label>
        <textarea
          value={markerForm.description}
          onChange={(e) => setMarkerForm((prev) => ({ ...prev, description: e.target.value }))}
          className="w-full border border-gray-200 rounded px-2 py-2 text-sm"
          rows={3}
          placeholder="Please describe your request or suggestion..."
        />
      </div>

      <div className="mb-3">
        <label className="text-xs text-gray-700 block mb-1">Upload Image (Optional)</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="w-full text-sm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) {
              setMarkerForm((prev) => ({ ...prev, image: null }));
              return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
              setMarkerForm((prev) => ({ ...prev, image: ev.target?.result as string }));
            };
            reader.readAsDataURL(file);
          }}
        />
      </div>

      <div className="flex space-x-2">
        <button
          onClick={async () => {
            if (!markerForm.lat || !markerForm.lng) {
              alert('Please provide latitude and longitude');
              return;
            }
            const latNum = parseFloat(markerForm.lat);
            const lngNum = parseFloat(markerForm.lng);
            if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
              alert('Please enter valid coordinates');
              return;
            }

            try {
              const markersCollection = collection(db, 'markers');
              await addDoc(markersCollection, {
                lat: latNum,
                lng: lngNum,
                description: markerForm.description || 'No description provided',
                image: markerForm.image || null,
                createdAt: new Date().toISOString(),
              });
              handleReset();
              alert('Marker added');
            } catch (error) {
              console.error('Failed to add marker:', error);
              alert('Failed to add marker, please try again.');
            }
          }}
          className="flex-1 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition-colors font-semibold"
        >
          Submit Marker
        </button>
        <button
          onClick={handleReset}
          className="w-24 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
        {/* First layer: Pedestrian network */}
        <button
          onClick={() => setShowPedNetwork(!showPedNetwork)}
          className={`w-full text-xs py-2 px-3 rounded transition-colors flex items-center justify-center ${
            showPedNetwork 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <span className="mr-2">🚶</span>
          {pedLoading ? 'Loading...' : (showPedNetwork ? 'Hide Pedestrian Network' : 'Show Pedestrian Network')}
          {showPedNetwork && pedPaths.length > 0 && ` (${pedPaths.length})`}
        </button>
        {pedError && (
          <p className="text-xs text-red-600 mt-1 text-center">
            {pedError}
          </p>
        )}

        {/* Second layer: Background roads */}
        <button
          onClick={() => setShowRoadNetwork(!showRoadNetwork)}
          className={`w-full text-xs py-2 px-3 rounded transition-colors flex items-center justify-center ${
            showRoadNetwork 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <span className="mr-2">🛣️</span>
          {roadLoading ? 'Loading...' : (showRoadNetwork ? 'Hide Background Roads' : 'Show Background Roads')}
          {showRoadNetwork && roadPaths.length > 0 && ` (${roadPaths.length})`}
        </button>
        {roadError && (
          <p className="text-xs text-red-600 mt-1 text-center">
            {roadError}
          </p>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <button
          onClick={() => {
            setStreetViewMode(!streetViewMode);
            setShowStreetViewPanel(false);
            setStreetViewImages({});
          }}
          className={`w-full text-xs py-2 px-3 rounded transition-colors flex items-center justify-center ${
            streetViewMode 
              ? 'bg-purple-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <span className="mr-2">📷</span>
          {streetViewMode ? 'Exit Street View Mode' : 'Enable Street View Mode'}
        </button>
        {streetViewMode && (
          <p className="text-xs text-gray-600 mt-1 text-center">
            Click on map to view street images
          </p>
        )}
      </div>

      <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
        <p className="text-xs text-yellow-800">
          💡 Tip: Click on the map to view street images at that location
        </p>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full relative">
      {/* Control panel: Portal renders to external container; floats when not provided */}
      {controlPanelPortalId && typeof document !== 'undefined' && document.getElementById(controlPanelPortalId)
        ? createPortal(controlPanelContent, document.getElementById(controlPanelPortalId) as HTMLElement)
        : (
          showControlPanel ? (
            <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-4 max-w-sm w-96">
              {controlPanelContent}
            </div>
          ) : (
            <button
              onClick={() => setShowControlPanel(true)}
              className="absolute top-4 left-4 z-[1000] bg-white hover:bg-gray-50 rounded-lg shadow-lg p-3 transition-colors"
              title="Show control panel"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )
        )
      }

      {/* Street View Panel (Right Side) */}
      {showStreetViewPanel && (
        <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-4 max-w-md w-96 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-bold text-gray-800">
              📷 Street View
            </h3>
            <button
              onClick={() => {
                setShowStreetViewPanel(false);
                setStreetViewImages({});
              }}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title="Close panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {streetViewLocation && (
            <div className="mb-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
              Location: {streetViewLocation.lat.toFixed(6)}, {streetViewLocation.lng.toFixed(6)}
            </div>
          )}

          {streetViewLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="text-sm text-gray-600 mt-2">Loading street view images...</p>
            </div>
          ) : Object.keys(streetViewImages).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-600">No street view images available at this location</p>
            </div>
          ) : (
            <div className="space-y-4">
              {['N', 'E', 'S', 'W'].map((direction) => {
                const image = streetViewImages[direction];
                if (!image) return null;

                return (
                  <div key={direction} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-800">
                        {direction === 'N' && '🔝 North'}
                        {direction === 'E' && '➡️ East'}
                        {direction === 'S' && '🔻 South'}
                        {direction === 'W' && '⬅️ West'}
                        <span className="ml-2 text-xs text-gray-500">
                          ({image.computed_compass_angle.toFixed(0)}°)
                        </span>
                      </p>
                    </div>
                    <div className="relative bg-gray-100">
                      <img
                        src={image.thumb_1024_url || image.thumb_256_url}
                        alt={`Street view facing ${direction}`}
                        className="w-full h-auto"
                        onError={(e) => {
                          // Fallback if image fails to load
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
                        }}
                      />
                    </div>
                    <div className="p-2 bg-gray-50 text-xs text-gray-600">
                      <a
                        href={`https://www.mapillary.com/app/?lat=${image.lat}&lng=${image.lng}&z=17&pKey=${image.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        View on Mapillary →
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Generated sidewalks statistics */}
      {generatedSidewalks.length > 0 && !showStreetViewPanel && (
        <div className="absolute top-4 right-4 z-[1000] bg-green-500 text-white rounded-lg shadow-lg p-3">
          <p className="text-sm font-bold">✅ Generated Sidewalks</p>
          <p className="text-2xl font-bold text-center">{generatedSidewalks.length}</p>
        </div>
      )}

      {/* Leaflet map */}
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Map click handler */}
        <MapClickHandler 
          onMapClick={handleMapClick}
        />

        {/* Howard County boundary */}
        {boundary.length > 0 && (
          <Polygon
            positions={boundary}
            pathOptions={{
              fillColor: '#FFC107',
              fillOpacity: 0.05,
              color: '#FF6F00',
              weight: 3,
              opacity: 0.8,
            }}
          />
        )}

        {/* Second layer: Background roads (thinner, gray) */}
        {showRoadNetwork && roadPaths.map((road) => {
          const positions: [number, number][] = road.coordinates.map(coord => [coord.lat, coord.lng]);
          if (positions.length < 2) return null;
          
          return (
            <Polyline
              key={`road-${road.id}`}
              positions={positions}
              pathOptions={{
                color: road.type === 'major_road' ? '#666666' : '#999999',
                opacity: 0.3,
                weight: road.type === 'major_road' ? 2 : 1.5,
              }}
            />
          );
        })}

        {/* First layer: Pedestrian network (priority display, vivid colors) */}
        {showPedNetwork && pedPaths.map((path) => {
          const positions: [number, number][] = path.coordinates.map(coord => [coord.lat, coord.lng]);
          if (positions.length < 2) return null;
          
          return (
            <Polyline
              key={`ped-${path.id}`}
              positions={positions}
              pathOptions={{
                color: getRoadColor(path.type),
                opacity: getRoadOpacity(path.type),
                weight: getRoadWeight(path.type),
              }}
            />
          );
        })}

        {/* Request markers */}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold mb-1">📍 Request Marker</p>
                <p className="text-xs text-gray-700 mb-1">
                  {marker.lat.toFixed(6)}, {marker.lng.toFixed(6)}
                </p>
                <p className="text-xs text-gray-800 mb-2">{marker.description}</p>
                {marker.image && (
                  <img
                    src={marker.image}
                    alt="Marker attachment"
                    className="w-full h-auto rounded"
                  />
                )}
                <button
                  onClick={async () => {
                    try {
                      await deleteDoc(doc(db, 'markers', marker.id));
                    } catch (error) {
                      console.error('Failed to delete marker:', error);
                      alert('Failed to delete marker, please try again.');
                    }
                  }}
                  className="mt-2 text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
                >
                  Delete
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Display all sidewalks (with highlight selection support) */}
        {allSidewalks.map((sidewalk) => {
          if (sidewalk.geometry && sidewalk.geometry.type === 'LineString') {
            const positions: [number, number][] = sidewalk.geometry.coordinates.map(
              (coord: number[]) => [coord[1], coord[0]] as [number, number]
            );
            
            // Determine if this is the selected sidewalk
            const isSelected = selectedSidewalkId === sidewalk.properties?.id || selectedSidewalkId === sidewalk.id;
            
            return (
              <Polyline
                key={sidewalk.id || sidewalk.properties?.id}
                positions={positions}
                pathOptions={{
                  color: isSelected ? '#EF4444' : '#9333EA', // Red highlight when selected, bright purple for normal
                  weight: isSelected ? 6 : 4, // Thicker when selected
                  opacity: 1, // No transparency
                  className: isSelected ? 'selected-sidewalk' : ''
                }}
              >
                <Popup>
                  <div>
                    <p className={`font-bold ${isSelected ? 'text-red-600' : 'text-green-600'}`}>
                      {isSelected ? '📍 Selected' : '✅ Sidewalk'}
                    </p>
                    <p className="text-xs">{sidewalk.properties?.name || sidewalk.name}</p>
                    {(sidewalk.properties?.length_m || sidewalk.length_m) && (
                      <p className="text-xs">Length: {(sidewalk.properties?.length_m || sidewalk.length_m)}m</p>
                    )}
                    {(sidewalk.properties?.side || sidewalk.side) && (
                      <p className="text-xs">Side: {(sidewalk.properties?.side || sidewalk.side)}</p>
                    )}
                  </div>
                </Popup>
              </Polyline>
            );
          }
          return null;
        })}
        
        {/* Auto-fly to selected sidewalk */}
        <MapFlyTo 
          selectedSidewalk={allSidewalks.find(
            (sw) => sw.id === selectedSidewalkId || sw.properties?.id === selectedSidewalkId
          )} 
        />
      </MapContainer>
    </div>
  );
};

export default InteractivePlanningMap;

