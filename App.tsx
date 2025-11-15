import React, { useState, useMemo } from 'react';
import { Tab } from './types';
import ImageEditor from './components/ImageEditor';
import ImageGenerator from './components/ImageGenerator';
import ImageAnalyzer from './components/ImageAnalyzer';
import MapExplorer from './components/MapExplorer';
import VoiceAssistant from './components/VoiceAssistant';
import WebSearch from './components/WebSearch';
import LiveTranslator from './components/LiveTranslator';
import ImageIcon from './components/icons/ImageIcon';
import PaintBrushIcon from './components/icons/PaintBrushIcon';
import DocumentScannerIcon from './components/icons/DocumentScannerIcon';
import MapIcon from './components/icons/MapIcon';
import VoiceIcon from './components/icons/VoiceIcon';
import SearchIcon from './components/icons/SearchIcon';
import TranslateIcon from './components/icons/TranslateIcon';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.ImageGenerator);

  const tabs = useMemo(() => [
    { id: Tab.ImageGenerator, label: 'Image Generator', icon: <PaintBrushIcon /> },
    { id: Tab.ImageEditor, label: 'Image Editor', icon: <ImageIcon /> },
    { id: Tab.ImageAnalyzer, label: 'Image Analyzer', icon: <DocumentScannerIcon /> },
    { id: Tab.MapExplorer, label: 'Map Explorer', icon: <MapIcon /> },
    { id: Tab.VoiceAssistant, label: 'Voice Assistant', icon: <VoiceIcon /> },
    { id: Tab.WebSearch, label: 'Web Search', icon: <SearchIcon /> },
    { id: Tab.LiveTranslator, label: 'Translator', icon: <TranslateIcon /> },
  ], []);

  const renderContent = () => {
    switch (activeTab) {
      case Tab.ImageGenerator:
        return <ImageGenerator />;
      case Tab.ImageEditor:
        return <ImageEditor />;
      case Tab.ImageAnalyzer:
        return <ImageAnalyzer />;
      case Tab.MapExplorer:
        return <MapExplorer />;
      case Tab.VoiceAssistant:
        return <VoiceAssistant />;
      case Tab.WebSearch:
        return <WebSearch />;
      case Tab.LiveTranslator:
        return <LiveTranslator />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen text-gray-200 flex flex-col items-center p-2 sm:p-4 font-sans">
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full">
        <header className="text-center my-4">
          <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-500 to-cyan-400">
            KENEX AI Multi-Modal Studio
          </h1>
          <p className="text-gray-400 mt-2">Explore the creative power of Gemini's advanced capabilities.</p>
        </header>

        <nav className="flex justify-center mb-4 sm:mb-6">
          <div className="flex flex-wrap justify-center space-x-1 sm:space-x-2 bg-gray-800/80 backdrop-blur-sm p-1.5 rounded-xl shadow-lg border border-gray-700/50">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-fuchsia-400 ${
                  activeTab === tab.id
                    ? 'bg-fuchsia-600 text-white shadow-md'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                {tab.icon}
                <span className="ml-2 hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <main className="flex-grow bg-gray-900/80 backdrop-blur-sm p-4 sm:p-6 rounded-2xl shadow-2xl border border-gray-700/50 min-h-[60vh]">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
