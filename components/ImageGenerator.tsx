import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import SparklesIcon from './icons/SparklesIcon';
import DownloadIcon from './icons/DownloadIcon';

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!prompt) {
      setError('Please enter a prompt to generate an image.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio,
        },
      });

      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
      setGeneratedImage(imageUrl);

    } catch (err) {
      console.error(err);
      setError('Failed to generate image. Please check the console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `gemini-generated-image-${Date.now()}.jpeg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow flex flex-col items-center justify-center bg-gray-800/50 p-4 rounded-lg border-2 border-dashed border-gray-600 relative min-h-[40vh]">
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center rounded-lg z-10">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-fuchsia-400"></div>
            <p className="mt-4 text-lg">Generating your masterpiece...</p>
          </div>
        )}
        {!generatedImage && !isLoading && (
            <div className="text-center text-gray-400">
                <div className="flex justify-center text-gray-500">
                    <SparklesIcon />
                </div>
                <p className="mt-2">Your generated image will appear here.</p>
                <p className="text-sm text-gray-500">Describe what you want to create.</p>
            </div>
        )}
        {generatedImage && <img src={generatedImage} alt="Generated" className="max-h-full max-w-full object-contain rounded-md" />}
      </div>
      
      <div className="mt-4 flex flex-col gap-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your image in English or Spanish... (e.g., A futuristic cityscape with flying cars / Una ciudad futurista con coches voladores)"
          className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 h-24 resize-none"
          disabled={isLoading}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
            <div className="text-sm font-medium text-gray-300">Aspect Ratio:</div>
            <div className="flex bg-gray-700 rounded-lg p-1 w-full">
              {(['1:1', '16:9', '9:16', '4:3', '3:4'] as AspectRatio[]).map(ratio => (
                <button key={ratio} onClick={() => setAspectRatio(ratio)} disabled={isLoading}
                  className={`w-full py-1 rounded-md text-xs sm:text-sm transition ${aspectRatio === ratio ? 'bg-fuchsia-600 text-white' : 'hover:bg-gray-600'}`}>
                  {ratio}
                </button>
              ))}
            </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isLoading || !prompt}
          className="w-full flex items-center justify-center bg-fuchsia-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-fuchsia-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          <SparklesIcon />
          <span className="ml-2">Generate Image</span>
        </button>
        {generatedImage && !isLoading && (
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors"
            aria-label="Download image"
          >
            <DownloadIcon />
            <span className="ml-2">Download</span>
          </button>
        )}
      </div>
      {error && <p className="text-red-400 mt-2 text-center">{error}</p>}
    </div>
  );
};

export default ImageGenerator;