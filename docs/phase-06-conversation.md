# Phase 06: conversation and lip-sync integration

## Implemented

`hooks/useAvatarConversation.ts` owns the audio/Live lifecycle, UI state, device and local audio checks, text input, speaker mute, interruption, disconnect, and emotion commands. `ConnectedAvatar.tsx` now renders that hook's state and commands rather than maintaining a second copy of conversation behavior.

`ConversationCoordinator` is independent of React. It receives connection, voice activity, turn, and actual playback events and drives the existing `AvatarEngine`. It adds no animation loop: the engine still updates once per rendered frame.

- Disconnected, reconnecting, and failed sessions rest in **idle**.
- Connected and ready sessions are **listening**; user voice activity keeps the avatar listening.
- A finished user turn or buffered response that has not started playback selects **thinking**.
- Scheduled audio becomes **speaking** only while it is actually playing. Server turn completion does not cut off buffered speech.
- Silence below 0.025 normalized amplitude, speaker mute, Stop, server interruption, playback completion, and disconnect close the mouth. Silence within a playing audio turn keeps the speaking state but closes the jaw.
- LipSyncEngine uses a bounded amplitude with faster attack/release damping and a silence gate. The existing facial engine supplies smooth morph blending.
- Interruption restores each facial mesh's captured jaw/viseme rest weights immediately, without waiting for another render frame. A targeted rest override holds those controls through silence, while smile, brows, eyes, and bones continue independently. Jaw-opening emotion profiles cannot reopen the speech jaw while silent.
- The hook exposes `setEmotion(name, intensity)` for all six supported emotions. Unknown commands fall back to neutral; intensity is clamped and invalid intensity gets the default. Disconnect/error/cleanup restores neutral. The connected page offers these commands under **Avatar emotion**.
- Cleanup invalidates pending asynchronous operations and releases conversation ownership. Late microphone or audio activation completions cannot restart a disconnected conversation.

## Viseme scope

Amplitude lip-sync remains the reliable default. Existing viseme controls still work in the studio, but conversation playback does not guess phonemes from volume, transcripts, or GLB shape names. No timestamped audio-to-phoneme analyser has been validated for this project. Automatic viseme timing remains an optional enhancement requiring alignment against the actual playback clock and cancellation on interruption.

## Verification

48 automated tests pass. New Phase 06 tests cover actual playback versus buffered audio, server turn completion during playback, exact immediate reset across face/teeth with different original rest weights, silence/mute under a surprised expression, user voice activity, reconnect, neutral fallback, cleanup, and frame-rate independent amplitude damping. Lint, TypeScript, and production build pass.

Browser verification used a real Gemini answer: Listening → Thinking → Speaking; mute reduced mouth amplitude to zero while audio remained queued; Stop immediately cleared playback and returned to Listening. Physical microphone interruption remains a hardware check because the automation browser has no microphone device.

## Manual checks

1. Open `http://localhost:3001/avtaar-connected` and refresh.
2. Expand **Avatar emotion**, click **Happy**, then **Surprised**. Eyes/brows should respond while the resting speech jaw stays closed. Click **Neutral**.
3. Connect to Gemini, type a request for a several-sentence answer, and Send. Check Listening → Thinking → Speaking, then Listening after all audio finishes.
4. Expand **Transcript & audio checks**. While speech is playing, confirm nonzero mouth amplitude. The avatar should briefly close its mouth during silent intervals.
5. Mute speaker during speech: mouth amplitude and jaw should immediately return to rest. Unmute while playback is still running: mouth motion should resume.
6. Click **Stop audio** mid-answer: queue and amplitude must become zero, jaw/visemes must immediately return to rest, and the avatar must return to Listening. Send another message to verify normal speech resumes.
7. With an available microphone, speak over an answer: both queued audio and mouth motion must stop when Gemini detects your speech. Then check Thinking → Speaking for the new answer.
8. Disconnect during speech. Confirm Idle, neutral expression, no audio, and a resting mouth. Navigate back to the studio and verify the normal morph demos still work.

Commands: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
