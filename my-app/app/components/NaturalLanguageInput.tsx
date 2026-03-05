'use client';

import React, { useState } from 'react';

interface NaturalLanguageInputProps {
  onSidewalkGenerated: (sidewalk: any) => void;
  scenario?: string;
}

const NaturalLanguageInput: React.FC<NaturalLanguageInputProps> = ({ 
  onSidewalkGenerated,
  scenario = 'base'
}) => {
  const [command, setCommand] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [parsedCommand, setParsedCommand] = useState<any>(null);

  const exampleCommands = [
    'Add a sidewalk along Main Street from Ellicott Mills Drive to Klein Avenue',
    'Add a sidewalk along Court House Drive from Courthhouse Square to Sarahs Lane',
    'Add a sidewalk along Fels Lane',
    'Add a sidewalk along Park Drive'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!command.trim()) {
      setError('Please enter a command');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setParsedCommand(null);

    try {
      // Step 1: Parse natural language command
      console.log('🔍 Parsing command...', command);
      
      const parseResponse = await fetch('/api/parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      if (!parseResponse.ok) {
        // Try to get detailed error information
        let errorMessage = 'Command parsing failed';
        try {
          const errorData = await parseResponse.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If unable to parse error response, use status text
          errorMessage = `Command parsing failed (${parseResponse.status}: ${parseResponse.statusText})`;
        }
        throw new Error(errorMessage);
      }

      const parseResult = await parseResponse.json();
      
      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Command parsing failed');
      }

      console.log('✅ Command parsed:', parseResult.parsed);
      setParsedCommand(parseResult.parsed);

      // Step 2: Generate sidewalk geometry
      console.log('🛣️  Generating sidewalk...');
      
      const generateResponse = await fetch('/api/generate-sidewalk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsed: parseResult.parsed,
          scenario,
          command
        })
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(errorData.error || 'Sidewalk generation failed');
      }

      const generateResult = await generateResponse.json();
      
      if (!generateResult.success) {
        throw new Error(generateResult.error || 'Sidewalk generation failed');
      }

      console.log('✅ Sidewalk generated:', generateResult);
      
      setSuccess(`Sidewalk generated successfully: ${generateResult.sidewalk.name}`);
      onSidewalkGenerated(generateResult);
      
      // Clear input field
      setTimeout(() => {
        setCommand('');
        setSuccess('');
      }, 3000);

    } catch (err: any) {
      console.error('❌ Error:', err);
      setError(err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const setExampleCommand = (example: string) => {
    setCommand(example);
    setError('');
    setSuccess('');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
          <span className="mr-2">🗣️</span>
          Natural Language Planning
        </h2>
        <p className="text-sm text-gray-600">
          Describe the sidewalk you want to add using natural language, and the system will automatically generate road-aligned geometry
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enter Command
          </label>
          <textarea
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Example: Add a sidewalk along Main Street from US-29 to Broken Land Parkway"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
            disabled={loading}
          />
        </div>

        {/* Example commands */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            💡 Example Commands (Click to use)
          </label>
          <div className="grid grid-cols-1 gap-2">
            {exampleCommands.map((example, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setExampleCommand(example)}
                className="text-left text-sm px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-colors"
                disabled={loading}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Parsed command result display */}
        {parsedCommand && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-800 mb-2">
              ✅ Command Parsed
            </h4>
            <div className="text-xs text-green-700 space-y-1">
              <div><strong>Type:</strong> {parsedCommand.feature_type}</div>
              {parsedCommand.street_name && (
                <div><strong>Street:</strong> {parsedCommand.street_name}</div>
              )}
              {parsedCommand.side && (
                <div><strong>Side:</strong> {parsedCommand.side}</div>
              )}
              {parsedCommand.from && (
                <div><strong>From:</strong> {JSON.stringify(parsedCommand.from)}</div>
              )}
              {parsedCommand.to && (
                <div><strong>To:</strong> {JSON.stringify(parsedCommand.to)}</div>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">
              ❌ {error}
            </p>
            {error.includes('not found') && (
              <p className="text-xs text-red-600 mt-2">
                💡 Tip: Please ensure road data is imported. Run command: <code className="bg-red-100 px-1">npm run db:import</code>
              </p>
            )}
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
          disabled={loading || !command.trim()}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
            loading || !command.trim()
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </span>
          ) : (
            '🚀 Generate Sidewalk'
          )}
        </button>
      </form>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">
          📖 Instructions
        </h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Supports English and Chinese command input</li>
          <li>• You can specify street name, side (north/south/east/west/left/right), start and end points</li>
          <li>• System will automatically match roads and generate aligned sidewalk geometry</li>
          <li>• Generated sidewalks will automatically appear on the map</li>
          <li>• Please ensure Howard County road data is imported before first use</li>
        </ul>
      </div>
    </div>
  );
};

export default NaturalLanguageInput;

