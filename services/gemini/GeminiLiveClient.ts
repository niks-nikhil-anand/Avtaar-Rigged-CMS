import { GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";
import { audioSampleRate, fromBase64, toBase64 } from "../audio/pcm";
import { liveConfig } from "./config";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
export interface LiveCallbacks {
  onState: (state: ConnectionState) => void;
  onError: (message: string) => void;
  onAudio: (bytes: Uint8Array, rate: number) => void;
  onInterrupted: () => void;
  onTurnComplete: () => void;
  onTranscript: (speaker: "user" | "avatar", text: string, finished: boolean) => void;
  onUserActivity?: (active: boolean) => void;
}
export class GeminiLiveClient {
  private session: Session | null = null;
  private wanted = false;
  private generation = 0;
  private attempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private resumeHandle: string | undefined;
  private dropAudio = false;
  private request: AbortController | null = null;
  private connecting = false;
  private cancelOpen: (() => void) | null = null;
  constructor(private callbacks: LiveCallbacks) {}
  get connected(): boolean { return !!this.session; }
  async connect(): Promise<void> {
    if (this.connecting || this.session) return;
    this.wanted = true; this.attempts = 0;
    await this.open(false);
  }
  private async open(reconnecting: boolean): Promise<void> {
    if (!this.wanted || this.connecting) return;
    this.connecting = true;
    const generation = ++this.generation;
    this.callbacks.onState(reconnecting ? "reconnecting" : "connecting");
    this.request = new AbortController();
    const controller = this.request;
    const fetchTimeout = setTimeout(() => controller.abort(), 15_000);
    let setupTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await fetch("/api/gemini/token", { method: "POST", cache: "no-store", signal: this.request.signal });
      const auth = await response.json();
      clearTimeout(fetchTimeout);
      if (!response.ok) throw new Error(auth.error || "Unable to connect to Gemini.");
      if (!this.wanted || generation !== this.generation) return;
      const ai = new GoogleGenAI({ apiKey: auth.token, httpOptions: { apiVersion: "v1beta" } });
      const pending = ai.live.connect({ model: auth.model, config: liveConfig(this.resumeHandle), callbacks: {
        onmessage: (message) => { if (generation === this.generation && this.wanted) this.receive(message); },
        onerror: () => { if (generation === this.generation && this.wanted) this.lost("Gemini connection failed. Check your network, quota, and model access."); },
        onclose: (event) => { if (generation === this.generation && this.wanted) this.lost(event.code === 1008 ? "Gemini rejected the Live session. Check your model access and quota." : "The Live connection closed. Reconnecting…"); },
      } });
      // The SDK leaves its setup promise pending if the socket closes before setupComplete.
      // Bound the wait and close a session that resolves after cancellation.
      void pending.then((session) => { if (generation !== this.generation || !this.wanted) session.close(); }, () => {});
      const cancelled = new Promise<never>((_, reject) => {
        this.cancelOpen = () => reject(new Error("Connection was cancelled."));
        setupTimeout = setTimeout(() => reject(new Error("Gemini connection timed out. Check your network and retry.")), 20_000);
      });
      const session = await Promise.race([pending, cancelled]);
      if (!this.wanted || generation !== this.generation) { session.close(); return; }
      this.session = session; this.dropAudio = false; this.attempts = 0;
      this.callbacks.onState("connected");
    } catch (error) {
      if (!this.wanted || generation !== this.generation) return;
      const message = error instanceof Error && error.message && !/https?:|wss?:|key=|token=/i.test(error.message) ? error.message : "Could not connect to Gemini Live. Check your network and quota.";
      if (reconnecting) this.lost(message);
      else { this.wanted = false; this.generation++; this.callbacks.onState("error"); this.callbacks.onError(message); }
    } finally {
      clearTimeout(fetchTimeout); if (setupTimeout) clearTimeout(setupTimeout);
      if (generation === this.generation || !this.wanted) { this.connecting = false; this.request = null; this.cancelOpen = null; }
    }
  }
  /** Public for deterministic protocol tests without a live microphone or billing. */
  receive(message: Pick<LiveServerMessage, "serverContent" | "sessionResumptionUpdate" | "goAway" | "voiceActivity">): void {
    if (message.sessionResumptionUpdate) this.resumeHandle = message.sessionResumptionUpdate.resumable ? message.sessionResumptionUpdate.newHandle : undefined;
    if (message.goAway) { this.lost("Gemini is refreshing the session. Reconnecting…"); return; }
    // SDK 2.27 types name this voiceActivityType; v1beta also returns the raw `type` field.
    const activity = message.voiceActivity as (NonNullable<LiveServerMessage["voiceActivity"]> & { type?: string }) | undefined;
    const activityType = activity?.voiceActivityType ?? activity?.type;
    if (activityType === "ACTIVITY_START") { this.callbacks.onInterrupted(); this.callbacks.onUserActivity?.(true); }
    if (activityType === "ACTIVITY_END") this.callbacks.onUserActivity?.(false);
    const content = message.serverContent; if (!content) return;
    if (content.interrupted) { this.dropAudio = false; this.callbacks.onInterrupted(); }
    if (content.inputTranscription?.text) this.callbacks.onTranscript("user", content.inputTranscription.text, !!content.inputTranscription.finished);
    if (content.outputTranscription?.text) this.callbacks.onTranscript("avatar", content.outputTranscription.text, !!content.outputTranscription.finished);
    if (!content.interrupted && !this.dropAudio) {
      try {
        for (const part of content.modelTurn?.parts ?? []) {
          if (part.inlineData?.data) this.callbacks.onAudio(fromBase64(part.inlineData.data), audioSampleRate(part.inlineData.mimeType));
        }
      } catch { this.stopResponse(); this.callbacks.onError("Could not decode or queue Gemini audio. Stop the response and try again."); }
    }
    if (content.turnComplete) { this.dropAudio = false; this.callbacks.onTurnComplete(); }
  }
  sendAudio(bytes: Uint8Array): void {
    try { this.session?.sendRealtimeInput({ audio: { data: toBase64(bytes), mimeType: "audio/pcm;rate=16000" } }); }
    catch { this.lost("Microphone audio could not be sent. Reconnecting…"); }
  }
  endAudio(): void {
    try {
      // Flush an utterance even when the user switches off the mic before VAD's silence window.
      this.session?.sendRealtimeInput({ audio: { data: toBase64(new Uint8Array(19_200)), mimeType: "audio/pcm;rate=16000" } });
      this.session?.sendRealtimeInput({ audioStreamEnd: true });
    } catch { this.lost("The Live connection was interrupted."); }
  }
  sendText(text: string): void {
    if (!this.session) throw new Error("Connect to Gemini before sending a message.");
    if (!text.trim() || text.length > 4000) throw new Error("Enter a message of up to 4,000 characters.");
    this.stopResponse(); this.dropAudio = false;
    this.session.sendRealtimeInput({ text: text.trim() });
  }
  stopResponse(): void { this.dropAudio = true; this.callbacks.onInterrupted(); }
  private lost(message: string): void {
    if (!this.wanted || this.retryTimer) return;
    this.generation++; this.connecting = false;
    this.cancelOpen?.(); this.cancelOpen = null;
    const session = this.session; this.session = null; session?.close();
    this.request?.abort(); this.request = null;
    this.callbacks.onInterrupted();
    if (++this.attempts > 3) {
      this.wanted = false; this.callbacks.onState("error"); this.callbacks.onError(`${message} Click Reconnect to try again.`); return;
    }
    this.callbacks.onState("reconnecting");
    this.retryTimer = setTimeout(() => { this.retryTimer = null; void this.open(true); }, 1000 * 2 ** (this.attempts - 1));
  }
  disconnect(): void {
    this.wanted = false; this.generation++; this.connecting = false;
    this.cancelOpen?.(); this.cancelOpen = null;
    if (this.retryTimer) clearTimeout(this.retryTimer); this.retryTimer = null;
    this.request?.abort(); this.request = null;
    const session = this.session; this.session = null; session?.close();
    this.resumeHandle = undefined; this.dropAudio = false;
    this.callbacks.onInterrupted(); this.callbacks.onState("disconnected");
  }
}
