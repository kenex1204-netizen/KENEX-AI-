import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { GenerateVideosOperation } from '@google/genai';
import { fileToBase64 } from '../utils/helpers';
import MovieIcon from './icons/MovieIcon';
import DownloadIcon from './icons/DownloadIcon';

type AspectRatio = '16:9' | '9:16';

const LOADING_MESSAGES = [
  "Warming up the digital director's chair...",
  "Gathering pixels for their big scene...",
  "This can take a few minutes, please wait.",
  "Choreographing the animation...",
  "Rendering the final cut...",
  "Almost there, adding the final sparkle!"
];

// Icon for removing the uploaded image
const XCircleIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const VideoCreator: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState<boolean>(true);

  const checkApiKey = useCallback(async () => {
    try {
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
      }
      // The 'else' block that assumed 'false' has been removed to handle race conditions gracefully.
      // If the helper is not yet available, we remain optimistic.
      // The API call failure handler will catch cases where a key is truly missing.
    } catch (e) {
      console.error("Error checking for API key:", e);
      // If the check itself fails, it's safer to assume no key is selected.
      setApiKeySelected(false);
    }
  }, []);


  useEffect(() => {
    checkApiKey();
    // Cleanup object URLs on unmount to prevent memory leaks
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
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

  const handleSelectKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio && typeof aistudio.openSelectKey === 'function') {
      await aistudio.openSelectKey();
      // Assume success and update state to re-render UI.
      // A race condition is possible, but this provides better UX.
      setApiKeySelected(true);
    } else {
      setError("API key selection is not available in this environment.");
    }
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      if (imagePreview) URL.revokeObjectURL(imagePreview); // Clean up previous preview
      setImagePreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `gemini-generated-video-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async () => {
    if (!prompt && !imageFile) {
      setError('Please enter a prompt or upload an image to generate the video.');
      return;
    }

    setIsLoading(true);
    setError(null);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      const imagePayload = imageFile ? {
        imageBytes: await fileToBase64(imageFile),
        mimeType: imageFile.type,
      } : undefined;

      let operation: GenerateVideosOperation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        ...(imagePayload && { image: imagePayload }),
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
      
      if (operation.error) {
        throw new Error(`Video generation failed: ${operation.error.message} (Code: ${operation.error.code})`);
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY as string}`);
        if (!response.ok) {
            let errorBody = await response.text();
            try {
                const errorJson = JSON.parse(errorBody);
                errorBody = errorJson.error?.message || errorBody;
            } catch (e) { /* not json */ }
            throw new Error(`Failed to download video file: ${response.statusText} (${response.status}). ${errorBody}`);
        }
        const blob = await response.blob();
        setVideoUrl(URL.createObjectURL(blob));
      } else {
        throw new Error('Video generation completed, but no download link was found.');
      }
    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message || 'Failed to generate video. Please check the console for details.';
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
        {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow flex flex-col items-center justify-center bg-gray-800/50 p-4 rounded-lg border-2 border-dashed border-gray-600 relative min-h-[40vh]">
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center rounded-lg z-10 text-center p-4">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-fuchsia-400"></div>
            <p className="mt-4 text-lg font-semibold">{loadingMessage}</p>
          </div>
        )}
        {!videoUrl && !isLoading && <p className="text-gray-400">Your generated video will appear here</p>}
        {videoUrl && <video src={videoUrl} controls autoPlay loop className="max-h-full max-w-full object-contain rounded-md" />}
      </div>
      
      <div className="mt-4 flex flex-col gap-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the video, or add details for your image... (e.g., A robot surfing / Make the car fly)"
          className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 h-24 resize-none"
          disabled={isLoading}
        />
        
        {/* Image Upload Section */}
        <div className="mt-1">
          {imagePreview ? (
            <div className="flex items-center gap-3 bg-gray-700/80 p-2 rounded-lg">
              <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-md" />
              <div className="flex-grow text-sm text-gray-300 overflow-hidden">
                <p className="font-semibold truncate">{imageFile?.name}</p>
                <p>{(imageFile!.size / 1024).toFixed(2)} KB</p>
              </div>
              <button onClick={handleRemoveImage} disabled={isLoading} className="text-red-400 hover:text-red-300 p-1 rounded-full bg-gray-800 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Remove image">
                <XCircleIcon />
              </button>
            </div>
          ) : (
            <>
            <label htmlFor="image-upload" className={`w-full text-center block bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-400 ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-600'} transition-colors`}>
              Upload Starting Image (Optional)
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
              disabled={isLoading}
            />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
            <div className="text-sm font-medium text-gray-300">Aspect Ratio:</div>
            <div className="flex bg-gray-700 rounded-lg p-1 w-full">
              {(['16:9', '9:16'] as AspectRatio[]).map(ratio => (
                <button key={ratio} onClick={() => setAspectRatio(ratio)} disabled={isLoading}
                  className={`w-full py-1 rounded-md text-xs sm:text-sm transition ${aspectRatio === ratio ? 'bg-fuchsia-600 text-white' : 'hover:bg-gray-600'}`}>
                  {ratio}
                </button>
              ))}
            </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isLoading || (!prompt && !imageFile)}
          className="w-full flex items-center justify-center bg-fuchsia-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-fuchsia-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          <MovieIcon />
          <span className="ml-2">Generate Video</span>
        </button>

        {videoUrl && !isLoading && (
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors"
            aria-label="Download video"
          >
            <DownloadIcon />
            <span className="ml-2">Download Video</span>
          </button>
        )}
      </div>

      {error && <p className="text-red-400 mt-2 text-center">{error}</p>}
    </div>
  );
};

export default VideoCreator;