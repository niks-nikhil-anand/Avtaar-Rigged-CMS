# Enhancement roadmap: reaching competitor-level quality, step by step

A phased plan to take Avatar Studio from a strong technical prototype to a product that holds up next to the best avatar platforms. Every phase has a goal, concrete work, acceptance criteria you can test, effort, and dependencies, so it can be executed in order and checked off.

Companion document: [Precise real-time lip-sync guide](lip-sync-guide.md) (deep dive for phases P1 and P2).

> **Read this first: what "perfect like competitors" can honestly mean.**
> - Photoreal video generators (HeyGen, Synthesia, D-ID class) render neural video, often on server GPUs. A browser-rendered 3D rig will not become a photoreal video face by tuning. Trying to match that exactly is the wrong target.
> - The right target is **best-in-class real-time 3D avatar**: instant response, natural speech animation, a believable face and body, easy customization, and easy embedding. Real-time 3D competitors (Soul Machines, Inworld, Convai, NVIDIA ACE, and avatar SDKs such as Ready Player Me) are the realistic benchmark.
> - Competitor feature statements in this file describe what products of that type **typically** offer. They are not verified claims about any vendor. Before committing roadmap time, do a hands-on trial of two or three products and fill in the comparison in section 2.

---

## 1. Where the project stands today

Verified against the code in this repository.

| Area | What exists | Known gap |
| --- | --- | --- |
| 3D viewer | Rigged GLB viewer, orbit and face/full-body cameras, 9 lighting presets plus fully custom lighting, dark/light UI | Basic PBR only: no environment map, no skin subsurface look, no post-processing |
| Animation engine | Priority mixer, blinking, gaze, idle, 6 emotions, 15 visemes, 10 poses, custom pose editor | Visemes are never driven by speech; no gestures; no prosody-driven motion |
| Lip-sync | Jaw opens with loudness measured from playing audio | Every sound looks the same; about 60-100 ms smoothing lag (see lip-sync guide) |
| Voice AI | Gemini Live audio in/out, transcripts, interruption, session resume, ephemeral tokens | **No persona or system prompt, no tools (the model cannot set emotions or gestures), one fixed voice, no knowledge or memory** |
| Save and restore | One saved look shared with the Connected page | Single slot, browser-only, no named projects, no export or import |
| Output | Live in the browser only | No video export, no captions, no embed |
| Assets | One compressed Character Creator model (8.5 MB) | No avatar library, no upload flow, no VRM or Ready Player Me support |
| Quality assurance | 64 unit tests (engine, pose, state, audio, Gemini mocks) | No visual regression, no end-to-end, no performance budget in CI, no real device matrix |
| Product | Local only; token endpoint restricted to localhost | No auth, no deployment story, no analytics, no safety layer |

---

## 2. Competitive gap analysis

Fill the "Competitor A/B" columns after a hands-on trial (name the products you tried and the date). Ratings for this project: **Gap** (missing or weak), **Partial**, **Parity**.

| Dimension | What leaders typically offer | This project | Competitor A | Competitor B |
| --- | --- | --- | --- | --- |
| Lip-sync accuracy | Phoneme-accurate, coarticulated, closures on P/B/M | **Gap** | | |
| Response latency | First audio and mouth movement in well under a second | Partial (measure it) | | |
| Facial expression | Emotion shifts that follow meaning, micro-expressions | Partial | | |
| Body language | Gestures, posture shifts, hands that move with speech | **Gap** | | |
| Visual fidelity | Soft skin, believable eyes and hair, good lighting, clean edges | Partial | | |
| Persona and behaviour | Configurable character, tone, role, guardrails | **Gap** | | |
| Knowledge and tools | Documents, web, actions via function calling | **Gap** | | |
| Languages and voices | Many languages, voice choice or cloning | Partial (one voice) | | |
| Customization | Own avatar, outfits, backgrounds, branding | Partial | | |
| Output formats | Live stream, embeddable widget, exported video, captions | **Gap** | | |
| Deployment | Hosted or self-hosted, SDKs, API, analytics | **Gap** | | |
| Performance and reach | Fast load, mobile support, graceful degradation | Partial | | |
| Safety and compliance | Moderation, consent, disclosure, data controls | **Gap** | | |

---

## 3. The quality bar: what "done" means

A scorecard to re-run after each phase. Targets are goals to aim for; measure first (P0) and adjust them to what your users need.

| Metric | Target | How to measure |
| --- | --- | --- |
| Audio-to-mouth offset | within +/-40 ms, mouth never late | Debug overlay on a click-track clip (P0) |
| Lip closure accuracy (P, B, M) | at least 95 % reach 0.9 closure | Compare with forced-alignment ground truth |
| Time to first spoken audio after the user stops talking | under 1.0 s typical, 1.5 s worst case | Timestamp user end-of-speech to first scheduled audio |
| Time to interactive (production build, broadband) | under 3 s to a visible avatar, under 6 s to fully ready | Lighthouse and manual stopwatch |
| Frame rate | 60 fps on a mid laptop, 30 fps floor on a mid phone; frame time p95 under 16.7 ms (laptop) | Performance panel, in-app frame stats |
| Model download size | under 10 MB for the default avatar (now 8.5 MB) | File size on disk and network panel |
| Visual regression | no unintended pixel changes in key screens | Screenshot tests (P11) |
| Accessibility | WCAG 2.2 AA for the UI | Automated axe checks plus manual keyboard pass |
| Crash-free sessions | at least 99.5 % of sessions | Client error reporting (P8) |

---

## 4. Step-by-step plan

Effort is in developer-days for one engineer who knows the codebase; double it for someone new. "Depends on" lists hard prerequisites. Do the phases in order unless a note says otherwise.

### P0: Baseline and measurement (3-4 days)

**Goal:** you cannot improve what you cannot measure.

- [ ] Add a toggleable **debug overlay**: audio waveform, current viseme weights, frame time (average and p95), measured audio-to-mouth offset, queue length.
- [ ] Record 10-15 **reference clips** (varied voices, speeds, plosive-heavy sentences) and store small versions in the repo.
- [ ] Create **ground truth** with a forced aligner (phoneme boundaries from audio plus transcript).
- [ ] Add **frame statistics** collection (dev only) and a scripted benchmark that loads the model and measures time-to-visible.
- [ ] Run the scorecard in section 3 and record the baseline numbers in this file.

**Done when:** every metric in section 3 has a measured baseline.
**Files:** new `components/avatar/DebugOverlay.tsx`, `tests/fixtures/`, `scripts/benchmark.mjs`.

### P1: Lip-sync foundation (5-7 days); depends on P0

**Goal:** remove avoidable lag, then add shape accuracy without a model. Full detail in the lip-sync guide, stages 1-2.

- [ ] Sample speech animation on the **audio clock** with output-latency compensation and a user sync-offset setting.
- [ ] Replace the three stacked smoothing steps with **one per-channel attack/release** filter (fast attack, slightly slower release).
- [ ] Calibrated loudness (dB with noise floor) replacing `rms * 5`.
- [ ] **Audio-to-viseme estimator** in an AudioWorklet or Worker, running on queued audio ahead of playback: energy, zero-crossing, high-band ratio, onset detection, formant-based vowel classes. Feeds `LipSyncEngine.setViseme`.
- [ ] Clear viseme events on interruption.

**Done when:** offset within +/-40 ms on reference clips; P/B/M closures at least 85 % (stage target); visibly different shapes for A, E, O, M, F, S.
**Files:** `services/audio/PcmPlayer.ts`, `avatar/engine/LipSyncEngine.ts`, `FacialEngine.ts`, `AvatarEngine.ts`, new `services/audio/visemeAnalyzer.ts`.

### P2: Lip-sync quality jump (10-15 days); depends on P1

**Goal:** natural, fluid, competitor-grade mouth motion.

- [ ] **Coarticulation** with dominance-weighted blending, bilabial priority, minimum viseme duration, anticipation using the audio lookahead.
- [ ] **Neural audio-to-blendshape model** in a Worker (ONNX Runtime Web, WebGPU with WASM fallback), with the P1 estimator as the fallback path. Check licenses and training-data terms before choosing a model.
- [ ] Jaw and lips decoupled (jaw from energy and open vowels, lips from shapes); loudness-scaled excursion; mild under-articulation.
- [ ] Per-rig tuning table (jaw gain, viseme gains) so new avatars can be tuned without code.

**Done when:** closure accuracy at least 95 %, viseme timing error median under 40 ms, blind A/B prefers P2 over P1 on most clips.
**Files:** `avatar/engine/LipSyncEngine.ts`, new `avatar/lipsync/` module, `public/models/` for the model file.

### P3: Expression, body and "aliveness" (8-10 days); can run alongside P2

**Goal:** the whole character looks like it is thinking and speaking, not just the mouth.

- [ ] **Prosody engine:** pitch and energy peaks trigger small head nods, brow raises and eyelid emphasis; blinks at phrase boundaries.
- [ ] **Emotion that follows meaning:** the model reports emotion changes (via tools, see P4) or a lightweight text classifier over the transcript; smooth, slow transitions with a return to baseline.
- [ ] **Listening behaviour:** nods, small smiles, gaze shifts, and "thinking" glances while the user speaks and while waiting.
- [ ] **Gesture library:** beat gestures (small hand and arm motion on stressed words), pointing, open palms, shrug, wave, thumbs up, with blend in/out and an idle hand pose. Authored as pose clips on the existing pose system.
- [ ] **Idle variety:** weight shifts, breathing, micro head turns, so repeated idle never looks looped.
- [ ] Eye contact model: look at camera with natural saccades and occasional glance-aways.

**Done when:** a 60-second conversation clip shows no frozen face or body and no obviously looped motion; ratings from a short viewer test (5-7 people) of "natural" at least 4 out of 5.
**Files:** new `avatar/engine/ProsodyEngine.ts`, `GestureEngine.ts`, `avatar/pose/poses.ts` (gesture clips), `BehaviorController.ts`.

### P4: Voice and conversation brain (8-12 days); can run alongside P2/P3

**Goal:** a configurable character that knows things and can act, not a blank voice.

- [ ] **Persona and system instruction:** name, role, tone, language, boundaries; editable in the UI and saved with the look. Wire into `liveConfig` (`services/gemini/config.ts`).
- [ ] **Function calling:** tools the model can call, such as `set_emotion`, `play_gesture`, `look_at`, `change_background`, so expression comes from the model's intent, not only from audio.
- [ ] **Voice choice** and language selection; per-language mouth-shape tuning where needed.
- [ ] **Knowledge:** document upload or URL ingest with retrieval, exposed to the model as a tool; citations shown in the transcript.
- [ ] **Memory:** short-term (sliding window, already configured) plus optional long-term notes per user.
- [ ] **Latency work:** measure time to first audio; warm session setup; pre-create the token while the page loads; show a thinking animation immediately.
- [ ] **Robustness:** reconnect UX, clear error states, offline/no-key message, text-only fallback mode, captions toggle.

**Done when:** the avatar can be given a persona, answer from an uploaded document, change its own expression through a tool call, and recover from a dropped connection without a page reload.
**Files:** `services/gemini/config.ts`, `GeminiLiveClient.ts`, `hooks/useAvatarConversation.ts`, new `services/knowledge/`, `components/avatar/PersonaPanel.tsx`.

### P5: Visual fidelity (8-12 days); can run alongside P3/P4

**Goal:** the avatar and scene look premium.

- [ ] **Image-based lighting:** HDRI environment maps tied to the lighting presets, with soft shadows and contact shadows.
- [ ] **Skin and eye shading:** subsurface-style skin approximation, specular and roughness polish, eye cornea highlight and refraction, wet-line, correct eyelash and hair transparency sorting. (Note the current rig exports an unusable eye-occlusion layer, which is hidden; re-author it.)
- [ ] **Post-processing, light-touch:** SSAO, subtle bloom, tone mapping, anti-aliasing; configurable.
- [ ] **Texture pipeline:** KTX2/Basis compression, mipmaps, 1K and 2K tiers chosen by device.
- [ ] **Camera and framing:** presets (headshot, bust, full body), depth of field, smooth transitions, automatic framing for the chosen pose.
- [ ] **Backgrounds:** image, video, blur, solid colour, transparent (for embedding), alongside the existing lighting presets.

**Done when:** side-by-side screenshots against the reference products look comparable in a blind test; no perceptible frame drop on a mid laptop.
**Files:** `components/avatar/AvatarScene.tsx`, `SceneBackdrop.tsx`, new `components/avatar/PostFx.tsx`, `public/hdri/`.

### P6: Avatar creation and customization (10-15 days); depends on P5 for previews

**Goal:** users bring their own character without engineering help.

- [ ] **Avatar library** (local list plus remote catalogue), with thumbnails and a one-click switch.
- [ ] **Upload flow:** drag-and-drop GLB, **validation report** (size, polycount, texture sizes, missing morphs and bones), automatic compression suggestion.
- [ ] **Rig mapping wizard:** auto-detect Character Creator, ARKit, VRM, Mixamo and Ready Player Me naming; show which engine channels are missing; let the user fix the mapping visually and save it as a rig profile (replaces hand-editing `modelProfile.ts`).
- [ ] **VRM and Ready Player Me import** (broad ecosystem coverage).
- [ ] **Wardrobe:** swappable clothes and hair via mesh visibility and material variants.
- [ ] **Branding:** logo, colours, name, favicon per avatar profile.

**Done when:** a third-party GLB or VRM can be loaded, mapped and animated end to end in under 10 minutes with no code changes.
**Files:** new `avatar/rig/` (detectors, profiles), `components/avatar/UploadPanel.tsx`, `modelProfile.ts` becomes data-driven.

### P7: Studio features (video, scripts, timeline) (15-25 days); depends on P1-P3, P5

**Goal:** match what content-creation tools offer.

- [ ] **Script to speech to animation:** paste text, choose a voice, generate audio and a viseme track in one step (TTS with visemes or the P2 model).
- [ ] **Video export:** deterministic offline renderer (fixed time step) to WebM/MP4 using WebCodecs or `MediaRecorder`, with captions burned in or as a sidecar file, and transparent-background option.
- [ ] **Timeline editor:** tracks for speech, expression, pose, gesture, camera and lighting with keyframes and easing; scrub and preview.
- [ ] **Scenes and templates:** multiple scenes per project, reusable templates (presenter, support agent, tutorial).
- [ ] **Projects:** named projects with import/export as JSON, optional cloud sync later; autosave and version history. (Today there is one browser-only saved slot.)

**Done when:** a 60-second scripted video exports at 1080p with synced audio and captions, and a project round-trips through export and import unchanged.
**Files:** new `avatar/timeline/`, `services/export/`, `components/studio/`.

### P8: Embedding, API and deployment (10-15 days); depends on P4

**Goal:** make it something other people can use.

- [ ] **Embeddable widget:** web component and iframe with a small JS API (`mount`, `say`, `setEmotion`, events); auto-sizing; transparent mode.
- [ ] **Public-safe token service:** authentication, per-user and per-origin rate limits, usage metering, secret rotation. (The token route is intentionally localhost-only today.)
- [ ] **Hosting guide and CI/CD:** container image, environment configuration, preview deployments.
- [ ] **Observability:** client error reporting, session analytics (opt-in), latency histograms, cost tracking per session.
- [ ] **CMS/admin:** manage avatars, personas, knowledge and keys without touching code (the repository name suggests a CMS goal; confirm the intended scope).

**Done when:** the widget works on an unrelated third-party page in under 5 lines of code, with authenticated, rate-limited sessions and visible error and latency metrics.
**Files:** new `app/api/`, `packages/embed/`, `services/telemetry/`.

### P9: Performance, compatibility and accessibility (7-10 days); continuous

**Goal:** works well everywhere, for everyone.

- [ ] **Load time:** production-build budget, progressive model and texture loading, preloading hints, server compression, CDN caching; skeleton while loading (already added) plus real progress.
- [ ] **Quality tiers:** automatic downgrade (resolution, shadows, post effects) from measured frame time; manual override.
- [ ] **Mobile:** touch controls, safe areas, smaller textures, battery-aware frame cap, microphone permission flow on iOS and Android.
- [ ] **WebGPU** path where available, with the WebGL fallback kept.
- [ ] **Accessibility:** captions, transcript downloads, keyboard operation everywhere, screen-reader labels, reduced-motion mode applied to all new motion, colour-contrast audits (dark and light).
- [ ] **Internationalisation:** UI strings externalised; right-to-left layout check.
- [ ] **Browser matrix:** document and test current Chrome, Edge, Firefox and Safari (desktop and mobile); today only a Chromium browser has been used.

**Done when:** budgets in section 3 are met on a defined device matrix, and an automated accessibility scan passes with no serious violations.

### P10: Trust, safety and compliance (5-8 days); before any public release

**Goal:** be safe to put in front of strangers.

- [ ] **Disclosure:** visible "AI avatar" notice; consent screen before microphone use; clear data-handling text.
- [ ] **Content safety:** configure model safety settings; moderate transcripts; block disallowed topics via the persona and server-side checks; abuse and rate limits.
- [ ] **Privacy:** data-retention rules, delete-my-data, no audio stored by default, cookie and storage disclosure.
- [ ] **Likeness and asset rights:** license record for every model, texture and HDRI; consent flow if users upload real people's likeness; optional watermark for exported video.
- [ ] **Security review:** key handling, token scope, CSP and CORS, dependency audit, secret scanning (a `check-client-secrets` script already exists; wire it into CI).

**Done when:** a written threat model and privacy notice exist, and the checklist passes review by someone other than the author.

### P11: Quality engineering and release (ongoing, set up early)

**Goal:** keep every earlier gain from regressing.

- [ ] **Test pyramid:** keep unit tests for engines; add **visual regression** (Playwright screenshots of fixed poses and expressions); add **end-to-end** tests for save/restore, connect flow with a mocked Gemini, and upload flow.
- [ ] **Performance budget in CI:** fail the build when bundle size, model size or measured frame time regress.
- [ ] **Reference-clip scoring in CI:** lip-sync metrics from section 3 compared with the baseline.
- [ ] **Release process:** semantic versions, changelog, demo deployment per pull request.
- [ ] **Documentation:** quick start, API reference for the engine and embed SDK, rig-mapping guide, troubleshooting, and a short demo video.

---

## 5. Suggested timeline (one to two engineers)

| Weeks | Focus | Outcome you can demo |
| --- | --- | --- |
| 1 | P0, start P11 | Baseline numbers, debug overlay, screenshot tests running |
| 2-3 | P1 | Tighter sync and distinct mouth shapes |
| 3-6 | P2 + P3 (parallel) | Fluid lip-sync, nods, gestures, listening behaviour |
| 4-7 | P4 (parallel) | Persona, tool-driven expressions, knowledge, voices |
| 6-9 | P5 | Premium look: HDRI, skin and eye shading, post effects |
| 9-12 | P6 | Bring-your-own avatar with a mapping wizard |
| 12-17 | P7 | Script-to-video export and a timeline |
| 15-19 | P8 + P10 | Embeddable widget, public-safe API, safety review |
| Continuous | P9, P11 | Performance, accessibility, regression guards |

Total: about 4-5 months for one engineer, 2.5-3 months for two working in parallel (P2/P3/P4 and P5/P6 split well).

---

## 6. If you can only do a few things: the "feels competitive" slice

In order of visible impact per day of work:

1. **P0** (measure) and **P1** (lag removal and viseme shapes): the single biggest perceived upgrade.
2. **P4 persona plus tool-driven emotion**: turns a voice into a character.
3. **P3 prosody nods, brows and listening behaviour**: removes the "frozen face" feel.
4. **P5 image-based lighting and eye and skin polish**: lifts every screenshot and demo.
5. **P7 video export**: unlocks the main use case of video-avatar platforms.
6. **P8 embed widget**: lets other people actually use it.

---

## 7. Decisions to make early

| Decision | Options | Recommendation |
| --- | --- | --- |
| Lip-sync source | Classical features only / neural model / TTS with viseme events | Classical first (P1), neural second (P2) with classical as fallback; add TTS visemes only if exact timing for scripted video matters more than Gemini's native voice |
| Rendering target | Stay browser real-time / add server-side video rendering | Browser real-time; add server rendering later only for batch video export if needed |
| Avatar standard | Character Creator naming / ARKit / VRM | Support all through the mapping wizard; make VRM the interchange format |
| Product shape | Studio app / embeddable widget / both | Both: Studio for authoring, widget for delivery |
| Hosting and keys | Self-hosted only / managed service | Self-hosted first; design the token service so a managed version is possible |
| Monetisation and licensing | Open source / commercial | Decide before P6, because third-party avatar and HDRI licenses constrain what can ship |

---

## 8. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Neural lip-sync model licensing or size | Blocks P2 | Evaluate two models early with license review; keep the classical fallback |
| Gemini Live model, voice and API changes | Breaks P4 | Pin versions, keep adapters thin, keep protocol tests (already mocked) |
| Rig quality (closures, teeth, tongue, correctives) | Caps visual accuracy regardless of code | Rig checklist in the lip-sync guide; budget art time or buy a better base avatar |
| Mobile performance and audio quirks | Poor reach | Quality tiers and a device matrix from P9; test on real devices early |
| Scope creep from "match everything" | Never ships | Use section 6 as the release gate; ship P0-P5 as a coherent v1 |
| Single-person bus factor | Delays | Keep docs and tests current as part of every phase |

---

## 9. Definition of done for the whole programme

- [ ] Section 3 scorecard met on the defined device matrix.
- [ ] Hands-on comparison table (section 2) shows **Parity** or better on lip-sync, latency, expression, fidelity and embedding against two named real-time 3D competitors.
- [ ] A new avatar can be added, mapped and tuned without code.
- [ ] A scripted video can be exported, and the embed widget works on a third-party page.
- [ ] Safety, privacy and licensing checklists signed off.
- [ ] CI enforces tests, visual regression, size and performance budgets.

---

## 10. Backlog checklist (copy into your tracker)

`P0` baseline overlay and clips · `P0` ground truth alignment · `P1` audio-clock sampler · `P1` single-stage smoothing · `P1` calibrated loudness · `P1` viseme estimator · `P2` coarticulation · `P2` neural audio-to-blendshape · `P2` per-rig tuning table · `P3` prosody engine · `P3` emotion from model intent · `P3` listening behaviour · `P3` gesture library · `P3` idle variety and eye contact · `P4` persona and system instruction · `P4` function calling tools · `P4` voices and languages · `P4` knowledge retrieval · `P4` latency and reconnect work · `P5` HDRI lighting · `P5` skin and eye shading · `P5` post-processing · `P5` KTX2 textures · `P5` backgrounds and framing · `P6` avatar library · `P6` upload and validation · `P6` rig mapping wizard · `P6` VRM and Ready Player Me import · `P6` wardrobe · `P7` script to speech to animation · `P7` video export · `P7` timeline · `P7` projects and templates · `P8` embed widget · `P8` public-safe token service · `P8` observability · `P8` CMS/admin · `P9` load budget and tiers · `P9` mobile · `P9` accessibility and i18n · `P9` browser matrix · `P10` disclosure and consent · `P10` content safety · `P10` privacy and licensing · `P10` security review · `P11` visual regression · `P11` end-to-end tests · `P11` performance budgets in CI · `P11` release and docs
