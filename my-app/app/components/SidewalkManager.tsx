'use client';

import React, { useState, useEffect } from 'react';

interface Sidewalk {
  id: number;
  name: string;
  side?: string;
  width_m?: number;
  length_m?: string;
  status: string;
  scenario: string;
  created_at: string;
  road_name?: string;
}

interface SidewalkManagerProps {
  scenario: string;
  onSidewalkDeleted?: () => void;
  onSidewalkUpdated?: () => void;
  onSidewalkSelected?: (sidewalk: Sidewalk) => void;
  selectedSidewalkId?: number | null;
}

const SidewalkManager: React.FC<SidewalkManagerProps> = ({
  scenario,
  onSidewalkDeleted,
  onSidewalkUpdated,
  onSidewalkSelected,
  selectedSidewalkId
}) => {
  const [sidewalks, setSidewalks] = useState<Sidewalk[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadSidewalks = async () => {
    setLoading(true);
    setError('');
    
    try {
      const url = `/api/sidewalks?scenario=${scenario}${filterStatus !== 'all' ? `&status=${filterStatus}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to load sidewalk data');
      }
      
      const data = await response.json();
      
      if (data.success) {
        const sidewalkData = data.features.map((feature: any) => ({
          id: feature.id,
          ...feature.properties
        }));
        setSidewalks(sidewalkData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load');
      console.error('Error loading sidewalks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSidewalks();
  }, [scenario, filterStatus]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this sidewalk?')) {
      return;
    }
    
    console.log('🗑️  Starting to delete sidewalk ID:', id);
    
    try {
      const response = await fetch(`/api/sidewalks?id=${id}`, {
        method: 'DELETE'
      });
      
      console.log('📡 DELETE response status:', response.status);
      
      const data = await response.json();
      console.log('📦 DELETE response data:', data);
      
      if (!response.ok || !data.success) {
        const errorMsg = data.error || data.errorDetail || 'Delete failed';
        console.error('❌ Delete failed:', errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log('✅ Delete successful:', data.message);
      alert(`✅ Deleted successfully: ${data.deleted?.name || id}`);
      
      await loadSidewalks();
      onSidewalkDeleted?.();
      
    } catch (err: any) {
      console.error('❌ Error during delete process:', err);
      alert(`❌ Delete failed: ${err.message || 'Unknown error'}\n\nPlease check:\n1. Database connection\n2. Browser console for more errors\n3. Server terminal for error logs`);
    }
  };

  const handleExportGeoJSON = () => {
    const geojson = {
      type: 'FeatureCollection',
      features: sidewalks.map(sw => ({
        type: 'Feature',
        id: sw.id,
        properties: {
          name: sw.name,
          side: sw.side,
          width_m: sw.width_m,
          status: sw.status,
          scenario: sw.scenario,
          road_name: sw.road_name
        },
        geometry: {} // Full geometry needs to be fetched from API in actual use
      }))
    };
    
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `howard-sidewalks-${scenario}-${new Date().toISOString().split('T')[0]}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'existing': return 'bg-green-100 text-green-800';
      case 'proposed': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <span className="mr-2">📋</span>
            Sidewalk Management
          </h2>
          <p className="text-sm text-gray-600">
            Scenario: <span className="font-semibold">{scenario}</span>
          </p>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={loadSidewalks}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:bg-gray-400 font-medium"
          >
            🔄 Refresh
          </button>
          
          {sidewalks.length > 0 && (
            <button
              onClick={handleExportGeoJSON}
              className="px-3 py-1.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors font-medium"
            >
              📥 Export GeoJSON
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex space-x-2">
        <label className="text-sm font-medium text-gray-700 flex items-center">
          Status Filter:
        </label>
        {['all', 'existing', 'proposed', 'approved'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              filterStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {status === 'all' ? 'All' : status}
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">❌ {error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      )}

      {/* Sidewalk list */}
      {!loading && sidewalks.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg">📭 No sidewalk data</p>
          <p className="text-sm mt-2">Use natural language input to generate new sidewalks</p>
        </div>
      )}

      {!loading && sidewalks.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {sidewalks.map((sidewalk) => (
            <div
              key={sidewalk.id}
              onClick={() => onSidewalkSelected?.(sidewalk)}
              className={`border rounded-lg p-4 transition-all cursor-pointer ${
                selectedSidewalkId === sidewalk.id
                  ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-300'
                  : 'border-gray-200 hover:shadow-md hover:border-blue-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedSidewalkId === sidewalk.id && (
                      <span className="text-blue-600 font-bold">📍</span>
                    )}
                    <h3 className="font-semibold text-gray-800">
                      {sidewalk.name}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    {sidewalk.road_name && (
                      <div>
                        <span className="font-medium">Road:</span>
                        {sidewalk.road_name}
                      </div>
                    )}
                    {sidewalk.side && (
                      <div>
                        <span className="font-medium">Side:</span>
                        {sidewalk.side}
                      </div>
                    )}
                    {sidewalk.width_m && (
                      <div>
                        <span className="font-medium">Width:</span>
                        {sidewalk.width_m}m
                      </div>
                    )}
                    {sidewalk.length_m && (
                      <div>
                        <span className="font-medium">Length:</span>
                        {sidewalk.length_m}m
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-2 flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(sidewalk.status)}`}>
                      {sidewalk.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(sidewalk.created_at).toLocaleDateString('en-US')}
                    </span>
                  </div>
                </div>
                
                <div className="ml-4 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering card click
                      onSidewalkSelected?.(sidewalk);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      selectedSidewalkId === sidewalk.id
                        ? 'text-blue-600 bg-blue-100'
                        : 'text-blue-600 hover:bg-blue-50'
                    }`}
                    title="Locate on map"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering card click
                      handleDelete(sidewalk.id);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statistics */}
      {sidewalks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{sidewalks.length}</p>
              <p className="text-xs text-gray-600">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">
                {sidewalks.filter(s => s.status === 'proposed').length}
              </p>
              <p className="text-xs text-gray-600">Proposed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {sidewalks.filter(s => s.status === 'existing' || s.status === 'approved').length}
              </p>
              <p className="text-xs text-gray-600">Existing/Approved</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidewalkManager;

