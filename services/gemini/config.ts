import { ActivityHandling, StartSensitivity, EndSensitivity, Modality, type LiveConnectConfig } from "@google/genai";

export const DEFAULT_LIVE_MODEL = "gemini-3.8-live";
export function liveConfig(handle?: string): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    inputAudioTranscription: {}, outputAudioTranscription: {},
    sessionResumption: handle ? { handle } : {},
    contextWindowCompression: { slidingWindow: {} },
    realtimeInputConfig: { automaticActivityDetection: {
      disabled: false, startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
      endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH, prefixPaddingMs: 40, silenceDurationMs: 500,
    }, activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS },
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
  };
}
