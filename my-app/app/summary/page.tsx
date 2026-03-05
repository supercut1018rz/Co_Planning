'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { UserMarker } from '../types';

export default function SummaryPage() {
  const [markers, setMarkers] = useState<UserMarker[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Load all marker data
  useEffect(() => {
    const loadMarkers = async () => {
      try {
        const markersCollection = collection(db, 'markers');
        const snapshot = await getDocs(markersCollection);
        const markersData: UserMarker[] = [];
        snapshot.forEach((doc: any) => {
          markersData.push({
            id: doc.id,
            ...doc.data()
          } as UserMarker);
        });
        setMarkers(markersData);
      } catch (error) {
        console.error('Error loading markers:', error);
        setError('Failed to load markers from database');
      }
    };

    loadMarkers();
  }, []);

  // Call AI analysis
  const handleAnalyze = async () => {
    if (markers.length === 0) {
      setError('No markers to analyze');
      return;
    }

    setLoading(true);
    setError('');
    setSummary('');

    try {
      const response = await fetch('/api/analyze-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markers }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze feedback');
      }

      const data = await response.json();
      setSummary(data.summary);
    } catch (error) {
      console.error('Error analyzing feedback:', error);
      setError('Failed to generate AI summary. Please check your OpenAI API configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Top navigation */}
      <nav className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => window.location.href = '/'}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Back to Map"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold">🤖 AI Feedback Summary</h1>
              <p className="text-sm text-blue-100">Analyzing {markers.length} user feedback markers</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Statistics cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-200">Total Feedback</p>
                  <p className="text-3xl font-bold">{markers.length}</p>
                </div>
                <svg className="w-12 h-12 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-200">With Images</p>
                  <p className="text-3xl font-bold">{markers.filter(m => m.image).length}</p>
                </div>
                <svg className="w-12 h-12 text-purple-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-pink-200">Latest Entry</p>
                  <p className="text-sm font-bold">
                    {markers.length > 0 
                      ? new Date(markers[markers.length - 1].createdAt).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <svg className="w-12 h-12 text-pink-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          {/* Analysis button */}
          <div className="bg-white rounded-lg shadow-2xl p-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Generate AI Analysis</h2>
              <p className="text-gray-600">
                Click the button below to analyze all user feedback using GPT-4o
              </p>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={loading || markers.length === 0}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-4 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-3 text-lg font-semibold"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Analyzing with AI...</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>Analyze Feedback with AI</span>
                </>
              )}
            </button>

            {markers.length === 0 && (
              <p className="text-center text-gray-500 mt-4">
                No feedback markers available. Please add some markers first.
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
              <div className="flex items-center">
                <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* AI analysis results */}
          {summary && (
            <div className="bg-white rounded-lg shadow-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <svg className="w-8 h-8 mr-3 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
                AI Analysis Results
              </h3>
              <div className="prose prose-lg max-w-none">
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {summary}
                </div>
              </div>
            </div>
          )}

          {/* Raw data preview */}
          {markers.length > 0 && (
            <div className="bg-white rounded-lg shadow-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Raw Feedback Data</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {markers.map((marker, index) => (
                  <div key={marker.id} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded">
                    <p className="text-sm text-gray-500">#{index + 1} - {new Date(marker.createdAt).toLocaleString()}</p>
                    <p className="text-gray-800 font-medium">{marker.description}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Location: {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

