// Explicit smoke check: a public Google sample is sent, never the user's microphone.
import { GoogleGenAI } from "@google/genai";
const origin = process.env.AVATAR_TEST_ORIGIN || "http://localhost:3001";
const tokenResponse = await fetch(`${origin}/api/gemini/token`, { method: "POST", headers: { Origin: origin } });
const auth = await tokenResponse.json();
if (!tokenResponse.ok) { console.error("Live smoke test:", auth.error); process.exit(1); }
const sample = await fetch("https://storage.googleapis.com/generativeai-downloads/data/hello_are_you_there.pcm");
if (!sample.ok) throw new Error("Could not download the official PCM sample.");
const bytes = Buffer.from(await sample.arrayBuffer());
const ai = new GoogleGenAI({ apiKey: auth.token, httpOptions: { apiVersion: "v1beta" } });
let session;
let chunks = 0;
let pcmBytes = 0;
let inputTranscript = "";
let outputTranscript = "";
let settle;
const finished = new Promise((resolve) => { settle = resolve; });
const timeout = setTimeout(() => settle(false), 25000);
try {
  session = await ai.live.connect({ model: auth.model, config: {
    responseModalities: ["AUDIO"], inputAudioTranscription: {}, outputAudioTranscription: {},
    sessionResumption: {}, contextWindowCompression: { slidingWindow: {} },
    realtimeInputConfig: { automaticActivityDetection: { disabled: false, startOfSpeechSensitivity: "START_SENSITIVITY_HIGH", endOfSpeechSensitivity: "END_SENSITIVITY_HIGH", prefixPaddingMs: 40, silenceDurationMs: 500 }, activityHandling: "START_OF_ACTIVITY_INTERRUPTS" },
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
  }, callbacks: {
    onmessage: (message) => {
      const content = message.serverContent;
      if (!content) return;
      inputTranscript += content.inputTranscription?.text || "";
      outputTranscript += content.outputTranscription?.text || "";
      for (const part of content.modelTurn?.parts || []) if (part.inlineData?.data) { chunks++; pcmBytes += Buffer.from(part.inlineData.data, "base64").length; }
      if (content.turnComplete) settle(true);
    }, onerror: () => settle(false), onclose: () => settle(false),
  } });
  // Realtime pacing exercises streamed microphone-compatible input, then flushes VAD.
  for (let offset = 0; offset < bytes.length; offset += 3200) {
    session.sendRealtimeInput({ audio: { data: bytes.subarray(offset, offset + 3200).toString("base64"), mimeType: "audio/pcm;rate=16000" } });
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  for (let i = 0; i < 12; i++) {
    session.sendRealtimeInput({ audio: { data: Buffer.alloc(3200).toString("base64"), mimeType: "audio/pcm;rate=16000" } });
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  session.sendRealtimeInput({ audioStreamEnd: true });
  const complete = await finished;
  console.log(JSON.stringify({ model: auth.model, inputBytes: bytes.length, inputTranscript, outputTranscript, audioChunks: chunks, outputPcmBytes: pcmBytes, turnComplete: complete }));
  if (!complete || !pcmBytes || !inputTranscript) process.exitCode = 1;
} catch {
  console.error("Live smoke test failed. Check network, quota, and model configuration."); process.exitCode = 1;
} finally { clearTimeout(timeout); session?.close(); }
