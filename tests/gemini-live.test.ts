import { test } from "node:test";
import assert from "node:assert/strict";
import { GeminiLiveClient, type LiveCallbacks } from "../services/gemini/GeminiLiveClient";
import { encodePcm16, toBase64 } from "../services/audio/pcm";
import { isLocalTokenRequest, TokenRateLimit } from "../services/gemini/tokenPolicy";
import { Live, LiveServerMessage, type LiveConnectParameters, type Session } from "@google/genai";

function fixture() {
  const chunks: Uint8Array[] = []; const rates: number[] = []; const errors: string[] = []; const transcripts: string[] = [];
  let interrupted = 0; let complete = 0;
  const callbacks: LiveCallbacks = {
    onState: () => {}, onAudio: (bytes, rate) => { chunks.push(bytes); rates.push(rate); }, onError: (error) => errors.push(error),
    onInterrupted: () => { interrupted++; }, onTurnComplete: () => { complete++; }, onTranscript: (speaker, text) => transcripts.push(`${speaker}:${text}`),
  };
  const client = new GeminiLiveClient(callbacks);
  const bytes = encodePcm16(Float32Array.from([0, 0.5, -0.5]));
  const audio = { serverContent: { modelTurn: { parts: [{ inlineData: { data: toBase64(bytes), mimeType: "audio/pcm;rate=24000" } }] } } };
  return { client, chunks, rates, errors, transcripts, bytes, audio, interrupted: () => interrupted, complete: () => complete };
}
test("Gemini protocol decodes audio and transcriptions and clears playback on interruption", () => {
  const f = fixture(); f.client.receive(f.audio);
  assert.deepEqual(f.chunks[0], f.bytes); assert.deepEqual(f.rates, [24000]);
  f.client.receive({ serverContent: { inputTranscription: { text: "Hi" }, outputTranscription: { text: "Hello" }, interrupted: true, ...f.audio.serverContent } });
  assert.equal(f.interrupted(), 1); assert.equal(f.chunks.length, 1); assert.deepEqual(f.transcripts, ["user:Hi", "avatar:Hello"]);
  f.client.receive({ serverContent: { turnComplete: true } }); assert.equal(f.complete(), 1);
});
test("stopping suppresses all remaining audio in the current turn and next turn can play", () => {
  const f = fixture(); f.client.stopResponse(); f.client.receive(f.audio); assert.equal(f.chunks.length, 0);
  f.client.receive({ serverContent: { turnComplete: true } }); f.client.receive(f.audio); assert.equal(f.chunks.length, 1);
  f.client.disconnect(); assert.equal(f.client.connected, false);
});
test("invalid Gemini PCM is contained and text cannot send before connection", () => {
  const f = fixture(); f.client.receive({ serverContent: { modelTurn: { parts: [{ inlineData: { data: "!!", mimeType: "audio/pcm" } }] } } });
  assert.equal(f.errors.length, 1); assert.equal(f.interrupted(), 1);
  assert.throws(() => f.client.sendText("hello"), /Connect/);
});
test("token endpoint policy rejects cross-origin and public-host requests", () => {
  const request = (url: string, origin: string) => new Request(url, { headers: { origin } });
  assert.equal(isLocalTokenRequest(request("http://localhost:3001/api/gemini/token", "http://localhost:3001")), true);
  assert.equal(isLocalTokenRequest(request("http://localhost:3001/api/gemini/token", "https://evil.example")), false);
  assert.equal(isLocalTokenRequest(request("https://avatar.example/api/gemini/token", "https://avatar.example")), false);
  assert.equal(isLocalTokenRequest(new Request("http://localhost:3001/api/gemini/token")), false);
});
test("token minting is rate limited and the window expires", () => {
  const limiter = new TokenRateLimit();
  for (let i = 0; i < 6; i++) assert.equal(limiter.allow("local", 1000), true);
  assert.equal(limiter.allow("local", 1000), false); assert.equal(limiter.allow("local", 62000), true);
});

test("Live connects with an ephemeral token, sends PCM/text, resumes, and rejects stale callbacks", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let tokens = 0; let closed = 0;
  const messages: unknown[] = []; const connects: LiveConnectParameters[] = [];
  t.mock.method(globalThis, "fetch", async () => { tokens++; return Response.json({ token: "auth_tokens/test", model: "gemini-3.8-live" }); });
  t.mock.method(Live.prototype, "connect", async (params: LiveConnectParameters) => {
    connects.push(params);
    return { sendRealtimeInput: (data: unknown) => messages.push(data), close: () => { closed++; } } as unknown as Session;
  });
  const f = fixture(); await f.client.connect(); assert.equal(f.client.connected, true);
  f.client.sendAudio(f.bytes); f.client.sendText("hello"); f.client.endAudio();
  assert.deepEqual(messages.slice(0, 2), [{ audio: { data: toBase64(f.bytes), mimeType: "audio/pcm;rate=16000" } }, { text: "hello" }]);
  assert.deepEqual(messages.at(-1), { audioStreamEnd: true });
  assert.equal((messages[2] as { audio: { data: string } }).audio.data.length, 25600);
  connects[0].callbacks.onmessage(Object.assign(new LiveServerMessage(), { sessionResumptionUpdate: { resumable: true, newHandle: "resume-test" } }));
  connects[0].callbacks.onclose?.({ code: 1006 } as CloseEvent);
  assert.equal(f.client.connected, false); assert.equal(closed, 1);
  t.mock.timers.tick(1000);
  for (let i = 0; i < 12; i++) await Promise.resolve();
  assert.equal(tokens, 2); assert.equal(connects[1].config?.sessionResumption?.handle, "resume-test");
  connects[0].callbacks.onmessage(Object.assign(new LiveServerMessage(), f.audio)); assert.equal(f.chunks.length, 0);
  connects[1].callbacks.onmessage(Object.assign(new LiveServerMessage(), f.audio)); assert.equal(f.chunks.length, 1);
  f.client.disconnect(); assert.equal(closed, 2); assert.equal(f.client.connected, false);
  connects[1].callbacks.onmessage(Object.assign(new LiveServerMessage(), f.audio)); assert.equal(f.chunks.length, 1);
});

test("disconnect cancels pending Live setup and closes a late session", async (t) => {
  let grant!: (value: Session) => void; let closed = false;
  t.mock.method(globalThis, "fetch", async () => Response.json({ token: "auth_tokens/test", model: "gemini-3.8-live" }));
  t.mock.method(Live.prototype, "connect", () => new Promise<Session>((resolve) => { grant = resolve; }));
  const f = fixture(); const pending = f.client.connect();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.ok(grant); f.client.disconnect(); await pending;
  grant({ close: () => { closed = true; } } as unknown as Session);
  await Promise.resolve(); assert.equal(closed, true); assert.equal(f.client.connected, false);
});
