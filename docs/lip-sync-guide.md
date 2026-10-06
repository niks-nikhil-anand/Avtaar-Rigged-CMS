# Precise real-time lip-sync: from "mouth opens with volume" to HeyGen / Synthesia quality

This guide explains what separates a good talking avatar from a believable one, where this project stands today, and a staged plan to close the gap. It is written for this codebase: file names and numbers refer to the code as it is now.

> **Honest scope note.** HeyGen and Synthesia do not publish their internals, so statements about them below describe the *general* approach of that product class (neural audio-to-video generation), not their exact systems. The practical target for this project is a **3D, rigged, real-time avatar** whose mouth is indistinguishable from "correct" at normal viewing distance. That is achievable. Photoreal video generation is a different technology and is covered only to explain the difference.

---

## 1. Where we are today

| Part | What the code does now | Limit |
| --- | --- | --- |
| Audio source | Gemini Live returns **audio only** (PCM) plus text transcripts. No phonemes, visemes or word timings. | Mouth shapes must be inferred from audio. |
| Measuring speech | [`PcmPlayer`](../services/audio/PcmPlayer.ts) reads an `AnalyserNode` on the **output** every animation frame, takes RMS of a 512-sample window and scales it by 5. | One number (loudness) at roughly 60 Hz. No information about *which* sound is being made. |
| Lip shape | [`LipSyncEngine`](../avatar/engine/LipSyncEngine.ts) turns that amplitude into `jawOpen` (`smoothed * 0.75`). Visemes exist (15 shapes, `visemeJaw` openings) but are only set by the sidebar buttons, never from speech. | Every sound looks like "ah". No closed lips for P/B/M, no teeth for F/V, no rounding for O/U. |
| Smoothing chain | RMS window -> `LipSyncEngine` smoothing (attack 30/s, release 45/s) -> `FacialEngine` damping (14/s) -> bone damping (14/s for the jaw bone). | The stacked smoothing adds roughly **60-100 ms of lag** and rounds off fast consonants. |
| Clock | `requestAnimationFrame` (display rate, jittery in background tabs) with `delta` clamped to 0.1 s. | Frame-time jitter becomes sync jitter. |
| Secondary motion | Idle sway, blinking, gaze, emotion presets. | Not coupled to the voice (no prosody-driven nods, brows or blink timing). |

**Summary:** timing is *approximately* right because the analysis reads what is actually playing, but shape accuracy is the gap. Fixing shape accuracy and removing avoidable lag gets most of the way to "professional".

---

## 2. What HeyGen and Synthesia do differently

- They are **generative video** systems. A neural network takes audio (and a reference face or avatar identity) and renders new video frames: mouth, jaw, cheeks, teeth, head motion and expression together. There is no blendshape rig to tune.
- Their quality comes from **large training data of real speakers**, learned coarticulation (how neighbouring sounds change each other) and learned head, brow and blink behaviour tied to speech rhythm.
- Synthesia-style products render **offline** (seconds to minutes per clip), so they can use big models and several passes. HeyGen's interactive/streaming avatars render **on the server** and stream video over WebRTC, so the model runs on server GPUs.

What this means for us:

| Path | Quality ceiling | Latency | Cost | Fits this project |
| --- | --- | --- | --- | --- |
| Rig + classical audio features (Stage 2) | Good, stylized | < 50 ms added | none | Yes, first step |
| Rig + coarticulation + neural audio-to-blendshape (Stages 3-4) | Very good | 100-250 ms lookahead, hidden by the audio queue (see 4.2) | model file, some GPU/CPU | Yes, the recommended target |
| Server-rendered video avatar (HeyGen-style streaming) | Photoreal | 300 ms-1 s+ | per-minute API cost | A different product; use a vendor API |

---

## 3. What "perfect" means: the five things viewers notice

1. **Timing.** Humans notice audio-video offset above about **+45 ms (audio early)** or **-125 ms (audio late)** (ITU-R BT.1359 detectability thresholds; acceptability limits are wider, about +90 / -185 ms). Target: mouth within **+/-40 ms** of the sound. Audio leading is the worse failure, so err towards a mouth that is *slightly early*, never late.
2. **Closures.** P, B, M must fully close the lips; F and V must tuck the lower lip under the upper teeth. Viewers spot a missed closure instantly. These are the highest-value shapes.
3. **Rounding and spread.** O/U/W round and protrude the lips; EE/I spread them. Vowels are visible mostly in the lips, not in jaw height.
4. **Coarticulation.** Real mouths do not hit each shape in sequence: they start forming the next one early (anticipation) and keep some of the last one (carry-over). Without this the mouth looks robotic or "over-articulated".
5. **Everything around the mouth.** Subtle head nods on stressed words, brow raises on emphasis, blinks at phrase boundaries, and eye contact make speech feel alive. A perfect mouth on a frozen face still looks wrong.

---

## 4. Architecture for precise timing

### 4.1 Use the audio clock, not the frame clock

All speech animation should be a function of **`AudioContext.currentTime`**, because that is the clock the speaker obeys. The render loop only *samples* it.

```ts
// Conceptual: sample the viseme track at the moment the listener hears it.
const heard = context.currentTime - (context.outputLatency || context.baseLatency || 0);
const channels = visemeTrack.sample(heard);   // pure function of audio time
```

`outputLatency` (where supported) accounts for the sound card and OS buffering; without it the mouth is early by tens of milliseconds on many devices. Add a user-visible **sync offset slider** (-100..+100 ms) as an escape hatch, since Bluetooth headphones add 100-200 ms that no API reports reliably.

### 4.2 Analyse ahead of playback (free lookahead)

Gemini streams audio faster than real time, so `PcmPlayer` usually holds hundreds of milliseconds to seconds of audio **before** it plays (`queuedSeconds`, `nextStart`). That queue is a gift: it lets any analysis (classical or neural) run on audio *that has not played yet*, with no added latency.

```
Gemini chunk arrives --> PcmPlayer.enqueue(bytes)  --> scheduled at start time S (audio clock)
                     \-> viseme worker analyses the same PCM (lookahead)
                         emits events: { audioTime: S + offsetInChunk, viseme, weight }
Render loop: sample events at (currentTime - outputLatency)
```

Each scheduled buffer already has a known start time (`start` in `PcmPlayer.enqueue`), so every analysed frame maps to an exact playback moment. Interruption (`PcmPlayer.stop`) must clear the pending events too.

### 4.3 Remove stacked smoothing

Today speech motion is smoothed three times (see section 1). Replace with **one** deliberate filter:

- For speech morphs (`jawOpen`, visemes, lip corners) use a **faster, asymmetric** response: attack about 60-90/s (time constant 11-17 ms), release about 25-40/s (25-40 ms). Opening quickly and closing slightly slower looks natural and keeps plosives crisp.
- Give `FacialEngine` per-channel damping (it already special-cases `eyeBlink*` at 45/s): add the same for speech channels instead of the global 14/s.
- Do the same for the jaw **bone** path in `AvatarEngine.update` (the 14/s bone smoothing currently softens speech too).

Expected effect: 60-100 ms less perceived lag and noticeably sharper consonants, before any new model is added.

### 4.4 A stable update loop

- Keep `delta` clamped, but drive speech from audio time (4.1), so a slow frame never shifts the mouth in time, it only drops frames.
- Avoid allocations in the frame loop (reuse arrays, avoid `Map` churn in hot paths); garbage-collection pauses show up as sync glitches.
- Move heavy analysis to a **Worker** or `AudioWorklet`. Never run FFT or inference on the main thread next to rendering.
- Log frame time. If the 95th percentile exceeds about 20 ms, lip-sync quality is limited by rendering, not by the model.

---

## 5. Staged roadmap

Each stage is independently shippable and measurable (see section 7).

### Stage 0: Measure first (1-2 days)
- Build a **debug overlay**: waveform, current viseme weights, frame time, and the measured audio-to-mouth offset.
- Record 10-15 reference clips (varied speakers, fast and slow speech, plosive-heavy sentences such as "Peter Piper picked a peck of pickled peppers", names, numbers).
- Create ground truth with a **forced aligner** (Montreal Forced Aligner or a wav2vec2-based aligner) from audio plus transcript, giving phoneme boundaries to score against.

### Stage 1: Fix latency and clocks (1-2 days)
- Sample on audio time with `outputLatency` compensation (4.1) and add the sync-offset setting.
- Replace the stacked smoothing with per-channel attack/release (4.3).
- Replace the `rms * 5` scaling with a **calibrated loudness** (dBFS mapped to 0-1 with a noise floor and a short running maximum), so quiet and loud voices both move the jaw sensibly.

### Stage 2: Audio features to visemes, no model (3-5 days)
Run in an `AudioWorklet` or Worker on the queued PCM (4.2), 10 ms hop, 25 ms window:

| Feature | How | Detects |
| --- | --- | --- |
| Energy (dB) | RMS of the window | Speech vs silence, overall opening |
| Zero-crossing rate + high-band ratio | Count sign changes; FFT energy above about 4 kHz vs below | Fricatives S, SH, F, TH, "ch" |
| Energy onset after silence | Sudden rise following a short quiet gap | Plosive bursts P, B, T, D, K, G |
| Spectral centroid and rolloff | FFT | Bright (EE, S) vs dark (OO, M) |
| Formants F1, F2 | LPC (order about 12), pick peaks | Vowel class (see below) |

Vowel classification from formants (typical adult ranges, approximate):

| Vowel class | F1 | F2 | Viseme |
| --- | --- | --- | --- |
| open (a) | high (above about 650 Hz) | mid | `aa` |
| front closed (i, e) | low-mid | high (above about 1800 Hz) | `ih`, `E` |
| back rounded (o, u) | low-mid | low (below about 1200 Hz) | `oh`, `ou` |

Then map the labels to our 15 visemes (`CH DD E FF PP RR SS TH aa ih kk nn oh ou sil`) and call `LipSyncEngine.setViseme(...)` with soft weights (a vowel is rarely 100 % one class). Classical features are coarse (they separate roughly 6-8 mouth classes, not 15) but already remove the "everything is ah" look, and plosive-onset detection gives P/B/M closures.

### Stage 3: Coarticulation and mouth physics (3-5 days)
Make shapes overlap in time instead of switching. The standard model (Cohen and Massaro, 1993) gives each viseme a **dominance** curve around its time centre, and the mouth is the dominance-weighted average of the targets:

```ts
// For each channel c at time t, over nearby segments s:
//   D_s(t) = alpha_s * exp(-theta_s * |t - center_s| ** power)
//   value_c(t) = sum(D_s(t) * target_s[c]) / sum(D_s(t))
```

Practical rules that matter more than the exact formula:
- **Bilabial priority:** P/B/M segments get a high dominance so their closure is never averaged away by neighbouring vowels.
- **Minimum duration:** do not let a viseme be shorter than about 40-60 ms; very short sounds should only *tint* neighbours.
- **Anticipation:** start rounding for an upcoming O/U about 50-100 ms early; this is exactly what the lookahead in 4.2 enables.
- **Loudness scaling:** scale lip excursion by loudness (whispers move less than shouts) but clamp, so quiet speech does not freeze.
- **Don't over-articulate:** reduce total mouth excursion about 15-25 % from "dictionary" shapes; real speakers are lazier than a chart.
- **Jaw vs lips:** drive the jaw (bone on this rig) with energy and open vowels, and lips with the viseme shapes, so they can disagree (closed-lip hum, open-jaw "ah").

### Stage 4: Neural audio to face (1-3 weeks, biggest quality jump)
Replace Stage 2's hand-built classifier with a learned model that outputs **blendshape weights per frame** (about 30-60 Hz) directly from audio. Common options:

| Option | Notes |
| --- | --- |
| Open audio-to-blendshape / speech-animation models (for example research lines such as VOCA, FaceFormer, and NVIDIA Audio2Face) | Output ARKit-style blendshapes; check each model's license and training-data terms before shipping. |
| Small custom model on wav2vec2 / HuBERT features | Train a light regression head from audio features to our morphs; needs paired data (audio plus tracked blendshapes). |
| Run in the browser with ONNX Runtime Web (WebGPU or WASM) in a Worker | Keep inference under about 5 ms per frame; batch over the lookahead window. |

Integration point: the model's output feeds the **same viseme/morph track** as Stage 2, sampled on the audio clock (4.1). Because audio is already queued ahead of playback (4.2), a 100-250 ms model window adds no perceived delay. Keep Stage 2 as the **fallback** when the model is unavailable (low-end device, load failure).

### Stage 5: Alternative timing sources
- **Transcript alignment.** We already receive `outputAudioTranscription`. Aligning transcript text to the audio (CTC forced alignment) gives phoneme times without a neural audio-to-face model. It lags by the transcript delivery time, so use it for *refinement* of finished sentences, not first-frame accuracy.
- **TTS with viseme events.** If the voice is synthesised by a service that emits viseme events (for example Azure Speech visemes or Amazon Polly speech marks), timing is exact and free. The trade-off is giving up Gemini's native-audio voice. A hybrid is possible: Gemini produces the *text*, a TTS with visemes produces the *voice*.

### Stage 6: Performance and life around the mouth (ongoing)
- **Prosody-driven motion:** detect pitch and energy peaks; trigger small head nods and brow raises on stressed syllables, and blinks at phrase boundaries (blink about 100-250 ms after a pause begins).
- **Emotion from content:** map sentiment of the transcript to the existing `setEmotion` baseline shifts, changing slowly (seconds), never per word.
- **Eye contact:** keep gaze near the camera with small saccades; avoid a fixed stare.
- **Listening behaviour:** nods, small smiles and brief gaze shifts while the user speaks (the conversation coordinator already distinguishes listening from speaking).

---

## 6. Rig quality limits what the engine can show

A perfect engine cannot fix a poor rig. Check:

- **Closure shapes:** lips must be able to fully seal (`mouthClose` or an equivalent corrective shape) when the jaw is slightly open; test PP with the jaw at 20 %.
- **Teeth and tongue:** upper teeth must be visible for F/V and the tongue visible for TH, L and D. This rig's tongue and teeth follow the jaw bone, so test with the jaw both open and closed.
- **Lip protrusion and corner shapes:** funnel, pucker, stretch, and smile need to combine without breaking the mesh.
- **Corrective shapes:** blend combinations (open mouth plus smile) should have correctives; otherwise the engine will look wrong even with perfect weights.
- **Standardise the viseme set:** keep the 15 names mapped in `modelProfile.ts` (`morphAliases`), and test each one against a reference chart (Oculus viseme set). Several of ours share one raw rig shape (`oh`/`ou`, `E`/`ih`); if a rig provides more distinct shapes, map them separately.

---

## 7. How to know it is "more perfect": metrics and tests

| Check | How | Target |
| --- | --- | --- |
| **Audio-to-mouth offset** | In the debug overlay, compare viseme onset against audio onset on a click-track clip | within +/-40 ms; never mouth late |
| **Viseme timing error** | Compare estimated viseme boundaries with the forced-alignment ground truth (Stage 0) | median error under about 40 ms, 90th percentile under about 80 ms |
| **Closure accuracy** | Count P/B/M segments where lip closure weight reaches at least 0.9 | at least 95 % |
| **Perceptual sync score** | Screen-record the avatar and score with a SyncNet-style sync measure (LSE-D lower is better, LSE-C higher is better) | compare against the Stage 0 baseline; aim for a clear improvement |
| **Blind A/B test** | 10+ people choose between old and new on the same clips | new preferred in most clips |
| **Frame budget** | Performance panel: frame time p95 | below 16.7 ms at 60 Hz |
| **Regression clips** | Keep the reference recordings and their scores in the repo (small files) | scores must not get worse in CI |

Unit tests can cover the pure parts: the dominance blend, minimum-duration filtering, the audio-clock sampler, and event clearing on interruption, in the same style as `tests/avatar-behavior.test.ts` (fixture engine, deterministic advance).

---

## 8. Recommended order and expected results

| Order | Work | Effort | Visible result |
| --- | --- | --- | --- |
| 1 | Stage 0 overlay and clips; Stage 1 clock and smoothing | 3-4 days | Tighter sync, crisper jaw, measurable baseline |
| 2 | Stage 2 audio features to visemes | 3-5 days | Rounded vs spread lips, plosive closures, "no more ah-only" |
| 3 | Stage 3 coarticulation | 3-5 days | Fluid, natural mouth motion |
| 4 | Stage 6 prosody motion (nods, brows, blink timing) | 3-5 days | Whole face feels alive |
| 5 | Stage 4 neural audio-to-blendshape | 1-3 weeks | Closest to commercial quality on a 3D rig |
| 6 | Stage 5 (alignment or TTS visemes) | optional | Exact timing for scripted speech |

Realistic expectation: stages 1-3 give a large, immediately visible improvement with no new dependencies. Stage 4 adds the last stretch. Matching the photoreal faces of video generators would need a different product (server-rendered video), not more rig tuning.

---

## 9. Where to change the code

| Task | Files |
| --- | --- |
| Audio-time sampler, latency compensation, sync offset | `services/audio/PcmPlayer.ts` (expose scheduled start times), `avatar/conversation/ConversationCoordinator.ts` (sample on audio clock) |
| Analysis worker / worklet | new `services/audio/visemeAnalyzer.ts` plus a worklet in `public/audio/worklets/` |
| Viseme track and coarticulation | `avatar/engine/LipSyncEngine.ts` (replace the single-frame `shapes` map with a time-indexed track) |
| Per-channel speech smoothing | `avatar/engine/FacialEngine.ts` (damping per channel), `avatar/engine/AvatarEngine.ts` (jaw bone smoothing) |
| Jaw and viseme tuning | `avatar/engine/behaviorConfig.ts` (`visemeJaw`, `jawBoneGain`), `avatar/model/modelProfile.ts` (`morphAliases`) |
| Prosody-driven nods and brows | `avatar/engine/IdleEngine.ts` / a new `ProsodyEngine` feeding `BehaviorController` |
| Debug overlay | new component in `components/avatar/` shown next to the Behavior tab |

---

## 10. Further reading (verify current versions and licenses before use)

- Cohen and Massaro, *Modeling coarticulation in synthetic visual speech* (1993): the dominance model above.
- Taylor et al., *A deep learning approach for generalized speech animation* (SIGGRAPH 2017); Karras et al., *Audio-driven facial animation by joint end-to-end learning of pose and emotion* (SIGGRAPH 2017).
- Cudeiro et al., *Capture, learning, and synthesis of 3D speaking styles* (VOCA, 2019); Fan et al., *FaceFormer* (2022).
- Prajwal et al., *Wav2Lip* and Chung and Zisserman, *SyncNet* (the basis of the LSE sync metrics used to score 2D and video lip-sync).
- Tools: Montreal Forced Aligner, Rhubarb Lip Sync (offline phoneme-to-viseme), NVIDIA Audio2Face, Oculus/Meta viseme reference set, ONNX Runtime Web, Azure Speech viseme events, Amazon Polly speech marks.
- ITU-R BT.1359: relative timing of sound and vision for broadcasting (the +45 / -125 ms detectability figures).
