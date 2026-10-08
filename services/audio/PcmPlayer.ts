import { decodePcm16, rms, OUTPUT_SAMPLE_RATE } from "./pcm";

export interface PlaybackFrame { playing: boolean; amplitude: number; queuedSeconds: number; timestamp?: number; playbackTime?: number; outputLatencyMs?: number; syncOffsetMs?: number }
export class PcmPlayer {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gain: GainNode | null = null;
  private sources = new Map<AudioBufferSourceNode, { start: number; end: number }>();
  private nextStart = 0;
  private frame = 0;
  private muted = false;
  private lastPlaying = false;
  // Positive offset intentionally delays mouth motion; negative offsets are not exposed because they can make the mouth lead audio.
  private syncOffsetMs = 0;
  constructor(private onFrame: (frame: PlaybackFrame) => void = () => {}) {}
  get audioContext(): AudioContext { if (!this.context) throw new Error("Activate audio first."); return this.context; }
  get queuedSeconds(): number { return this.context ? Math.max(0, this.nextStart - this.context.currentTime) : 0; }
  get outputLatencyMs(): number { const context = this.context; return context ? ((context.outputLatency || context.baseLatency || 0) * 1000) : 0; }
  get mouthSyncOffsetMs(): number { return this.syncOffsetMs; }
  setSyncOffsetMs(value: number): void { if (Number.isFinite(value)) this.syncOffsetMs = Math.max(0, Math.min(200, value)); }
  /** Call directly in the click handler so browser audio activation is preserved. */
  async activate(): Promise<void> {
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContext({ latencyHint: "interactive" });
      this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 512;
      this.gain = this.context.createGain(); this.gain.gain.value = this.muted ? 0 : 1;
      this.analyser.connect(this.gain); this.gain.connect(this.context.destination);
    }
    await this.context.resume();
    if (this.context.state !== "running") throw new Error("Audio is paused by the browser. Click Connect or Test speaker again.");
  }
  enqueue(bytes: Uint8Array, sampleRate = OUTPUT_SAMPLE_RATE): void {
    const context = this.audioContext;
    if (sampleRate < 8000 || sampleRate > 96000 || !Number.isFinite(sampleRate)) throw new Error("Invalid PCM sample rate.");
    const samples = decodePcm16(bytes); if (!samples.length) return;
    if (this.queuedSeconds + samples.length / sampleRate > 30) throw new Error("Playback queue exceeded 30 seconds. Stop the response and try again.");
    const buffer = context.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = context.createBufferSource(); source.buffer = buffer; source.connect(this.analyser!);
    // Initial jitter buffer; subsequent chunks share the exact audio clock boundary.
    const start = this.nextStart > context.currentTime ? this.nextStart : context.currentTime + 0.12;
    this.nextStart = start + buffer.duration;
    this.sources.set(source, { start, end: this.nextStart });
    source.onended = () => { this.sources.delete(source); source.disconnect(); };
    source.start(start);
    if (!this.frame) this.observe();
  }
  setMuted(value: boolean): void {
    this.muted = value; if (this.gain) this.gain.gain.value = value ? 0 : 1;
    // Notify silence synchronously, including when animation frames are suspended.
    if (value) this.onFrame(this.emitFrame(false, 0));
  }
  private emitFrame(playing: boolean, amplitude: number): PlaybackFrame {
    return { playing, amplitude, queuedSeconds: this.queuedSeconds, timestamp: performance.now(), playbackTime: this.context?.currentTime, outputLatencyMs: this.outputLatencyMs, syncOffsetMs: this.syncOffsetMs };
  }
  private observe = (): void => {
    const context = this.context;
    if (!context || !this.analyser) return;
    const now = context.currentTime;
    // The source clock is ahead of what the listener hears by outputLatency. Subtracting it,
    // plus the user delay, makes the visual clock conservative: the mouth cannot lead audio.
    const mouthClock = now - (this.outputLatencyMs / 1000) - (this.syncOffsetMs / 1000);
    const playing = context.state === "running" && [...this.sources.values()].some(({ start, end }) => start <= mouthClock && mouthClock < end);
    const samples = new Float32Array(this.analyser.fftSize); this.analyser.getFloatTimeDomainData(samples);
    this.lastPlaying = playing;
    this.onFrame(this.emitFrame(playing, playing && !this.muted ? Math.min(1, rms(samples) * 5) : 0));
    this.frame = this.sources.size ? requestAnimationFrame(this.observe) : 0;
  };
  stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0;
    for (const source of this.sources.keys()) { source.onended = null; source.stop(); source.disconnect(); }
    this.sources.clear(); this.nextStart = 0; this.lastPlaying = false;
    this.onFrame(this.emitFrame(false, 0));
  }
  get playing(): boolean { return this.lastPlaying; }
  async dispose(): Promise<void> {
    this.stop(); this.analyser?.disconnect(); this.gain?.disconnect();
    const context = this.context; this.context = null; this.analyser = null; this.gain = null;
    if (context && context.state !== "closed") await context.close();
  }
}
