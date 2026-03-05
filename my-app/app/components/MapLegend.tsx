'use client';

import React from 'react';

const MapLegend: React.FC = () => {
  const legendItems = [
    {
      color: '#FF6F00',
      label: 'Howard County Boundary',
      type: 'border',
    },
    {
      color: '#10B981',
      label: 'Bike Lane',
      type: 'line',
      description: 'Dedicated bike lanes on streets'
    },
    {
      color: '#047857',
      label: 'Bike Path/Trail',
      type: 'line',
      description: 'Separate bicycle pathways'
    },
    {
      color: '#34D399',
      label: 'Bike-Friendly Road',
      type: 'line',
      description: 'Recommended cycling routes'
    },
    {
      color: '#F44336',
      label: 'User Request Marker',
      type: 'marker',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
        <span className="mr-2">🗺️</span>
        Map Legend
      </h3>
      <div className="space-y-3">
        {legendItems.map((item, index) => (
          <div key={index}>
            <div className="flex items-start">
              {item.type === 'border' && (
                <div
                  className="w-8 h-6 border-2 rounded mr-3 flex-shrink-0"
                  style={{
                    borderColor: item.color,
                    backgroundColor: `${item.color}20`,
                  }}
                ></div>
              )}
              {item.type === 'line' && (
                <div
                  className="w-8 h-1 rounded mr-3 flex-shrink-0 mt-2"
                  style={{ backgroundColor: item.color }}
                ></div>
              )}
              {item.type === 'marker' && (
                <div className="w-8 h-8 mr-3 flex items-center justify-center flex-shrink-0">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: item.color }}
                  ></div>
                </div>
              )}
              <div className="flex-1">
                <span className="text-sm text-gray-700 font-medium">{item.label}</span>
                {'description' in item && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs font-semibold text-gray-700 mb-2">
          💡 Tips:
        </p>
        <ul className="text-xs text-gray-600 space-y-1.5">
          <li>• Green lines show official Google Maps bikeway data</li>
          <li>• Dark green lines are dedicated bike paths</li>
          <li>• Light green lines are recommended cycling routes</li>
          <li>• Click red markers to view user requests</li>
          <li>• Orange boundary shows Howard County area</li>
        </ul>
      </div>
      
      <div className="mt-3 p-2 bg-blue-50 rounded">
        <p className="text-xs text-blue-800">
          <strong>Data Source:</strong> Google Maps Bicycling Layer
        </p>
      </div>
    </div>
  );
};

export default MapLegend;

