import { encodePcm16, PcmResampler, rms } from "./pcm";

export function microphoneError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone permission was denied. Allow microphone access in your browser and try again.";
  if (name === "NotFoundError") return "No microphone was found. Connect an input device and try again.";
  if (name === "NotReadableError") return "The microphone is busy or unavailable. Close other apps using it and try again.";
  if (name === "OverconstrainedError") return "The selected microphone is unavailable. Choose another device.";
  return error instanceof Error ? error.message : "Could not start the microphone.";
}

export class MicrophoneCapture {
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: AudioWorkletNode | null = null;
  private silent: GainNode | null = null;
  private generation = 0;
  private starting = false;
  get active(): boolean { return !!this.stream; }
  async start(context: AudioContext, onChunk: (pcm: Uint8Array, level: number) => void, onError: (message: string) => void, deviceId?: string): Promise<boolean> {
    if (this.active || this.starting) return false;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone input requires HTTPS or localhost in a supported browser.");
    this.starting = true;
    const generation = ++this.generation;
    let acquired: MediaStream | null = null;
    try {
      acquired = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } });
      if (generation !== this.generation) { acquired.getTracks().forEach((track) => track.stop()); return false; }
      await context.audioWorklet.addModule("/audio/microphone-worklet.js");
      if (generation !== this.generation) { acquired.getTracks().forEach((track) => track.stop()); return false; }
      this.stream = acquired;
      this.source = context.createMediaStreamSource(acquired);
      this.processor = new AudioWorkletNode(context, "avatar-microphone");
      this.silent = context.createGain(); this.silent.gain.value = 0;
      const resampler = new PcmResampler(context.sampleRate);
      this.processor.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (generation !== this.generation) return;
        try { const samples = resampler.push(event.data); if (samples.length) onChunk(encodePcm16(samples), rms(samples)); }
        catch { this.stop(); onError("Microphone audio processing failed. Please restart the microphone."); }
      };
      this.processor.onprocessorerror = () => { this.stop(); onError("Microphone audio processing stopped unexpectedly."); };
      for (const track of acquired.getAudioTracks()) track.onended = () => { this.stop(); onError("The microphone was disconnected. Connect a device and try again."); };
      this.source.connect(this.processor); this.processor.connect(this.silent); this.silent.connect(context.destination);
      return true;
    } catch (error) {
      acquired?.getTracks().forEach((track) => track.stop());
      if (generation !== this.generation) return false;
      this.stop(); throw new Error(microphoneError(error));
    } finally { if (generation === this.generation) this.starting = false; }
  }
  stop(): void {
    this.generation++; this.starting = false;
    if (this.processor) { this.processor.port.onmessage = null; this.processor.onprocessorerror = null; this.processor.port.close(); }
    this.source?.disconnect(); this.processor?.disconnect(); this.silent?.disconnect();
    for (const track of this.stream?.getTracks() ?? []) { track.onended = null; track.stop(); }
    this.stream = null; this.source = null; this.processor = null; this.silent = null;
  }
}
