import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
// Fix: LiveSession is not an exported member from the SDK.
import type { LiveServerMessage, Blob } from '@google/genai';
import { Transcription } from '../types';
import { encode, decode, decodeAudioData } from '../utils/helpers';
import VoiceIcon from './icons/VoiceIcon';

// Fix: Define LiveSession interface locally as it's not exported from the SDK.
interface LiveSession {
  sendRealtimeInput(input: { media: Blob }): void;
  close(): void;
}

const VoiceAssistant: React.FC = () => {
  // Live session state
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  // TTS state
  const [ttsText, setTtsText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      inputAudioContextRef.current?.close();
      outputAudioContextRef.current?.close();
    };
  }, []);

  const handleLiveError = (message: string, e?: ErrorEvent | CloseEvent) => {
    console.error(message, e);
    setError(message);
    stopSession();
  };

  const startSession = useCallback(async () => {
    setError(null);
    setTranscriptions([]);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsRecording(true);

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' }}},
          systemInstruction: 'You are a friendly and helpful AI assistant.'
        },
        callbacks: {
          onopen: () => {
            setIsSessionActive(true);
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob: Blob = {
                data: encode(new Uint8Array(new Int16Array(inputData.map(v => v * 32768)).buffer)),
                mimeType: 'audio/pcm;rate=16000'
              };
              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
            }
            if (message.serverContent?.inputTranscription) {
              currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
            }
            if(message.serverContent?.turnComplete) {
              setTranscriptions(prev => [...prev, 
                {type: 'user', text: currentInputTranscriptionRef.current},
                {type: 'model', text: currentOutputTranscriptionRef.current}
              ]);
              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
                const outCtx = outputAudioContextRef.current!;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
                const source = outCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outCtx.destination);
                source.addEventListener('ended', () => sourcesRef.current.delete(source));
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
            }
          },
          onerror: (e: ErrorEvent) => handleLiveError('Live session error.', e),
          onclose: (e: CloseEvent) => {
            if (isSessionActive) handleLiveError('Live session closed unexpectedly.', e);
          },
        }
      });
    } catch (err) {
      console.error(err);
      setError('Failed to start session. Please allow microphone access.');
      setIsRecording(false);
    }
  }, [isSessionActive]);

  const stopSession = useCallback(() => {
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
        sessionPromiseRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    scriptProcessorRef.current?.disconnect();
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    setIsSessionActive(false);
    setIsRecording(false);
  }, []);

  const handleGenerateSpeech = async () => {
    if (!ttsText || isSpeaking) return;
    setIsSpeaking(true);
    setError(null);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: ttsText }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              // Improvement: Added speechConfig for voice selection consistency as per guidelines.
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                },
              },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start();
            source.onended = () => {
              setIsSpeaking(false);
              audioContext.close();
            };
        } else {
            throw new Error("No audio data received from API.");
        }
    } catch (err) {
        console.error(err);
        setError("Failed to generate speech.");
        setIsSpeaking(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
      {/* Live Conversation */}
      <div className="flex flex-col bg-gray-800/50 p-4 rounded-lg">
        <h2 className="text-xl font-bold mb-3 text-center text-gray-100">Live Conversation</h2>
        <div className="flex-grow bg-gray-900 p-3 rounded-md overflow-y-auto min-h-[30vh]">
          {transcriptions.length === 0 && <p className="text-gray-500 text-center pt-4">Start a session to see the conversation.</p>}
          {transcriptions.map((t, i) => (
            <div key={i} className={`p-2 my-1 rounded-md ${t.type === 'user' ? 'bg-gray-700 text-right' : 'bg-fuchsia-900/70 text-left'}`}>
              <span className="font-semibold capitalize">{t.type}: </span>{t.text}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <button
            onClick={isRecording ? stopSession : startSession}
            className={`w-full py-3 px-4 font-bold rounded-lg transition-all duration-300 flex items-center justify-center ${
              isRecording 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            <VoiceIcon />
            <span className="ml-2">{isRecording ? 'End Session' : 'Start Session'}</span>
            {isRecording && <span className="ml-2 w-3 h-3 bg-white rounded-full animate-pulse"></span>}
          </button>
        </div>
      </div>

      {/* Text to Speech */}
      <div className="flex flex-col bg-gray-800/50 p-4 rounded-lg">
        <h2 className="text-xl font-bold mb-3 text-center text-gray-100">Text-to-Speech</h2>
        <textarea
          value={ttsText}
          onChange={(e) => setTtsText(e.target.value)}
          placeholder="Type text here to generate speech..."
          className="flex-grow w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
          disabled={isSpeaking}
        />
        <div className="mt-4">
          <button
            onClick={handleGenerateSpeech}
            disabled={!ttsText || isSpeaking}
            className="w-full flex items-center justify-center bg-fuchsia-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-fuchsia-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <VoiceIcon />
            <span className="ml-2">{isSpeaking ? 'Speaking...' : 'Generate Speech'}</span>
          </button>
        </div>
      </div>
      {error && <p className="text-red-400 mt-2 text-center md:col-span-2">{error}</p>}
    </div>
  );
};

export default VoiceAssistant;