# Avatar Studio: Phase-Wise Enhancement Plan

This document consolidates the project documentation into one implementation plan. It is ordered by dependency: measure first, improve the real-time experience, then add product capabilities and production hardening.

## Current baseline

Avatar Studio is a local-first Next.js application that renders a rigged GLB avatar with React Three Fiber and a framework-independent TypeScript animation engine. It already includes:

- Studio and Connected pages with saved avatar looks.
- Rig inspection, morph controls, gaze, blinking, idle behavior, six emotions, 15 visemes, and 10 body poses.
- Scene themes, custom lighting, dark/light UI, responsive layout, and reduced-motion support.
- Gemini Live microphone input, streamed PCM playback, transcripts, interruption, reconnect/session resume, and server-minted ephemeral tokens.
- Playback-driven jaw motion, with cleanup and interruption behavior covered by automated tests.
- A compressed default GLB asset and unit tests for the engine, pose, state, audio, conversation, and Gemini layers.

The realistic target is a best-in-class real-time 3D avatar, not photoreal server-rendered video. Success means fast response, natural speech animation, believable behavior, easy customization, safe deployment, and reliable embedding.

## Product quality targets

Measure these before changing behavior and re-check them after every relevant phase:

| Metric | Target |
| --- | --- |
| Audio-to-mouth offset | Within +/-40 ms; mouth never leads audible speech |
| Bilabial closure accuracy | At least 95% for P/B/M after the advanced lip-sync phase |
| Time to first spoken audio | Under 1.0 s typical, 1.5 s worst case |
| Time to visible avatar | Under 3 s on broadband production load |
| Frame rate | 60 fps on a mid-range laptop; 30 fps floor on a mid-range phone |
| Default model size | Remain under 10 MB |
| Accessibility | WCAG 2.2 AA for the interface |
| Crash-free sessions | At least 99.5% after production instrumentation |

## Phase 0 — Baseline, observability, and safety rails

**Goal:** establish evidence before tuning animation or performance.

### Work

- Add a toggleable debug overlay for waveform, current viseme/morph weights, frame time average and p95, audio queue length, and audio-to-mouth offset.
- Create 10–15 short reference clips covering different speeds, voices, vowels, silence, and plosive-heavy sentences.
- Add a repeatable benchmark for model load, time-to-visible, frame time, and memory.
- Record the baseline scorecard in this document or a generated test report.
- Add explicit cleanup assertions for microphone tracks, audio nodes, timers, animation resources, and session ownership.
- Add a consent/disclosure notice for microphone use and AI-generated speech before public deployment.

### Acceptance criteria

Every quality target has a measured baseline, and the debug overlay can be disabled without affecting production behavior.

### Main areas

`components/avatar/`, `services/audio/`, `avatar/engine/`, `tests/fixtures/`, and `scripts/benchmark.*`.

## Phase 1 — Lip-sync foundation

**Depends on:** Phase 0.

**Goal:** remove timing and smoothing errors while preserving the current reliable playback-driven behavior.

### Work

- Drive mouth sampling from the actual audio clock, including output-latency compensation and a user-adjustable sync offset.
- Replace stacked smoothing with one bounded per-channel attack/release filter.
- Calibrate loudness in dB with a noise floor instead of using an uncalibrated RMS multiplier.
- Add an audio-to-viseme estimator in an AudioWorklet or Worker using energy, zero-crossing rate, high-band ratio, onsets, and vowel/formant classes.
- Run analysis ahead of scheduled playback, but apply results against the playback clock.
- Cancel queued viseme events and reset mouth state immediately on stop, mute, interruption, disconnect, and cleanup.
- Keep jaw, lips, facial expressions, and manual controls in separate mixer channels so one cannot overwrite another.

### Acceptance criteria

Reference clips achieve audio-to-mouth offset within +/-40 ms, visibly distinguish A/E/O/M/F/S, and reach at least 85% P/B/M closure accuracy at this stage. Silent intervals close the jaw without incorrectly changing the conversation state.

### Main areas

`services/audio/`, `avatar/engine/LipSyncEngine.ts`, `FacialEngine.ts`, `AvatarEngine.ts`, and a new `avatar/lipsync/` or `services/audio/visemeAnalyzer` module.

## Phase 2 — Advanced lip-sync and rig calibration

**Depends on:** Phase 1.

**Goal:** reach natural, coarticulated mouth motion across supported rigs.

### Work

- Add dominance-weighted coarticulation, bilabial priority, minimum viseme duration, anticipation, and look-ahead scheduling.
- Decouple jaw motion from lip shapes: jaw follows energy/open vowels while lips follow visemes.
- Add mild under-articulation and loudness-scaled excursion to avoid an exaggerated robotic look.
- Evaluate a neural audio-to-blendshape model using ONNX Runtime Web/WebGPU with a WASM fallback. Verify model license and training-data terms before adoption.
- Keep the signal-based estimator as a fallback when the neural model is unavailable.
- Create a per-rig calibration profile for jaw gain, viseme gains, rest weights, aliases, and timing offsets.
- Add blind A/B tests against Phase 1 output.

### Acceptance criteria

At least 95% P/B/M closure accuracy, median viseme timing error under 40 ms, and a majority preference for the advanced system in a blind comparison.

## Phase 3 — Aliveness, prosody, and body language

**Can run alongside:** Phase 2 after the mixer contracts are stable.

**Goal:** make the entire avatar appear attentive, expressive, and non-looped.

### Work

- Add a prosody engine that maps pitch and energy peaks to restrained head nods, brow raises, eyelid emphasis, and phrase-boundary blinks.
- Add listening behavior: nods, small smiles, gaze shifts, and thinking glances while the user speaks or the system waits.
- Add natural eye contact with saccades and occasional glance-aways.
- Expand idle behavior with breathing, weight shifts, micro head turns, and randomized timing.
- Build a gesture library: beat gesture, point, open palms, shrug, wave, and thumbs-up with blending and an idle hand pose.
- Keep gestures and behavior layered over poses without overwriting speech or facial channels.
- Add a state-driven behavior controller for idle, listening, thinking, speaking, interrupted, and disconnected states.

### Acceptance criteria

A 60-second conversation contains no frozen body, obvious repeated loop, or conflicting facial motion. At least five viewers rate the avatar’s naturalness an average of 4/5 or higher.

### Main areas

New `ProsodyEngine`, `GestureEngine`, and `BehaviorController`, plus pose clip data and the existing animation mixer.

## Phase 4 — Persona, tools, knowledge, and conversation quality

**Can run alongside:** Phases 2–3.

**Goal:** turn the voice connection into a configurable avatar agent.

### Work

- Add editable persona settings: name, role, tone, language, boundaries, and disclosure text.
- Save persona settings with the avatar look and validate them before sending to the model.
- Add tool calls such as `set_emotion`, `play_gesture`, `look_at`, and `change_background`.
- Add voice and language selection with per-language tuning where needed.
- Add document/URL knowledge ingestion with retrieval and citations in the transcript.
- Add optional long-term user notes, separate from the short-term conversation window.
- Measure and reduce time to first audio with warm session setup, early token preparation, and immediate thinking animation.
- Add reconnect UX, offline/no-key states, captions, text-only fallback, and clear error recovery.

### Acceptance criteria

Users can configure a persona, ask questions answered from an uploaded source with citations, and see the avatar respond to a tool-driven emotion or gesture. A dropped connection recovers without a full page reload.

### Main areas

Gemini configuration/client, conversation hook/coordinator, new persona and knowledge services, and the Connected-page UI.

## Phase 5 — Premium visual quality

**Can run alongside:** Phases 3–4.

**Goal:** improve the avatar and scene without breaking the frame-time budget.

### Work

- Add HDRI/image-based lighting, soft/contact shadows, and quality presets.
- Improve skin with a practical subsurface approximation, roughness/specular tuning, and consistent tone mapping.
- Improve eyes with cornea highlights, refraction/wet-line treatment, and corrected eyelash/hair transparency sorting.
- Re-author or replace the unusable eye-occlusion layer currently hidden by the rig export.
- Add light post-processing: SSAO, subtle bloom, anti-aliasing, and configurable quality levels.
- Add KTX2/Basis textures, mipmaps, and device-dependent 1K/2K tiers.
- Add headshot, bust, and full-body cameras with smooth transitions, depth of field, and automatic framing.
- Support image, video, blur, solid-color, and transparent backgrounds.

### Acceptance criteria

Blind screenshot comparisons show a clear visual improvement while a mid-range laptop remains within the frame-time budget and the default asset remains fast to load.

## Phase 6 — Embed, APIs, deployment, and observability

**Depends on:** Phase 4.

**Goal:** make the application usable outside local development.

### Work

- Replace localhost-only token policy with authenticated, rate-limited production access.
- Add user accounts, project ownership, and secure server-side storage where needed.
- Provide an embeddable viewer/chat widget with theme and branding options.
- Define a versioned API/SDK for avatar state, conversation events, tools, and playback.
- Add analytics for load time, first audio, interruptions, errors, device class, and feature usage without collecting unnecessary microphone content.
- Add structured error reporting, feature flags, and operational dashboards.
- Document deployment, environment variables, key rotation, retention, deletion, and data processing.

### Acceptance criteria

A production deployment can securely serve multiple users, isolate projects, enforce quotas, embed the avatar, and explain failures through observable metrics.

## Phase 7 — Quality, accessibility, and release hardening

**Runs throughout, completed before launch.**

### Work

- Add end-to-end tests for Studio, Connected, save/restore, microphone permission, interruption, reconnect, captions, and export.
- Add visual regression screenshots for key camera, lighting, theme, and UI states.
- Add real-device checks for Chromium, Safari, mobile Safari, Android Chrome, low-power GPUs, and reduced-motion mode.
- Add automated accessibility checks plus keyboard, focus, contrast, screen-reader, and zoom verification.
- Add performance budgets to CI for bundle size, model size, startup, frame time, and memory.
- Add security tests for token endpoints, upload validation, tool authorization, prompt injection through documents, and data deletion.
- Keep `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` green on every change.

### Acceptance criteria

The release candidate passes the scorecard, device matrix, accessibility review, security checks, and production build without known high-severity issues.

## Recommended execution order

1. Phase 0: baseline and measurement.
2. Phase 1: timing-correct lip-sync.
3. Phase 2: coarticulation and neural/fallback quality.
4. Phase 3: prosody, gestures, and aliveness.
5. Phase 4: persona, tools, knowledge, and conversation robustness.
6. Phase 5: visual fidelity.
7. Phase 6: deployment, embedding, and observability.
8. Phase 7: release hardening.

Phases 2–5 can overlap once the Phase 1 animation contracts and measurement harness are stable. Phases 6–8 should wait until the underlying rig, state, and conversation APIs are data-driven and versioned.

## Definition of done

The application is ready for a serious beta when it can:

- Load and calibrate multiple avatar rigs.
- Keep mouth motion synchronized to audible playback with measurable accuracy.
- Express speech through face, eyes, posture, and gestures without visible channel conflicts.
- Run a configurable, safe persona with tools, knowledge, citations, captions, and recovery behavior.
- Save, export, import, embed, and restore avatar projects reliably.
- Meet frame-rate, startup, accessibility, security, and observability budgets on supported devices.

