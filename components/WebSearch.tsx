import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { GroundingChunk } from '@google/genai';
import SearchIcon from './icons/SearchIcon';

// Since `marked` is loaded via a script tag, we declare it on the window object
declare global {
  interface Window {
    marked: {
      parse(markdown: string): string;
    };
  }
}

const WebSearch: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[]>([]);

  const handleSubmit = async () => {
    if (!prompt) {
      setError('Please enter a query.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResponse(null);
    setGroundingChunks([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      setResponse(result.text);
      if (result.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        setGroundingChunks(result.candidates[0].groundingMetadata.groundingChunks);
      }

    } catch (err) {
      console.error(err);
      setError('Failed to fetch information. Please check the console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderResponse = () => {
    if (!response) return null;
    const html = window.marked.parse(response);
    return <div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-gray-100" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything with access to Google Search..."
          className="flex-grow bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
          disabled={isLoading}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || !prompt}
          className="flex items-center justify-center bg-fuchsia-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-fuchsia-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          <SearchIcon />
          <span className="ml-2">Search</span>
        </button>
      </div>
      
      {error && <p className="text-red-400 my-2 text-center">{error}</p>}
      
      <div className="flex-grow bg-gray-800/50 p-4 rounded-lg overflow-y-auto min-h-[40vh]">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-fuchsia-400"></div>
          </div>
        )}
        {!isLoading && !response && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-center">Get up-to-date answers for general questions and recent events.</p>
          </div>
        )}
        {response && renderResponse()}
        {groundingChunks.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-700">
            <h3 className="text-lg font-semibold mb-2 text-gray-200">Sources:</h3>
            <ul className="list-disc list-inside space-y-1">
              {groundingChunks.map((chunk, index) => (
                chunk.web && (
                  <li key={index}>
                    <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-fuchsia-400 hover:underline">
                      {chunk.web.title || 'View Source'}
                    </a>
                  </li>
                )
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebSearch;