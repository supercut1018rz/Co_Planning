'use client';

import React, { useState } from 'react';

interface PreciseCoordinateInputProps {
  onSidewalkGenerated: (sidewalk: any) => void;
  scenario?: string;
  initialStart?: Coordinate;
  initialEnd?: Coordinate;
}

interface Coordinate {
  lat: number;
  lng: number;
}

const PreciseCoordinateInput: React.FC<PreciseCoordinateInputProps> = ({ 
  onSidewalkGenerated,
  scenario = 'base',
  initialStart,
  initialEnd
}) => {
  const [startCoord, setStartCoord] = useState<Coordinate>(
    initialStart || { lat: 39.2037, lng: -76.8610 }
  );
  const [endCoord, setEndCoord] = useState<Coordinate>(
    initialEnd || { lat: 39.2050, lng: -76.8590 }
  );

  // Update coordinates when new values are passed from external
  React.useEffect(() => {
    if (initialStart) {
      setStartCoord(initialStart);
    }
  }, [initialStart]);

  React.useEffect(() => {
    if (initialEnd) {
      setEndCoord(initialEnd);
    }
  }, [initialEnd]);
  const [side, setSide] = useState<string>('right');
  const [width, setWidth] = useState<number>(1.5);
  const [offsetDistance, setOffsetDistance] = useState<number>(5);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [roadInfo, setRoadInfo] = useState<any>(null);

  // Handler function to get coordinates from map click
  const handleMapClick = (type: 'start' | 'end', lat: number, lng: number) => {
    if (type === 'start') {
      setStartCoord({ lat, lng });
    } else {
      setEndCoord({ lat, lng });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startCoord.lat || !startCoord.lng || !endCoord.lat || !endCoord.lng) {
      setError('Please enter complete start and end point coordinates');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setRoadInfo(null);

    try {
      console.log('🎯 Generate sidewalk from precise coordinates', { startCoord, endCoord, side, offsetDistance });

      // Call precise coordinate generation API
      const response = await fetch('/api/generate-sidewalk-precise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_lat: startCoord.lat,
          start_lng: startCoord.lng,
          end_lat: endCoord.lat,
          end_lng: endCoord.lng,
          side,
          offset_meters: offsetDistance,
          width_m: width,
          scenario
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Generation failed');
      }

      console.log('✅ Sidewalk generated:', result);
      
      setSuccess(`Sidewalk generated successfully! Length: ${result.length_m?.toFixed(2)}m`);
      setRoadInfo(result.road_info);
      onSidewalkGenerated(result);

    } catch (err: any) {
      console.error('❌ Error:', err);
      setError(err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Quick fill example coordinates
  const fillExampleCoordinates = (example: string) => {
    switch (example) {
      case 'example1':
        setStartCoord({ lat: 39.2037, lng: -76.8610 });
        setEndCoord({ lat: 39.2050, lng: -76.8590 });
        break;
      case 'example2':
        setStartCoord({ lat: 39.2100, lng: -76.8650 });
        setEndCoord({ lat: 39.2120, lng: -76.8630 });
        break;
      case 'example3':
        setStartCoord({ lat: 39.1950, lng: -76.8700 });
        setEndCoord({ lat: 39.1970, lng: -76.8680 });
        break;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
          <span className="mr-2">📍</span>
          Precise Coordinate Input
        </h2>
        <p className="text-sm text-gray-600">
          Enter the exact latitude and longitude coordinates of start and end points. The system will automatically snap to the nearest road and generate a sidewalk
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Start point coordinates */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <label className="block text-sm font-semibold text-blue-800 mb-2">
            🔵 Start Point Coordinates
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Latitude</label>
              <input
                type="number"
                step="0.000001"
                value={startCoord.lat}
                onChange={(e) => setStartCoord({ ...startCoord, lat: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="39.2037"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Longitude</label>
              <input
                type="number"
                step="0.000001"
                value={startCoord.lng}
                onChange={(e) => setStartCoord({ ...startCoord, lng: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="-76.8610"
                required
              />
            </div>
          </div>
        </div>

        {/* End point coordinates */}
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <label className="block text-sm font-semibold text-red-800 mb-2">
            🔴 End Point Coordinates
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Latitude</label>
              <input
                type="number"
                step="0.000001"
                value={endCoord.lat}
                onChange={(e) => setEndCoord({ ...endCoord, lat: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 text-sm"
                placeholder="39.2050"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Longitude</label>
              <input
                type="number"
                step="0.000001"
                value={endCoord.lng}
                onChange={(e) => setEndCoord({ ...endCoord, lng: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 text-sm"
                placeholder="-76.8590"
                required
              />
            </div>
          </div>
        </div>

        {/* Sidewalk parameters */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <label className="block text-sm font-semibold text-gray-800 mb-3">
            ⚙️ Sidewalk Parameters
          </label>
          
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Offset Direction</label>
              <select
                value={side}
                onChange={(e) => setSide(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="right">Right Side</option>
                <option value="left">Left Side</option>
                <option value="both">Both Sides</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs text-gray-600 mb-1">Offset Distance (m)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="20"
                value={offsetDistance}
                onChange={(e) => setOffsetDistance(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs text-gray-600 mb-1">Sidewalk Width (m)</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="5"
                value={width}
                onChange={(e) => setWidth(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Quick fill examples */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            💡 Quick Fill Example Coordinates
          </label>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => fillExampleCoordinates('example1')}
              className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm rounded-md transition-colors"
            >
              Example 1
            </button>
            <button
              type="button"
              onClick={() => fillExampleCoordinates('example2')}
              className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm rounded-md transition-colors"
            >
              Example 2
            </button>
            <button
              type="button"
              onClick={() => fillExampleCoordinates('example3')}
              className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm rounded-md transition-colors"
            >
              Example 3
            </button>
          </div>
        </div>

        {/* Road information display */}
        {roadInfo && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-800 mb-2">
              ✅ Road Captured
            </h4>
            <div className="text-xs text-green-700 space-y-1">
              <div><strong>Road Name:</strong> {roadInfo.name || 'Unnamed Road'}</div>
              <div><strong>Road Type:</strong> {roadInfo.highway}</div>
              <div><strong>Distance from Start:</strong> {roadInfo.start_snap_distance?.toFixed(2)}m</div>
              <div><strong>Distance from End:</strong> {roadInfo.end_snap_distance?.toFixed(2)}m</div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">
              ❌ {error}
            </p>
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700">
              ✅ {success}
            </p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </span>
          ) : (
            '🎯 Generate Sidewalk Precisely'
          )}
        </button>
      </form>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
        <h4 className="text-sm font-semibold text-indigo-800 mb-2">
          📖 Instructions
        </h4>
        <ul className="text-xs text-indigo-700 space-y-1">
          <li>• Enter the exact latitude and longitude coordinates of start and end points</li>
          <li>• System will automatically find the nearest road to these coordinates</li>
          <li>• Generate a sidewalk with specified offset distance on the road between the two points</li>
          <li>• Offset direction: right=road right side, left=road left side</li>
          <li>• Recommended offset distance: 3-8 meters (adjust according to road width)</li>
          <li>• 💡 Tip: You can click on the map to get coordinates (in development)</li>
        </ul>
      </div>
    </div>
  );
};

export default PreciseCoordinateInput;

