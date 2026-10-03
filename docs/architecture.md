# Local avatar engine architecture

## Folder responsibilities

Keep the existing root-level App Router and `@/*` imports. The installed Next.js project-structure guide supports keeping application modules outside `app/`.

| Folder | Responsibility | Planned files |
| --- | --- | --- |
| `app/` | Routing, layout, and global styles | Existing `page.tsx`, `layout.tsx`, `globals.css` |
| `app/api/gemini/token/` | Server endpoint for short-lived Live credentials | `route.ts` |
| `components/avatar/` | Model rendering, scene, and developer controls | `Avatar.tsx`, `AvatarScene.tsx`, `AvatarDebugPanel.tsx` |
| `components/conversation/` | Chat and voice interface | `Chat.tsx`, `VoiceControls.tsx`, `ConnectionStatus.tsx` |
| `avatar/model/` | Model inspection and runtime binding resolution | `inspectModel.ts`, `resolveBindings.ts`, `modelProfile.ts` |
| `avatar/engine/` | Framework-independent animation controllers | `AvatarEngine.ts`, `FacialEngine.ts`, `EyeEngine.ts`, `IdleEngine.ts`, `EmotionEngine.ts`, `LipSyncEngine.ts`, `AnimationMixer.ts` |
| `audio/` | Microphone capture, PCM conversion, queued playback | `MicrophoneCapture.ts`, `pcm.ts`, `AudioPlayer.ts`, `types.ts` |
| `gemini/client/` | Browser Live session and stream handling | `GeminiLive.ts` |
| `gemini/server/` | Server-only credential creation | `createEphemeralToken.ts` |
| `gemini/` | Shared protocol types without secrets | `types.ts` |
| `hooks/` | React lifecycle and conversation coordination | `useAvatarConversation.ts` |
| `public/audio/worklets/` | Browser-loadable audio processors, when needed | Worklet scripts |
| `public/` | Static model asset | Existing `model.glb` |
| `docs/` | Architecture and model findings | This file, `model-inspection.md` |

Phases 01–03 implement the viewer, model bindings, core engine, natural behavior controllers, relaxed pose, and initial mouth-control interface. See `phase-02-engine.md` and `phase-03-behavior.md` for APIs and verification. Gemini and audio services remain future phases.

## Implementation order and acceptance criteria

1. **Structure:** establish module boundaries and an environment template. Keep the current app runnable.
2. **Model viewer and inspection:** add Three.js, React Three Fiber, and Drei after checking compatible versions. Load `/model.glb`, inspect the loaded scene, resolve all morph-bearing meshes, and expose debug controls. Accept when the model renders and controls are verified visually.
3. **Animation foundation:** implement the central controller, facial blending, eye motion, and procedural idle movement. Compose animation channels before applying weights once per frame. Accept when blink, smile, gaze, and idle movement coexist without overwriting each other.
4. **Audio:** implement input capture and continuous PCM playback. Measure amplitude from scheduled playback rather than network arrival. Accept when playback is continuous and interruption clears all scheduled audio.
5. **Gemini:** verify current official SDK, model, audio formats, and authentication support. Create server-only authentication and the browser Live session. Accept when native audio streams without a permanent credential in browser code.
6. **Integration:** coordinate session state through the hook. Connect audible amplitude to `jawOpen`, then consider viseme estimation. Accept when speech, interruption, expressions, and idle transitions follow actual playback.
7. **Hardening:** add reconnect, cleanup, permission/error states, and performance checks. Accept when session teardown releases microphone tracks, audio nodes, socket connections, and animation resources.

## Runtime boundaries

- React components render UI and forward commands; they do not directly write morph weights.
- Avatar engines consume model bindings and delta time; they do not depend on React or Gemini.
- The facial mixer resolves conflicts per morph/channel. Blink priority must not suppress unrelated mouth movement.
- Audio playback is the timing source for lip-sync. Network chunk receipt does not imply audible speech.
- The conversation hook connects services and owns their lifecycle.
- Server credentials stay in `.env.local`. Server authentication helpers must be marked server-only when implemented.
- Shared types must not import server helpers into the browser.
- Retain the original GLB. Any future compression produces a separate asset until validated.

## Configuration

Copy `.env.example` to `.env.local` when Gemini integration begins, then supply the server credential. The example is tracked; local environment files are ignored. No model identifier is selected until the integration phase verifies current API support.
