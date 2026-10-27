export const SpeechRecognitionImpl = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export const voiceSupported = Boolean(SpeechRecognitionImpl);
