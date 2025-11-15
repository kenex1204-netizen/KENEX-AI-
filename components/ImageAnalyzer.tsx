import React, { useState, useCallback, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { fileToBase64 } from '../utils/helpers';
import DocumentScannerIcon from './icons/DocumentScannerIcon';

// Declare marked on window
declare global {
  interface Window {
    marked: {
      parse(markdown: string): string;
    };
  }
}

// History item structure
interface HistoryItem {
  id: string;
  prompt: string;
  response: string;
  imageDataUrl: string;
  timestamp: number;
}

// Trash icon for clearing history
const TrashIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
    </svg>
);

const ImageAnalyzer: React.FC = () => {
  // State for current analysis context
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  // General component state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State for history management
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryItemId, setActiveHistoryItemId] = useState<string | null>(null);

  const LOCAL_STORAGE_KEY = 'imageAnalyzerHistory';

  // Load history from local storage on component mount
  useEffect(() => {
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);

      // Create a data URL for persistent preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      // New image signifies a new analysis context
      setActiveHistoryItemId(null);
      setAnalysisResult(null);
      setError(null);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!imageFile || !prompt) {
      setError('Please upload an image and provide a prompt.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setActiveHistoryItemId(null);
    setAnalysisResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const base64Data = await fileToBase64(imageFile);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: imageFile.type,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      });
      
      setAnalysisResult(response.text);

      const newHistoryItem: HistoryItem = {
        id: new Date().toISOString() + Math.random(),
        prompt,
        response: response.text,
        imageDataUrl: imagePreview as string, // imagePreview is guaranteed to be a data URL string here
        timestamp: Date.now(),
      };
      
      const updatedHistory = [newHistoryItem, ...history];
      setHistory(updatedHistory);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedHistory));
      setActiveHistoryItemId(newHistoryItem.id);

    } catch (err) {
      console.error(err);
      setError('Failed to analyze image. Please check the console for details.');
    } finally {
      setIsLoading(false);
    }
  }, [imageFile, prompt, imagePreview, history]);
  
  const handleSelectHistory = async (item: HistoryItem) => {
    setActiveHistoryItemId(item.id);
    setAnalysisResult(item.response);
    setPrompt(item.prompt);
    setError(null);
    setIsLoading(false);

    // Reconstruct the file object from the data URL for potential re-analysis
    try {
      const response = await fetch(item.imageDataUrl);
      const blob = await response.blob();
      const fileName = `history-image-${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
      const file = new File([blob], fileName, { type: blob.type });

      setImageFile(file);
      setImagePreview(item.imageDataUrl);
    } catch (e) {
      console.error("Failed to reconstruct file from history:", e);
      setError("Could not load image from history.");
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    setActiveHistoryItemId(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  const renderResponse = (text: string) => {
    const html = window.marked.parse(text);
    return <div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-gray-100" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow grid md:grid-cols-12 gap-4 min-h-[40vh]">
        {/* History Sidebar */}
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
                className={`p-2 rounded-md cursor-pointer transition-colors ${activeHistoryItemId === item.id ? 'bg-fuchsia-600/80 text-white' : 'hover:bg-gray-700/70'}`}
              >
                <p className="truncate font-semibold text-sm">{item.prompt}</p>
                <p className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleString()}</p>
              </li>
            )) : (
              <li className="flex items-center justify-center h-full text-gray-500 text-center text-sm">No analysis history.</li>
            )}
          </ul>
        </div>
        
        {/* Main Content Area */}
        <div className="md:col-span-8 flex flex-col gap-4">
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-800/50 p-4 rounded-lg border-2 border-dashed border-gray-600">
            {!imagePreview && <p className="text-gray-400">Upload an image to analyze</p>}
            {imagePreview && <img src={imagePreview} alt="Analysis subject" className="max-h-full max-w-full object-contain rounded-md" />}
          </div>
          <div className="flex-1 bg-gray-800/50 p-4 rounded-lg overflow-y-auto relative">
            {isLoading && (
              <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center rounded-lg z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-fuchsia-400"></div>
                <p className="mt-4 text-lg">Analyzing...</p>
              </div>
            )}
            {!analysisResult && !isLoading && <p className="text-gray-400 text-center flex items-center justify-center h-full">Analysis will appear here</p>}
            {analysisResult && renderResponse(analysisResult)}
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex flex-col gap-2">
         <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-fuchsia-100 file:text-fuchsia-700 hover:file:bg-fuchsia-200 cursor-pointer"
          disabled={isLoading}
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => {
                setPrompt(e.target.value);
                setActiveHistoryItemId(null); // Typing a new prompt creates a new context
            }}
            placeholder="Ask something about the image... (e.g., What is this?)"
            className="flex-grow bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            disabled={isLoading}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || !imageFile || !prompt}
            className="flex items-center justify-center bg-fuchsia-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-fuchsia-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <DocumentScannerIcon />
            <span className="ml-2">Analyze</span>
          </button>
        </div>
      </div>
      {error && <p className="text-red-400 mt-2 text-center">{error}</p>}
    </div>
  );
};

export default ImageAnalyzer;
