import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { GenerateVideosOperation } from '@google/genai';
import { fileToBase64 } from '../utils/helpers';
import MovieIcon from './icons/MovieIcon';

type AspectRatio = '16:9' | '9:16';

const LOADING_MESSAGES = [
  "Warming up the digital director's chair...",
  "Gathering pixels for their big scene...",
  "This can take a few minutes, please wait.",
  "Choreographing the animation...",
  "Rendering the final cut...",
  "Almost there, adding the final sparkle!"
];

const VideoCreator: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState<boolean>(false);

  // Fix: Use type assertion to avoid global type conflicts for window.aistudio
  const checkApiKey = useCallback(async () => {
    try {
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
      } else {
        // Fallback for environments where aistudio is not available
        setApiKeySelected(true); 
      }
    } catch (e) {
      console.error("Error checking for API key:", e);
      // Assume we can proceed if the check fails, API call will fail later if no key
      setApiKeySelected(true); 
    }
  }, []);

  useEffect(() => {
    checkApiKey();
  }, [checkApiKey]);

  useEffect(() => {
    let interval: number;
    if (isLoading) {
      setLoadingMessage(LOADING_MESSAGES[0]);
      interval = window.setInterval(() => {
        setLoadingMessage(prev => {
          const currentIndex = LOADING_MESSAGES.indexOf(prev);
          const nextIndex = (currentIndex + 1) % LOADING_MESSAGES.length;
          return LOADING_MESSAGES[nextIndex];
        });
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setPreviewImage(URL.createObjectURL(file));
      setVideoUrl(null);
      setError(null);
    }
  };

  const handleSelectKey = async () => {
    // Fix: Use type assertion to avoid global type conflicts for window.aistudio
    const aistudio = (window as any).aistudio;
    if (aistudio && typeof aistudio.openSelectKey === 'function') {
      await aistudio.openSelectKey();
      // Assume success and update state to re-render UI.
      // A race condition is possible, but this provides better UX.
      setApiKeySelected(true);
    }
  };
  
  const handleSubmit = async () => {
    if (!imageFile) {
      setError('Please upload an image to start.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setVideoUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const base64Data = await fileToBase64(imageFile);

      let operation: GenerateVideosOperation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt || 'Animate this image beautifully.',
        image: {
          imageBytes: base64Data,
          mimeType: imageFile.type,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: aspectRatio,
        },
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY as string}`);
        const blob = await response.blob();
        setVideoUrl(URL.createObjectURL(blob));
      } else {
        throw new Error('Video generation completed, but no download link was found.');
      }
    } catch (err: any) {
      console.error(err);
      let errorMessage = 'Failed to generate video. Please check the console.';
      if (err.message && err.message.includes('Requested entity was not found')) {
        errorMessage = "API Key not found or invalid. Please select a valid key.";
        setApiKeySelected(false);
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!apiKeySelected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-2xl font-bold mb-4">API Key Required for Veo</h2>
        <p className="mb-6 text-gray-400 max-w-md">
          Video generation with Veo requires a dedicated API key and may incur costs. Please select your API key to continue.
        </p>
        <button
          onClick={handleSelectKey}
          className="bg-fuchsia-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-fuchsia-700 transition-colors"
        >
          Select API Key
        </button>
        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" rel="noopener noreferrer" 
          className="mt-4 text-sm text-fuchsia-400 hover:text-fuchsia-300 underline"
        >
          Learn more about billing
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Side - Input */}
        <div className="flex flex-col gap-4">
          <div className="flex-grow flex flex-col items-center justify-center bg-gray-800/50 p-4 rounded-lg border-2 border-dashed border-gray-600">
            {previewImage ? (
              <img src={previewImage} alt="Preview" className="max-h-full max-w-full object-contain rounded-md" />
            ) : (
              <p className="text-gray-400">Upload an image to animate</p>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-fuchsia-100 file:text-fuchsia-700 hover:file:bg-fuchsia-200 cursor-pointer"
            disabled={isLoading}
          />
        </div>

        {/* Right Side - Output & Controls */}
        <div className="flex flex-col gap-4">
          <div className="flex-grow flex flex-col items-center justify-center bg-gray-800/50 p-4 rounded-lg border-2 border-dashed border-gray-600 relative">
            {isLoading && (
              <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center rounded-lg z-10 text-center p-4">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-fuchsia-400"></div>
                <p className="mt-4 text-lg font-semibold">{loadingMessage}</p>
              </div>
            )}
            {!videoUrl && !isLoading && <p className="text-gray-400">Your generated video will appear here</p>}
            {videoUrl && <video src={videoUrl} controls autoPlay loop className="max-h-full max-w-full object-contain rounded-md" />}
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Prompt (optional, e.g., 'A cinematic zoom out')"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 h-24"
            disabled={isLoading}
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="text-sm font-medium text-gray-300 self-center">Aspect Ratio:</div>
            <div className="flex bg-gray-700 rounded-lg p-1">
              {(['16:9', '9:16'] as AspectRatio[]).map(ratio => (
                <button key={ratio} onClick={() => setAspectRatio(ratio)} disabled={isLoading}
                  className={`w-full py-1 rounded-md text-sm transition ${aspectRatio === ratio ? 'bg-fuchsia-600 text-white' : 'hover:bg-gray-600'}`}>
                  {ratio}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <button
          onClick={handleSubmit}
          disabled={isLoading || !imageFile}
          className="w-full flex items-center justify-center bg-fuchsia-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-fuchsia-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          <MovieIcon />
          <span className="ml-2">Generate Video</span>
        </button>
        {error && <p className="text-red-400 mt-2 text-center">{error}</p>}
      </div>
    </div>
  );
};

export default VideoCreator;