import React, { useState, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { fileToBase64 } from '../utils/helpers';
import SparklesIcon from './icons/SparklesIcon';

const ImageEditor: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setOriginalImage(URL.createObjectURL(file));
      setEditedImage(null);
      setError(null);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!imageFile || !prompt) {
      setError('Please upload an image and provide an editing prompt.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEditedImage(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const base64Data = await fileToBase64(imageFile);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
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
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64ImageBytes: string = part.inlineData.data;
          setEditedImage(`data:${part.inlineData.mimeType};base64,${base64ImageBytes}`);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to edit image. Please check the console for details.');
    } finally {
      setIsLoading(false);
    }
  }, [imageFile, prompt]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center bg-gray-800/50 p-4 rounded-lg border-2 border-dashed border-gray-600">
          {!originalImage && <p className="text-gray-400">Upload an image to start</p>}
          {originalImage && <img src={originalImage} alt="Original" className="max-h-full max-w-full object-contain rounded-md" />}
        </div>
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center bg-gray-800/50 p-4 rounded-lg border-2 border-dashed border-gray-600 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center rounded-lg z-10">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-fuchsia-400"></div>
              <p className="mt-4 text-lg">Editing your image...</p>
            </div>
          )}
          {!editedImage && !isLoading && <p className="text-gray-400">Your edited image will appear here</p>}
          {editedImage && <img src={editedImage} alt="Edited" className="max-h-full max-w-full object-contain rounded-md" />}
        </div>
      </div>
      
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-fuchsia-100 file:text-fuchsia-700 hover:file:bg-fuchsia-200 cursor-pointer"
          disabled={isLoading}
        />
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., 'Add a retro filter'"
          className="flex-grow bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
          disabled={isLoading}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || !imageFile || !prompt}
          className="flex items-center justify-center bg-fuchsia-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-fuchsia-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          <SparklesIcon />
          <span className="ml-2">Generate</span>
        </button>
      </div>
      {error && <p className="text-red-400 mt-2 text-center">{error}</p>}
    </div>
  );
};

export default ImageEditor;