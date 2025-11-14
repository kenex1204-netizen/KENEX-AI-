export enum Tab {
  ImageGenerator = 'imageGenerator',
  ImageEditor = 'imageEditor',
  VideoCreator = 'videoCreator',
  MapExplorer = 'mapExplorer',
  VoiceAssistant = 'voiceAssistant',
  WebSearch = 'webSearch',
}

export interface Transcription {
  type: 'user' | 'model';
  text: string;
}