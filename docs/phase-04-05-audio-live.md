# Phases 04–05: audio and Gemini Live

## Configuration

Keep `GEMINI_API_KEY` in ignored `.env.local`. The existing credential was copied from `.env` without logging it. No `NEXT_PUBLIC_` credential is used. Optional `GEMINI_LIVE_MODEL` defaults to `gemini-3.8-live`, verified through the model listing with the configured key. Installed official JavaScript SDK: `@google/genai` 2.27.0.

The local token endpoint requires a same-origin POST on localhost/127.0.0.1/IPv6 loopback, returns `no-store`, and limits issuance to six tokens per minute per local app host. Tokens are single-use for new sessions, have a one-minute connection window and a 30-minute lifetime, and constrain model/audio configuration. The permanent key stays on the server. This local endpoint deliberately refuses public/network-host requests. A future public deployment needs real user authentication and shared rate limiting before token issuance is enabled there.

## Audio path

- `/audio/microphone-worklet.js` captures mono samples off the main thread. A muted sink keeps the worklet graph running without microphone monitoring.
- `MicrophoneCapture` uses echo cancellation/noise suppression, handles denied permission, missing/busy/disconnected devices, and releases late streams after cancellation.
- `PcmResampler` preserves fractional state across input blocks (including 44.1/48 kHz), then emits signed little-endian PCM16 at 16 kHz. Browser Live requests use `audio/pcm;rate=16000`.
- `PcmPlayer` decodes Gemini PCM16 at the declared rate (normally 24 kHz), schedules contiguous buffer boundaries on `AudioContext.currentTime`, and adds a 120 ms initial buffer. Scheduled chunks have no artificial gap. A delayed network chunk that misses its deadline starts a new buffer rather than overlap old audio; the app cannot conceal an unlimited network outage.
- The analyser reads current playback, not queued chunks. Muted output reports zero mouth amplitude. The avatar listens while connected, thinks after a user turn, and speaks only during playback.
- Stop clears every scheduled source and discards remaining incoming audio for that turn. Disconnect/unmount stops microphone tracks, timers, playback, and audio contexts. Server interruption/voice-activity events immediately clear playback.
- Connect and audio-test clicks resume the browser audio context. The microphone is off until explicitly started.

## Gemini path

`POST /api/gemini/token` uses the server key to provision a short-lived token. The browser connects directly using that token with the documented `v1beta` Live API, audio output, input/output transcription, automatic VAD, and session resumption. SDK 2.27.0 still prints an older v1alpha-only warning for ephemeral tokens; actual v1beta token connections and native audio were verified successfully.

Text uses `sendRealtimeInput({text})`. Audio uses `sendRealtimeInput({audio})`; ending microphone input flushes a short silent tail and `audioStreamEnd`. Unexpected closures use bounded exponential retries and fresh tokens, preserving a resumption handle when available. Stale callbacks and late setup completions are ignored/closed. Stop audio silences the current response locally; disconnect ends the Live session.

## Manual verification

1. Run `npm run dev -- --port 3001`, or `npm run build` followed by `npm run start -- --port 3001`.
2. Open `http://localhost:3001/avtaar-connected`. The avatar appears with a compact conversation dock below it and no rig sidebar.
3. Expand **Transcript & audio checks**. While disconnected, click **Test streamed speaker**. Listen for a continuous two-second tone, watch the mouth amplitude, then click **Stop audio** midway. Queue and amplitude must immediately become zero.
4. Click **Record microphone test**, grant browser permission, speak, then **Stop local recording** (or wait ten seconds). Click **Play local recording**. Your recording stays in browser memory and should be audible with mouth movement. Test permission denial and an unavailable microphone; an actionable error should appear.
5. Click **Connect to Gemini**. Wait for connected status. Type a message and click **Send**. Check streamed speech, transcript, and mouth movement.
6. Click **Start microphone**, grant permission, speak, and leave a short pause. Gemini should answer. Choose another input device while the microphone is off if necessary. Use headphones to reduce acoustic feedback.
7. Speak over a long answer. Pending audio should clear when Gemini detects your speech, and the next answer should play normally. Also test **Mute microphone**, **Mute speaker**, **Stop audio**, and **Disconnect**.
8. Disconnect must stop the microphone indicator and all sound. Connect again and send another turn. Navigate back to the studio during playback and verify sound/input stop.
9. Temporarily drop the network during a conversation. Expect reconnecting status and bounded retries, then an error with a Reconnect button if recovery fails. A fresh connection may lose context when no valid resumption handle remains.
10. Inspect browser network requests: the local endpoint returns an `auth_tokens/...` token; the permanent API key must never appear in client JavaScript or the browser request to Google.

## Verification evidence

- Unit tests cover PCM encoding/clipping, chunk-boundary resampling, scheduled playback timing, audible amplitude/mute, queue clearing, permission/device errors, worklet capture, cancellation, protocol decoding, interruption, fresh-token reconnect/resumption, stale callbacks, and token-origin/rate-limit rules.
- Real browser testing connected successfully, received speech/transcripts from text, showed a nonzero playback amplitude, and verified speaker mute and Stop clearing queue/amplitude.
- Real PCM smoke test sent Google's public `hello_are_you_there.pcm`, received input transcription “Hey, can you hear me?”, 14 output chunks (180,000 PCM bytes), an answer, and turn completion.
- The automation browser has no microphone device. Physical microphone recording/conversation and listening for audible gaps remain manual hardware checks; capture and teardown are tested with device mocks.

`npm run test:live` performs the public-sample smoke test against the running app (default localhost:3001; override `AVATAR_TEST_ORIGIN` as needed). It makes real API calls and consumes quota. `npm test` is offline.

Official references checked on 2026-10-03:

- https://ai.google.dev/gemini-api/docs/live-api/get-started-sdk
- https://ai.google.dev/gemini-api/docs/live-api/capabilities
- https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
- https://ai.google.dev/gemini-api/docs/live-api/session-management
