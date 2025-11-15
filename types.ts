export enum Tab {
  ImageGenerator = 'imageGenerator',
  ImageEditor = 'imageEditor',
  ImageAnalyzer = 'imageAnalyzer',
  MapExplorer = 'mapExplorer',
  VoiceAssistant = 'voiceAssistant',
  WebSearch = 'webSearch',
  LiveTranslator = 'liveTranslator',
}

export interface Transcription {
  type: 'user' | 'model';
  text: string;
}