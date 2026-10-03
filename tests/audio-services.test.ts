import { test } from "node:test";
import assert from "node:assert/strict";
import { PcmResampler, encodePcm16, decodePcm16, toBase64, fromBase64, audioSampleRate, rms } from "../services/audio/pcm";
import { PcmPlayer, type PlaybackFrame } from "../services/audio/PcmPlayer";
import { MicrophoneCapture, microphoneError } from "../services/audio/MicrophoneCapture";

test("PCM encoding clips safely and uses signed little-endian samples", () => {
  const bytes = encodePcm16(Float32Array.from([-2, -1, 0, 0.5, 1, 2, NaN]));
  assert.deepEqual([...bytes.slice(0, 6)], [0, 128, 0, 128, 0, 0]);
  const decoded = decodePcm16(bytes);
  assert.equal(decoded[0], -1); assert.equal(decoded[4], 32767 / 32768); assert.equal(decoded[6], 0);
  assert.ok(Math.abs(decoded[3] - 0.5) < 0.0001);
  assert.throws(() => decodePcm16(Uint8Array.from([1])), /complete/);
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
});
test("resampling 48kHz and 44.1kHz preserves time across arbitrary chunk boundaries", () => {
  for (const rate of [48000, 44100]) {
    const samples = Float32Array.from({ length: rate }, (_, i) => Math.sin(i * 2 * Math.PI * 220 / rate));
    const whole = new PcmResampler(rate).push(samples);
    const stream = new PcmResampler(rate);
    const parts: number[] = [];
    for (let i = 0; i < samples.length; i += 1024) parts.push(...stream.push(samples.subarray(i, i + 1024)));
    assert.equal(parts.length, 16000); assert.deepEqual(Float32Array.from(parts), whole);
    assert.ok(rms(whole) > 0.7 && rms(whole) < 0.72);
  }
  assert.throws(() => new PcmResampler(0), /Invalid/);
});
test("PCM playback MIME validation honors rate and rejects compressed audio", () => {
  assert.equal(audioSampleRate("audio/pcm;rate=16000"), 16000);
  assert.equal(audioSampleRate(), 24000);
  assert.throws(() => audioSampleRate("audio/mp3"), /unsupported/);
  assert.throws(() => audioSampleRate("audio/pcm;rate=1"), /Unsupported/);
});

class FakeNode {
  disconnected = false;
  connect() { return this; }
  disconnect() { this.disconnected = true; }
}
class FakeSource extends FakeNode {
  buffer: { duration: number } | null = null;
  onended: (() => void) | null = null;
  started = -1; stopped = false;
  start(time: number) { this.started = time; }
  stop() { this.stopped = true; }
}
class FakeContext {
  state = "suspended";
  currentTime = 0;
  sampleRate = 48000;
  destination = new FakeNode();
  sources: FakeSource[] = [];
  gain = Object.assign(new FakeNode(), { gain: { value: 1 } });
  analyser = Object.assign(new FakeNode(), { fftSize: 512, getFloatTimeDomainData: (data: Float32Array) => data.fill(0.1) });
  async resume() { this.state = "running"; }
  async close() { this.state = "closed"; }
  createGain() { return this.gain; }
  createAnalyser() { return this.analyser; }
  createBuffer(_channels: number, length: number, rate: number) { const samples = new Float32Array(length); return { duration: length / rate, getChannelData: () => samples }; }
  createBufferSource() { const source = new FakeSource(); this.sources.push(source); return source; }
}

test("playback schedules contiguous chunks, measures only active audio, and stop clears every source", async (t) => {
  let tick: FrameRequestCallback | undefined;
  let cancelled = false;
  const globals = { requestAnimationFrame: (callback: FrameRequestCallback) => { tick = callback; return 1; }, cancelAnimationFrame: () => { cancelled = true; }, AudioContext: FakeContext };
  for (const [name, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => { if (previous) Object.defineProperty(globalThis, name, previous); else Reflect.deleteProperty(globalThis, name); });
  }
  const frames: PlaybackFrame[] = [];
  const player = new PcmPlayer((frame) => frames.push(frame));
  await player.activate();
  const context = player.audioContext as unknown as FakeContext;
  const bytes = encodePcm16(new Float32Array(2400).fill(0.1));
  player.enqueue(bytes); player.enqueue(bytes);
  assert.equal(context.sources[0].started, 0.12);
  assert.equal(context.sources[1].started, context.sources[0].started + 0.1);
  assert.equal(frames[0].playing, false); assert.equal(frames[0].amplitude, 0);
  context.currentTime = 0.15; tick!(0);
  assert.equal(frames.at(-1)?.playing, true); assert.ok(frames.at(-1)!.amplitude > 0);
  player.setMuted(true); tick!(0); assert.equal(frames.at(-1)?.amplitude, 0); assert.equal(context.gain.gain.value, 0);
  player.stop(); assert.equal(player.queuedSeconds, 0); assert.equal(player.playing, false); assert.equal(cancelled, true);
  assert.ok(context.sources.every((source) => source.stopped && source.disconnected && source.onended === null));
  context.currentTime = 1; player.enqueue(bytes); assert.equal(context.sources.at(-1)?.started, 1.12);
  assert.throws(() => player.enqueue(encodePcm16(new Float32Array(24000 * 31))), /30 seconds/);
  await player.dispose(); assert.equal(context.state, "closed");
});

test("microphone permission/device errors are actionable", () => {
  assert.match(microphoneError(new DOMException("", "NotAllowedError")), /permission/);
  assert.match(microphoneError(new DOMException("", "NotFoundError")), /No microphone/);
  assert.match(microphoneError(new DOMException("", "NotReadableError")), /busy/);
});
test("stopping during a pending microphone permission request releases late streams", async (t) => {
  let grant!: (stream: MediaStream) => void;
  let stopped = false;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { mediaDevices: { getUserMedia: () => new Promise<MediaStream>((resolve) => { grant = resolve; }) } } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "navigator", previous); });
  const capture = new MicrophoneCapture();
  const pending = capture.start({} as AudioContext, () => {}, () => {});
  capture.stop();
  grant({ getTracks: () => [{ stop: () => { stopped = true; } }] } as unknown as MediaStream);
  assert.equal(await pending, false); assert.equal(stopped, true); assert.equal(capture.active, false);
});

test("microphone worklet output becomes 16kHz PCM and stop disconnects nodes and tracks", async (t) => {
  let stopped = false; let moduleUrl = "";
  const track = { onended: null, stop: () => { stopped = true; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const source = new FakeNode(); const silent = new FakeNode();
  class Worklet extends FakeNode {
    port = { onmessage: null as ((event: MessageEvent<Float32Array>) => void) | null, close: () => {} };
    onprocessorerror = null;
  }
  const worklets: Worklet[] = [];
  class CapturedWorklet extends Worklet { constructor() { super(); worklets.push(this); } }
  for (const [name, value] of Object.entries({ navigator: { mediaDevices: { getUserMedia: async () => stream } }, AudioWorkletNode: CapturedWorklet })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => { if (previous) Object.defineProperty(globalThis, name, previous); else Reflect.deleteProperty(globalThis, name); });
  }
  const context = { sampleRate: 48000, destination: {}, audioWorklet: { addModule: async (url: string) => { moduleUrl = url; } }, createMediaStreamSource: () => source, createGain: () => Object.assign(silent, { gain: { value: 1 } }) } as unknown as AudioContext;
  const chunks: Uint8Array[] = [];
  const mic = new MicrophoneCapture();
  assert.equal(await mic.start(context, (bytes) => chunks.push(bytes), () => {}), true);
  const worklet = worklets[0];
  worklet!.port.onmessage!({ data: new Float32Array(4800).fill(0.5) } as MessageEvent<Float32Array>);
  assert.equal(moduleUrl, "/audio/microphone-worklet.js"); assert.equal(chunks[0].length, 3200);
  assert.ok(decodePcm16(chunks[0]).every((value) => Math.abs(value - 0.5) < 0.0001));
  mic.stop(); assert.equal(stopped, true); assert.equal(mic.active, false);
  assert.equal(worklet!.port.onmessage, null); assert.ok(source.disconnected && worklet!.disconnected && silent.disconnected);
});
