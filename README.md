<div align="center">

<img src="public/logo.png" alt="Avatar Studio logo: a translucent circuit-board robot head in profile" width="160" />

# Avatar Studio — Rigged 3D AI Avatar with Gemini Live Voice Chat

**A local-first Next.js app that renders a rigged GLB avatar in the browser with React Three Fiber, animates it with a framework-independent engine (blinking, gaze, emotions, lip-sync, ten body poses), and lets you talk to it in real time through the Google Gemini Live API.**

[Features](#features) · [Quick start](#quick-start) · [Usage](#usage) · [Configuration](#configuration) · [Architecture](#architecture) · [FAQ](#faq)

</div>

---

## Why Avatar Studio?

Most "talking avatar" demos are either a video loop or a closed SaaS. Avatar Studio is a complete, hackable reference for building an **interactive 3D AI avatar** that runs on your own machine:

- a **real-time 3D viewer** for rigged `.glb` characters (morph targets and skeleton),
- a **procedural animation engine** that keeps the avatar alive (blinking, gaze, idle sway) and expressive (emotions, visemes, body poses),
- a **voice conversation loop** with Gemini Live: microphone in, streamed audio out, mouth movement driven by what is actually audible,
- a **save-and-share workflow**: design the look in the Studio, save it once, and the conversation page renders the exact same avatar.

Good fit for: AI assistant and virtual-host prototypes, VTuber-style tools, support-agent avatars, game NPC dialogue experiments, rig and blendshape inspection, and learning real-time WebGL plus audio.

## Features

### 3D avatar viewer
- Loads a rigged GLB (Character Creator or ARKit-style morph targets) with orbit, zoom, full-body and face-view cameras.
- Nine **scene lighting presets** (Day, Evening, Dawn, Night, Moon, Full moon, Studio dark, Neon, Forest) plus **fully custom lighting**: sky and floor colors, stars, a moon or sun disc, key and rim lights (color, intensity, direction, height), ambient and sky bounce.
- Model inspector: meshes, bones, morph-target sliders, bone rotation sliders and a scene inventory.

### Animation engine (framework-independent TypeScript)
- Priority-based layer mixer with smooth, frame-rate-independent blending.
- Natural **blinking, gaze and idle motion**, **six emotions** (neutral, happy, sad, angry, surprised, thinking) with adjustable intensity, and a reduced-motion mode.
- **Lip-sync**: amplitude-driven jaw plus 15 viseme shapes, gated by real playback so the mouth never moves before you hear audio.
- **Ten body poses**: T-pose, A-pose, arms up, one arm up and one down, elbows bent, hands behind head, deep squat, one-leg balance, torso twist with head turn, and an animated wave. A **custom pose editor** adds per-bone sliders, left/right mirroring, named saves and copy-as-JSON.

### Gemini Live voice conversation
- Microphone capture with an `AudioWorklet`, PCM resampling and queued low-latency playback.
- **Ephemeral tokens** are minted on the server, so your Gemini API key never reaches the browser.
- Session resume and reconnect handling, interruption (barge-in) support and a live transcript.
- A dedicated conversation page with connection status, microphone and speaker controls, and a message box.

### Save once, render everywhere
- **Save look** stores pose, expression, gaze, behavior switches, lighting and camera.
- `/avtaar-connected` opens with that saved look automatically, and the saved expression becomes the avatar's baseline between conversations.

### Interface
- A modern studio UI with **dark and light mode** (follows your system, applied before first paint), a tabbed sidebar with its own scrollbar (Poses, Face, Behavior, Lighting, Inspect), and a responsive layout.

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | [Next.js](https://nextjs.org/) 16 (App Router), React 19, TypeScript |
| 3D rendering | [three.js](https://threejs.org/), [@react-three/fiber](https://r3f.docs.pmnd.rs/), [@react-three/drei](https://github.com/pmndrs/drei) |
| Voice AI | [Google Gemini Live API](https://ai.google.dev/) via [`@google/genai`](https://www.npmjs.com/package/@google/genai) |
| Audio | Web Audio API, AudioWorklet, 16-bit PCM |
| Styling | CSS design tokens, Tailwind CSS 4 |
| Testing | Node test runner with `tsx` (Gemini and audio are mocked; no API calls) |

## Quick start

**Requirements:** Node.js 20 or newer, a browser with WebGL 2, and, for voice chat, a [Gemini API key](https://aistudio.google.com/apikey).

```bash
git clone https://github.com/niks-nikhil-anand/Avtaar-Rigged-CMS.git
cd Avtaar-Rigged-CMS
npm install
cp .env.example .env.local   # then add your GEMINI_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the Studio and [http://localhost:3000/avtaar-connected](http://localhost:3000/avtaar-connected) for the conversation page. The Studio works without an API key; only voice chat needs one.

## Configuration

Create `.env.local` (never commit it):

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | For voice chat | Server-only credential used to mint short-lived Live tokens. Never prefix it with `NEXT_PUBLIC_`. |
| `GEMINI_LIVE_MODEL` | No | Live model id. Defaults to `gemini-3.8-live`. |

The token endpoint (`POST /api/gemini/token`) answers only requests from `localhost`, is rate limited, and returns single-use tokens.

## Usage

1. **Design the look in the Studio** (`/`). Choose a pose, expression, gaze and lighting using the Poses, Face, Behavior and Lighting tabs.
2. Click **Save look**. Your choices are stored in the browser (`localStorage`).
3. Open **Connect avatar** (`/avtaar-connected`). The avatar appears exactly as saved. Click **Connect to Gemini**, start the microphone and talk.

Tips: use *Face view* for close-ups, the background dots on the canvas to switch scenes instantly, and *Copy JSON* in the custom pose editor to keep poses in version control.

## Bring your own avatar

Any rigged GLB works if it has facial morph targets and a skeleton.

1. Put the file in `public/`. Keep large originals out of the web bundle: a compressed copy loads much faster.
2. Point `url` in [`avatar/model/modelProfile.ts`](avatar/model/modelProfile.ts) at it.
3. Map your rig's names to the engine's in the same file: `morphAliases` (expressions and visemes), `boneAliases` (head, eyes, spine, limbs) and `boneAxes` (for bones whose local axes differ).
4. Adjust pose angles in [`avatar/pose/poses.ts`](avatar/pose/poses.ts) if your skeleton's axes differ.

The bundled model is `public/avtaar-rigged-blender/Untitled.slim.glb`, a compressed (meshopt geometry, WebP textures) copy of a Character Creator export.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` and `npm start` | Production build and server |
| `npm test` | Unit tests (mocked; no network or API quota) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run test:live` | Optional real Gemini smoke test; needs the app on `localhost:3001` and consumes API quota |

## Architecture

```
app/                      Routes: / (Studio), /avtaar-connected, /api/gemini/token
components/avatar/        Viewer, scene, sidebar panels (poses, face, behavior, lighting), Gemini panel
avatar/engine/            Animation engine: mixer, facial, eyes, idle, emotion, lip-sync
avatar/pose/              Pose presets and the pose controller
avatar/state/             Save and restore of the whole avatar look
avatar/model/             Model inspection and rig name mapping
avatar/conversation/      Playback-driven conversation coordinator
services/audio/           Microphone capture, PCM utilities, queued player
services/gemini/          Live client, config, token policy
hooks/                    useAvatarConversation
docs/                     Phase-by-phase guides and verification checklists
tests/                    Engine, pose, state, conversation, audio and Gemini tests
```

Design rules: React components render UI and forward commands; engines depend only on model bindings and delta time; audio playback is the timing source for lip-sync; the conversation hook owns service lifecycles; server credentials never enter browser code.

### Documentation

- [Architecture and implementation phases](docs/architecture.md)
- [Model inspection findings](docs/model-inspection.md)
- [Phase 01: viewer verification](docs/phase-01-verification.md)
- [Phase 02: animation engine API](docs/phase-02-engine.md)
- [Phase 03: natural behavior and emotions](docs/phase-03-behavior.md)
- [Phases 04–05: audio and Gemini Live](docs/phase-04-05-audio-live.md)
- [Phase 06: conversation and lip-sync](docs/phase-06-conversation.md)
- [Phase 07: poses, themes, saved looks and the Connected page](docs/phase-07-poses.md)
- [Precise real-time lip-sync guide: HeyGen/Synthesia-level roadmap](docs/lip-sync-guide.md)
- [Enhancement roadmap: step-by-step plan to competitor-level quality](docs/enhancement-roadmap.md)

## Privacy and security

- Your API key stays on the server in `.env.local`; the browser only receives short-lived, single-use tokens.
- Microphone audio is sent to Google Gemini only while connected and the microphone is on.
- Saved looks and custom poses live in your browser's `localStorage`; nothing is uploaded.

## FAQ

**Does it need an API key?** Only for voice conversation. The viewer, poses, expressions, lighting and saving all work without one.

**Which browsers work?** Development and testing used a Chromium-based browser. Other current browsers with WebGL 2 should work but are untested. Microphone capture needs `https` or `localhost`.

**Can I use a different avatar or voice?** Yes. See [Bring your own avatar](#bring-your-own-avatar), set `GEMINI_LIVE_MODEL` for the model, and change the voice in `services/gemini/config.ts`.

**Why is the first load slow in development?** The dev server compiles on demand and the GLB is parsed in the browser. A production build (`npm run build && npm start`) starts faster.

**Can I deploy it publicly?** The token endpoint is deliberately limited to `localhost`. Add your own authentication and rate limiting before exposing it.

## Contributing

Issues and pull requests are welcome. Please run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` before opening a PR.

---

<sub>Keywords: 3D AI avatar, talking avatar, Gemini Live API, Google Gemini voice chat, Next.js, React Three Fiber, three.js, GLB viewer, rigged character, morph targets, blendshapes, lip sync, visemes, procedural animation, real-time voice assistant, virtual human, digital human, WebGL.</sub>
