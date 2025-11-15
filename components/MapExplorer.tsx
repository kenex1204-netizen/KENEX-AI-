import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { GroundingChunk } from '@google/genai';
import MapIcon from './icons/MapIcon';

// Since `marked` is loaded via a script tag, we declare it on the window object
declare global {
  interface Window {
    marked: {
      parse(markdown: string): string;
    };
  }
}

interface Location {
  latitude: number;
  longitude: number;
}

interface HistoryItem {
  id: string;
  prompt: string;
  response: string;
  groundingChunks: GroundingChunk[];
  timestamp: number;
}

const TrashIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
    </svg>
);

const MapExplorer: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryItem, setActiveHistoryItem] = useState<HistoryItem | null>(null);

  const LOCAL_STORAGE_KEY = 'mapExplorerHistory';

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (geoError) => {
        setError('Could not get location. Please allow location access. ' + geoError.message);
      }
    );

    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to parse history:", e);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  const handleSubmit = async () => {
    if (!prompt) {
      setError('Please enter a query.');
      return;
    }
    if (!location) {
      setError('Location not available. Please enable location services.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setActiveHistoryItem(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: location.latitude,
                longitude: location.longitude,
              },
            },
          },
        },
      });

      const newHistoryItem: HistoryItem = {
        id: new Date().toISOString() + Math.random(),
        prompt,
        response: result.text,
        groundingChunks: result.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
        timestamp: Date.now(),
      };

      const updatedHistory = [newHistoryItem, ...history];
      setHistory(updatedHistory);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedHistory));
      setActiveHistoryItem(newHistoryItem);
      setPrompt('');

    } catch (err) {
      console.error(err);
      setError('Failed to fetch information. Please check the console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setActiveHistoryItem(item);
  };

  const handleClearHistory = () => {
    setHistory([]);
    setActiveHistoryItem(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  const renderResponse = () => {
    if (!activeHistoryItem) return null;
    const html = window.marked.parse(activeHistoryItem.response);
    return <div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-gray-100" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., 'Good cafes near me' / 'Buenos cafés cerca de mí'"
          className="flex-grow bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
          disabled={isLoading || !location}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || !location || !prompt}
          className="flex items-center justify-center bg-fuchsia-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-fuchsia-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          <MapIcon />
          <span className="ml-2">Explore</span>
        </button>
      </div>
      
      {error && <p className="text-red-400 my-2 text-center">{error}</p>}
      
      <div className="flex-grow grid md:grid-cols-12 gap-4 min-h-[40vh]">
        <div className="md:col-span-4 bg-gray-800/50 p-4 rounded-lg flex flex-col">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-700">
            <h2 className="text-lg font-bold text-gray-100">History</h2>
            <button 
              onClick={handleClearHistory} 
              disabled={history.length === 0} 
              className="flex items-center text-sm text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
              title="Clear history"
            >
              <TrashIcon />
              <span className="ml-1">Clear</span>
            </button>
          </div>
          <ul className="flex-grow overflow-y-auto space-y-1 -mr-2 pr-2">
            {history.length > 0 ? history.map(item => (
              <li 
                key={item.id} 
                onClick={() => handleSelectHistory(item)} 
                className={`p-2 rounded-md cursor-pointer transition-colors ${activeHistoryItem?.id === item.id ? 'bg-fuchsia-600/80 text-white' : 'hover:bg-gray-700/70'}`}
              >
                <p className="truncate font-semibold text-sm">{item.prompt}</p>
                <p className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleString()}</p>
              </li>
            )) : (
              <li className="flex items-center justify-center h-full text-gray-500 text-center text-sm">No exploration history.</li>
            )}
          </ul>
        </div>
        
        <div className="md:col-span-8 bg-gray-800/50 p-4 rounded-lg overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-fuchsia-400"></div>
            </div>
          )}
          {!isLoading && !activeHistoryItem && (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400">Your location-aware results will appear here.</p>
            </div>
          )}
          {activeHistoryItem && (
            <>
              {renderResponse()}
              {activeHistoryItem.groundingChunks.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <h3 className="text-lg font-semibold mb-2 text-gray-200">Sources:</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {activeHistoryItem.groundingChunks.map((chunk, index) => (
                      chunk.maps && (
                        <li key={index}>
                          <a href={chunk.maps.uri} target="_blank" rel="noopener noreferrer" className="text-fuchsia-400 hover:underline">
                            {chunk.maps.title || 'View on Google Maps'}
                          </a>
                        </li>
                      )
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapExplorer;