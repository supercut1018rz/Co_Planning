'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import NaturalLanguageInput from '../components/NaturalLanguageInput';
import MarkerForm from '../components/MarkerForm';
import SidewalkManager from '../components/SidewalkManager';
import { db } from '../../lib/firebase';
import { collection, addDoc, onSnapshot, deleteDoc, getDocs } from 'firebase/firestore';
import { UserMarker } from '../types';

// Dynamically import map component (avoid SSR issues)
const InteractivePlanningMap = dynamic(() => import('../components/InteractivePlanningMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center bg-gray-100">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading interactive map...</p>
    </div>
  </div>
});

export default function PlanningPage() {
  const [generatedSidewalks, setGeneratedSidewalks] = useState<any[]>([]);
  const [currentScenario, setCurrentScenario] = useState<string>('base');
  const [scenarios, setScenarios] = useState<string[]>(['base', 'plan_a', 'plan_b']);
  const [sidewalkData, setSidewalkData] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [inputMode, setInputMode] = useState<'natural' | 'precise'>('precise');

  // Global error handler: suppress Firebase AbortError (normal behavior in development)
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Check if it's Firebase's AbortError
      const error = event.reason;
      if (
        error?.name === 'AbortError' ||
        error?.code === 'cancelled' ||
        (error?.message && error.message.includes('aborted'))
      ) {
        // This is normal behavior when Firebase listeners are cleaned up, silently ignore
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Selected sidewalk ID (for highlighting and positioning)
  const [selectedSidewalkId, setSelectedSidewalkId] = useState<number | null>(null);
  const [markers, setMarkers] = useState<UserMarker[]>([]);
  const [selectedLat, setSelectedLat] = useState<number>(0);
  const [selectedLng, setSelectedLng] = useState<number>(0);
  const [showMarkerList, setShowMarkerList] = useState<boolean>(false);
  const [showWelcomeCover, setShowWelcomeCover] = useState<boolean>(true);

  const handleSidewalkGenerated = (result: any) => {
    console.log('New sidewalk generated:', result);
    
    // Add to generated sidewalks list
    setGeneratedSidewalks(prev => [...prev, result.geojson]);
    
    // Trigger refresh
    setRefreshKey(prev => prev + 1);
  };


  const handleSidewalkDeleted = () => {
    console.log('🗑️  Sidewalk deleted, refreshing map data');
    // Clear selected state
    setSelectedSidewalkId(null);
    // Reload sidewalk data
    setRefreshKey(prev => prev + 1);
  };

  // Firestore markers
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
            const markersData: UserMarker[] = [];
            snapshot.forEach((doc: any) => {
              markersData.push({
                id: doc.id,
                ...doc.data()
              } as UserMarker);
            });
            setMarkers(markersData);
          },
          (error) => {
            // Ignore abort errors (this is normal cleanup behavior)
            if (error.name !== 'AbortError' && error.code !== 'cancelled') {
              console.error('Error loading markers:', error);
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

  const handleSubmitMarker = async (
    lat: number,
    lng: number,
    description: string,
    image?: string
  ) => {
    try {
      const markersCollection = collection(db, 'markers');
      await addDoc(markersCollection, {
        lat,
        lng,
        description,
        image: image || null,
        createdAt: new Date().toISOString(),
      });
      alert('Marker successfully added to database!');
    } catch (error) {
      console.error('Error adding marker:', error);
      alert('Failed to add marker. Please check Firebase configuration.');
    }
  };

  const handleDeleteMarker = async (markerId: string) => {
    try {
      const markerRef = collection(db, 'markers');
      const snapshot = await getDocs(markerRef);
      const markerDoc = snapshot.docs.find(doc => doc.id === markerId);
      if (markerDoc) {
        await deleteDoc(markerDoc.ref);
        console.log('✅ Marker deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting marker:', error);
      alert('Failed to delete marker. Please try again.');
    }
  };
  
  // Handle sidewalk selection (positioning + highlighting)
  const handleSidewalkSelected = (sidewalk: any) => {
    console.log('📍 Selected sidewalk:', sidewalk);
    setSelectedSidewalkId(sidewalk.id);
  };

  const loadSidewalksForMap = async () => {
    try {
      const response = await fetch(`/api/sidewalks?scenario=${currentScenario}`);
      if (response.ok) {
        const data = await response.json();
        setSidewalkData(data);
      }
    } catch (error) {
      console.error('Failed to load sidewalk data:', error);
    }
  };

  useEffect(() => {
    loadSidewalksForMap();
  }, [currentScenario, refreshKey]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-900">
      {/* Top navigation bar */}
      <nav className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-lg z-20">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-2xl font-bold">🏗️ Howard County Sidewalk Planning System</h1>
              <p className="text-sm text-purple-100">Natural Language Sidewalk Planning</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Scenario switcher */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <label className="text-xs text-purple-100 block mb-1">Current Scenario</label>
              <select
                value={currentScenario}
                onChange={(e) => setCurrentScenario(e.target.value)}
                className="bg-transparent text-white font-semibold border-none focus:outline-none cursor-pointer"
              >
                {scenarios.map((scenario) => (
                  <option key={scenario} value={scenario} className="text-gray-900">
                    {scenario === 'base' ? 'Base Scenario' : scenario}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <p className="text-xs text-purple-100">Generated Sidewalks</p>
              <p className="text-xl font-bold">{generatedSidewalks.length}</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <aside className="w-[450px] bg-white shadow-2xl overflow-y-auto z-10">
          <div className="p-6 space-y-6">
            {/* Requests Map panel container for map control panel (portal target) */}
            <div
              id="requests-map-panel"
              className="mb-4"
            />

            {/* Input mode switch tabs */}
            <div className="flex space-x-2 border-b border-gray-200">
              <button
                onClick={() => setInputMode('natural')}
                className={`flex-1 py-3 px-4 font-semibold transition-colors relative ${
                  inputMode === 'natural'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  Natural Language
                </span>
              </button>
              <button
                onClick={() => setInputMode('precise')}
                className={`flex-1 py-3 px-4 font-semibold transition-colors relative ${
                  inputMode === 'precise'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  Requests Map
                </span>
              </button>
            </div>

            {/* Display different input components based on selected mode */}
            {inputMode === 'natural' ? (
              <NaturalLanguageInput 
                onSidewalkGenerated={handleSidewalkGenerated}
                scenario={currentScenario}
              />
            ) : (
              <div className="space-y-4">
                <MarkerForm
                  onSubmit={handleSubmitMarker}
                  initialLat={selectedLat}
                  initialLng={selectedLng}
                />
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
                  <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Instructions
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2 font-bold">📍</span>
                      <span>Click anywhere on the map to fill Latitude/Longitude</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2 font-bold">✏️</span>
                      <span>Describe your request and optionally upload an image</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2 font-bold">🗺️</span>
                      <span>Markers are stored in Firebase and synced to the map</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
            
            {/* Sidewalk management component */}
            <SidewalkManager 
              scenario={currentScenario}
              onSidewalkDeleted={handleSidewalkDeleted}
              onSidewalkSelected={handleSidewalkSelected}
              selectedSidewalkId={selectedSidewalkId}
            />
            
            {/* System information */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-6 border border-purple-100">
              <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                <span className="mr-2">ℹ️</span>
                System Information
              </h3>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span>Current Scenario:</span>
                  <span className="font-semibold">{currentScenario}</span>
                </div>
                <div className="flex justify-between">
                  <span>Region:</span>
                  <span className="font-semibold">Howard County, MD</span>
                </div>
                <div className="flex justify-between">
                  <span>Data Source:</span>
                  <span className="font-semibold">OpenStreetMap + PostGIS</span>
                </div>
              </div>
            </div>

          </div>
        </aside>

        {/* Interactive map main view */}
        <main className="flex-1 relative">
          <InteractivePlanningMap
            generatedSidewalks={generatedSidewalks}
            selectedSidewalkId={selectedSidewalkId}
            allSidewalks={sidewalkData?.features || []}
            controlPanelPortalId="requests-map-panel"
            onRequestMapClick={(lat, lng) => {
              setSelectedLat(lat);
              setSelectedLng(lng);
            }}
          />
        </main>
      </div>

      {/* Bottom status bar */}
      <div className="bg-gray-800 text-white px-6 py-2 flex justify-between items-center text-xs z-20">
        <div className="flex space-x-4">
          <span>🌍 Projection: WGS84 (EPSG:4326)</span>
          <span>📏 Units: Meters</span>
          <span>🔧 Engine: PostGIS + Turf.js</span>
        </div>
        <div>
          <span className="text-gray-400">Powered by OpenAI GPT-4 + OpenStreetMap</span>
        </div>
      </div>

      {/* Welcome cover: full screen overlay (optimized styling) */}
      {showWelcomeCover && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="min-h-screen w-full bg-gradient-to-br from-[#1f1d47] via-[#272b70] to-[#1f7dd8] flex items-center justify-center p-4 sm:p-8">
            <div className="w-full max-w-5xl bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 sm:p-10 relative overflow-hidden border border-white/40">
              <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-purple-400/20 blur-3xl" />
              <div className="absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
              <div className="relative flex flex-col lg:flex-row gap-10">
                <div className="flex-1 space-y-5">
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold shadow-sm">
                    🚀 Howard County Sidewalk Planning
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight tracking-tight">
                    Welcome to the AI-powered Sidewalk Planning Workspace
                  </h2>
                  <p className="text-gray-700 text-base leading-relaxed">
                    This tool helps planners and community members propose, review, and manage sidewalk requests in Howard County. It combines OpenStreetMap / PostGIS data, AI natural language commands, and an interactive map for precise location work.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-purple-100 bg-white shadow-sm">
                      <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="text-purple-600">✨</span>What you can do
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
                        <li>Add sidewalks with natural language or by map clicks.</li>
                        <li>Snap requests to road network and highlight results.</li>
                        <li>View Mapillary street images around any point.</li>
                        <li>Save request markers to Firebase in real time.</li>
                      </ul>
                    </div>
                    <div className="p-4 rounded-2xl border border-blue-100 bg-white shadow-sm">
                      <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="text-blue-600">🛠️</span>How to operate
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
                        <li>Click map to pick coordinates; form auto-fills Lat/Lng.</li>
                        <li>Use "Generate Sidewalk" to create aligned geometry.</li>
                        <li>Toggle Street View to fetch nearby Mapillary photos.</li>
                        <li>Manage, locate, and delete sidewalks from the list.</li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setShowWelcomeCover(false)}
                      className="px-5 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg transition-transform transform hover:-translate-y-0.5"
                    >
                      Start Planning
                    </button>
                    <button
                      onClick={() => setShowWelcomeCover(false)}
                      className="px-5 py-3 border border-gray-200 hover:border-gray-300 bg-white text-gray-800 rounded-xl font-semibold shadow-sm transition-colors"
                    >
                      Close cover
                    </button>
                  </div>
                </div>
                <div className="w-full lg:w-72 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl text-white p-6 shadow-xl border border-white/20">
                  <h3 className="text-xl font-semibold mb-4">Why it matters</h3>
                  <p className="text-sm text-purple-50/90 mb-4 leading-relaxed">
                    Safer, walkable streets reduce accidents, connect neighborhoods, and support inclusive mobility. Data-driven planning makes requests transparent and actionable.
                  </p>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🛰️</span>
                      <span>GIS-backed alignment</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🤖</span>
                      <span>AI-powered inputs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🗺️</span>
                      <span>Mapillary street images</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">☁️</span>
                      <span>Firebase marker sync</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

