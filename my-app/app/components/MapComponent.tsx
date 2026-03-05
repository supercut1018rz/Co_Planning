'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { UserMarker } from '../types';

// Fix for default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapComponentProps {
  markers: UserMarker[];
  onMapClick: (lat: number, lng: number) => void;
  onDeleteMarker: (markerId: string) => void;
}

interface SidewalkPath {
  id: string;
  coordinates: Array<{ lat: number; lng: number }>;
  type: string; // 'footway', 'sidewalk', 'street', 'crossing', 'pedestrian', 'steps'
}

// Howard County, Maryland center coordinates
const center: [number, number] = [39.2037, -76.8610];

// Map click handler component
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const MapComponent: React.FC<MapComponentProps> = ({ markers, onMapClick, onDeleteMarker }) => {
  const [selectedMarker, setSelectedMarker] = useState<UserMarker | null>(null);
  const [boundary, setBoundary] = useState<Array<[number, number]>>([]);
  const [boundaryLoading, setBoundaryLoading] = useState<boolean>(true);
  const [boundaryError, setBoundaryError] = useState<string>('');
  
  // Sidewalk related states
  const [sidewalks, setSidewalks] = useState<SidewalkPath[]>([]);
  const [showSidewalks, setShowSidewalks] = useState<boolean>(false);
  const [sidewalksLoading, setSidewalksLoading] = useState<boolean>(false);
  const [legendCollapsed, setLegendCollapsed] = useState<boolean>(false);

  // Fetch Howard County boundary from OpenStreetMap Nominatim API
  useEffect(() => {
    const fetchBoundary = async () => {
      try {
        setBoundaryLoading(true);
        setBoundaryError('');
        
        const response = await fetch(
          'https://nominatim.openstreetmap.org/search?county=Howard&state=Maryland&country=USA&format=json&polygon_geojson=1&limit=1',
          {
            headers: {
              'User-Agent': 'Howard-County-Sidewalk-Map/1.0'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch boundary data');
        }

        const data = await response.json();
        
        if (data && data.length > 0 && data[0].geojson) {
          const geojson = data[0].geojson;
          let coordinates: any[] = [];

          if (geojson.type === 'Polygon') {
            coordinates = geojson.coordinates[0];
          } else if (geojson.type === 'MultiPolygon') {
            coordinates = geojson.coordinates[0][0];
          }

          // Convert [lng, lat] to [lat, lng] for Leaflet
          const boundaryPoints: [number, number][] = coordinates
            .filter((_: any, index: number) => index % 10 === 0)
            .map((coord: any) => [coord[1], coord[0]] as [number, number]);
          
          setBoundary(boundaryPoints);
          console.log(`✅ Successfully loaded Howard County boundary with ${boundaryPoints.length} points`);
        } else {
          throw new Error('Boundary data not found');
        }
      } catch (error: any) {
        console.error('Failed to load boundary:', error);
        setBoundaryError(error.message || 'Failed to load boundary');
        
        // Fallback boundary
        const fallbackBoundary: [number, number][] = [
          [39.3674, -76.9956],
          [39.3658, -76.9567],
          [39.3642, -76.9234],
          [39.3589, -76.8845],
          [39.3512, -76.8456],
          [39.3398, -76.8123],
          [39.3287, -76.7845],
          [39.3156, -76.7567],
          [39.3089, -76.7234],
          [39.3045, -76.6956],
          [39.3023, -76.6678],
          [39.2956, -76.6512],
          [39.2834, -76.6423],
          [39.2678, -76.6389],
          [39.2512, -76.6378],
          [39.2345, -76.6401],
          [39.2189, -76.6456],
          [39.2034, -76.6523],
          [39.1878, -76.6612],
          [39.1723, -76.6734],
          [39.1589, -76.6878],
          [39.1467, -76.7045],
          [39.1367, -76.7234],
          [39.1289, -76.7445],
          [39.1234, -76.7678],
          [39.1189, -76.7912],
          [39.1178, -76.8156],
          [39.1167, -76.8389],
          [39.1156, -76.8623],
          [39.1145, -76.8856],
          [39.1134, -76.9089],
          [39.1123, -76.9323],
          [39.1112, -76.9556],
          [39.1101, -76.9789],
          [39.1112, -77.0012],
          [39.1145, -77.0223],
          [39.1189, -77.0401],
          [39.1256, -77.0545],
          [39.1345, -77.0623],
          [39.1456, -77.0678],
          [39.1589, -77.0712],
          [39.1734, -77.0734],
          [39.1889, -77.0745],
          [39.2045, -77.0734],
          [39.2201, -77.0701],
          [39.2356, -77.0656],
          [39.2512, -77.0589],
          [39.2667, -77.0512],
          [39.2823, -77.0423],
          [39.2978, -77.0323],
          [39.3123, -77.0212],
          [39.3256, -77.0089],
          [39.3378, -76.9967],
          [39.3489, -76.9834],
          [39.3578, -76.9701],
          [39.3645, -76.9567],
          [39.3674, -76.9956],
        ];
        setBoundary(fallbackBoundary);
        console.log('⚠️ Using fallback boundary data');
      } finally {
        setBoundaryLoading(false);
      }
    };

    fetchBoundary();
  }, []);

  // Fetch sidewalk data from OpenStreetMap Overpass API
  useEffect(() => {
    if (!showSidewalks) {
      return;
    }

    if (boundaryLoading || boundary.length === 0) {
      return;
    }

    const fetchSidewalks = async () => {
      try {
        setSidewalksLoading(true);
        
        const polyCoords = boundary
          .map(point => `${point[0]} ${point[1]}`)
          .join(' ');
        
        const query = `
          [out:json][timeout:120];
          (
            way["highway"="footway"](poly:"${polyCoords}");
            way["highway"="pedestrian"](poly:"${polyCoords}");
            way["highway"="steps"](poly:"${polyCoords}");
            way["highway"="path"](poly:"${polyCoords}");
            way["footway"="sidewalk"](poly:"${polyCoords}");
            way["sidewalk"="both"](poly:"${polyCoords}");
            way["sidewalk"="left"](poly:"${polyCoords}");
            way["sidewalk"="right"](poly:"${polyCoords}");
            way["sidewalk"="yes"](poly:"${polyCoords}");
            way["footway"="crossing"](poly:"${polyCoords}");
            way["highway"="crossing"](poly:"${polyCoords}");
            way["highway"="residential"](poly:"${polyCoords}");
            way["highway"="living_street"](poly:"${polyCoords}");
            way["highway"="unclassified"](poly:"${polyCoords}");
            way["highway"="service"](poly:"${polyCoords}");
            way["highway"="tertiary"](poly:"${polyCoords}");
            way["highway"="tertiary_link"](poly:"${polyCoords}");
            way["highway"="secondary"](poly:"${polyCoords}");
            way["highway"="secondary_link"](poly:"${polyCoords}");
            way["highway"="primary"](poly:"${polyCoords}");
            way["highway"="primary_link"](poly:"${polyCoords}");
            way["highway"="road"](poly:"${polyCoords}");
            way["highway"="track"]["foot"!="no"](poly:"${polyCoords}");
            way["highway"="cycleway"](poly:"${polyCoords}");
          );
          out geom;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch sidewalk data');
        }

        const data = await response.json();
        
        const allSidewalkPaths: SidewalkPath[] = data.elements
          .filter((element: any) => {
            // Only show lines (ways), don't show individual nodes
            // This prevents displaying dense crosswalk red dots
            if (element.type === 'way' && element.geometry) return true;
            return false;
          })
          .map((element: any) => {
            let coordinates: Array<{ lat: number; lng: number }> = [];
            
            if (element.type === 'way' && element.geometry) {
              coordinates = element.geometry.map((node: any) => ({
                lat: node.lat,
                lng: node.lon,
              }));
            } else if (element.type === 'node') {
              coordinates = [{ lat: element.lat, lng: element.lon }];
            }

            let type = 'footway';
            const tags = element.tags || {};
            
            if (tags.footway === 'crossing' || tags.highway === 'crossing') {
              type = 'crossing';
            } else if (tags.footway === 'sidewalk' || 
                     tags.sidewalk === 'both' || tags.sidewalk === 'left' || 
                     tags.sidewalk === 'right' || tags.sidewalk === 'yes') {
              type = 'sidewalk';
            } else if (tags.highway === 'steps') {
              type = 'steps';
            } else if (tags.highway === 'pedestrian' || tags.highway === 'living_street') {
              type = 'pedestrian';
            } else if (tags.highway === 'footway' || tags.highway === 'path') {
              type = 'footway';
            } else if (tags.highway === 'primary' || tags.highway === 'primary_link' ||
                     tags.highway === 'secondary' || tags.highway === 'secondary_link' ||
                     tags.highway === 'tertiary' || tags.highway === 'tertiary_link') {
              type = 'street';
            } else if (tags.highway === 'residential' || tags.highway === 'unclassified' || tags.highway === 'road') {
              type = 'street';
            } else if (tags.highway === 'service' || tags.highway === 'track' || tags.highway === 'cycleway') {
              type = 'street';
            }

            return {
              id: element.id.toString(),
              coordinates,
              type,
            };
          })
          .filter((path: SidewalkPath) => path.coordinates.length > 0);

        setSidewalks(allSidewalkPaths);
        console.log(`✅ Loaded ${allSidewalkPaths.length} walkable paths within Howard County boundary`);
      } catch (error: any) {
        console.error('Failed to load sidewalk data:', error);
        alert('Failed to load sidewalk data. Please try again later.');
      } finally {
        setSidewalksLoading(false);
      }
    };

    fetchSidewalks();
  }, [showSidewalks, boundaryLoading, boundary]);

  // Check if point is inside polygon (Ray Casting Algorithm)
  const isPointInPolygon = (point: { lat: number; lng: number }, polygon: Array<[number, number]>): boolean => {
    if (polygon.length === 0) return true;
    
    let inside = false;
    const x = point.lng;
    const y = point.lat;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][1];
      const yi = polygon[i][0];
      const xj = polygon[j][1];
      const yj = polygon[j][0];
      
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    
    return inside;
  };

  // Return color based on sidewalk type
  const getSidewalkColor = (type: string): string => {
    switch (type) {
      case 'crossing':
        return '#FF0000';
      case 'sidewalk':
        return '#4ECDC4';
      case 'street':
        return '#2E86DE';
      case 'pedestrian':
        return '#10AC84';
      case 'steps':
        return '#EE5A6F';
      case 'footway':
        return '#FF9F43';
      default:
        return '#45B7D1';
    }
  };

  const getSidewalkOpacity = (type: string): number => {
    switch (type) {
      case 'crossing':
        return 0.9;
      case 'sidewalk':
        return 0.7;
      case 'street':
        return 0.4;
      case 'pedestrian':
        return 0.7;
      case 'steps':
        return 0.6;
      default:
        return 0.5;
    }
  };

  const getSidewalkWeight = (type: string): number => {
    switch (type) {
      case 'crossing':
        return 3;
      case 'sidewalk':
        return 2.5;
      case 'street':
        return 2;
      case 'pedestrian':
        return 2.5;
      case 'steps':
        return 2;
      default:
        return 2;
    }
  };

  // Create custom marker icon
  const createMarkerIcon = (color: string = 'red') => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        background-color: ${color};
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '600px' }}>
      {/* Sidewalk toggle button */}
      <button
        onClick={() => setShowSidewalks(!showSidewalks)}
        disabled={boundaryLoading}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          backgroundColor: showSidewalks ? '#10AC84' : 'white',
          color: showSidewalks ? 'white' : '#333',
          padding: '12px 20px',
          borderRadius: '8px',
          border: '2px solid #10AC84',
          cursor: boundaryLoading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.3s ease',
          opacity: boundaryLoading ? 0.6 : 1,
        }}
        onMouseOver={(e) => {
          if (!boundaryLoading) {
            e.currentTarget.style.transform = 'scale(1.05)';
          }
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title={boundaryLoading ? 'Waiting for boundary to load...' : ''}
      >
        <span style={{ fontSize: '18px' }}>🚶</span>
        {boundaryLoading ? 'Loading Boundary...' : showSidewalks ? 'Hide Walkable Network' : 'Show Walkable Network'}
        {sidewalksLoading && <span>⏳</span>}
      </button>

      {/* Sidewalk Legend - Collapsible */}
      {showSidewalks && sidewalks.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '10px',
          zIndex: 1000,
          backgroundColor: 'white',
          padding: legendCollapsed ? '10px 12px' : '15px',
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          fontSize: '12px',
          transition: 'all 0.3s ease',
          cursor: legendCollapsed ? 'pointer' : 'default',
        }}
        onClick={() => legendCollapsed && setLegendCollapsed(false)}
        title={legendCollapsed ? 'Click to expand legend' : ''}
        >
          {legendCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🗺️</span>
              <span style={{ fontWeight: 'bold', color: '#000' }}>Legend</span>
              <span style={{ fontSize: '12px', color: '#666' }}>({sidewalks.length})</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: '0', fontWeight: 'bold', color: '#000' }}>
                  Walkable Infrastructure 🗺️
                </h4>
                <button
                  onClick={() => setLegendCollapsed(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    fontSize: '16px',
                    color: '#666',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Collapse legend"
                >
                  ✕
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '30px', height: '3px', backgroundColor: '#FF0000' }}></div>
                  <span style={{ color: '#000' }}>Crosswalk</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '30px', height: '3px', backgroundColor: '#4ECDC4' }}></div>
                  <span style={{ color: '#000' }}>Sidewalk</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '30px', height: '3px', backgroundColor: '#2E86DE' }}></div>
                  <span style={{ color: '#000' }}>Street</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '30px', height: '3px', backgroundColor: '#10AC84' }}></div>
                  <span style={{ color: '#000' }}>Pedestrian Street</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '30px', height: '3px', backgroundColor: '#EE5A6F' }}></div>
                  <span style={{ color: '#000' }}>Steps</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '30px', height: '3px', backgroundColor: '#FF9F43' }}></div>
                  <span style={{ color: '#000' }}>Footway</span>
                </div>
              </div>
              <div style={{ 
                margin: '10px 0 0 0', 
                padding: '8px', 
                backgroundColor: '#f0f9ff', 
                borderRadius: '4px',
                borderLeft: '3px solid #10AC84'
              }}>
                <p style={{ margin: '0', fontSize: '11px', color: '#000', fontWeight: 'bold' }}>
                  📍 Complete Walkable Network
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#555' }}>
                  All streets, paths & pedestrian infrastructure
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#000' }}>
                  Total: {sidewalks.length} paths
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* OpenStreetMap with Leaflet */}
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapClickHandler onMapClick={onMapClick} />

        {/* Howard County boundary */}
        {!boundaryLoading && boundary.length > 0 && (
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

        {/* Boundary loading indicator */}
        {boundaryLoading && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '10px 20px',
            borderRadius: '5px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            zIndex: 1000
          }}>
            🔄 Loading Howard County boundary...
          </div>
        )}

        {/* Walkable infrastructure rendering - only show lines, not nodes */}
        {showSidewalks && sidewalks.map((sidewalk) => {
          const positions: [number, number][] = sidewalk.coordinates.map(coord => [coord.lat, coord.lng]);
          
          // Only render lines (at least 2 points), don't render individual nodes
          if (positions.length < 2) {
            return null;
          }
          
          // Render as line
          return (
            <Polyline
              key={sidewalk.id}
              positions={positions}
              pathOptions={{
                color: getSidewalkColor(sidewalk.type),
                opacity: getSidewalkOpacity(sidewalk.type),
                weight: getSidewalkWeight(sidewalk.type),
              }}
            />
          );
        })}

        {/* User markers */}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={createMarkerIcon('#ef4444')}
            eventHandlers={{
              click: () => setSelectedMarker(marker),
            }}
          >
            {selectedMarker?.id === marker.id && (
              <Popup>
                <div style={{ maxWidth: '250px', position: 'relative' }}>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this marker?')) {
                        onDeleteMarker(selectedMarker.id);
                        setSelectedMarker(null);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-5px',
                      width: '24px',
                      height: '24px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      zIndex: 1,
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                    title="Delete this marker"
                  >
                    ✕
                  </button>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold', color: '#000000' }}>
                    📍 User Request
                  </h3>
                  <p style={{ margin: '5px 0', fontSize: '14px', color: '#000000' }}>
                    <strong style={{ color: '#000000' }}>Location:</strong>
                    <br />
                    Latitude: {selectedMarker.lat.toFixed(6)}
                    <br />
                    Longitude: {selectedMarker.lng.toFixed(6)}
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '14px', color: '#000000' }}>
                    <strong style={{ color: '#000000' }}>Description:</strong>
                    <br />
                    {selectedMarker.description}
                  </p>
                  {selectedMarker.image && (
                    <div style={{ marginTop: '10px' }}>
                      <img
                        src={selectedMarker.image}
                        alt="User uploaded"
                        style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                    </div>
                  )}
                  <p style={{ margin: '5px 0', fontSize: '12px', color: '#000000' }}>
                    Created: {new Date(selectedMarker.createdAt).toLocaleString('en-US')}
                  </p>
                </div>
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
