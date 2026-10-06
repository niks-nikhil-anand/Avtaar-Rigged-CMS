# Local Avatar Engine

Next.js application for a local rigged avatar with Gemini Live voice integration.

Phase 01 is implemented: a responsive GLB viewer with lighting, ground shadows, camera controls, morph presets, individual sliders, bone controls, and runtime model inventory. See [manual verification](docs/phase-01-verification.md), [architecture and implementation phases](docs/architecture.md), and [model inspection findings](docs/model-inspection.md).

Phase 02 adds the central animation engine, smooth facial blending, per-channel priorities, pause/resume, reset/cleanup, and a synthetic blend demo. See [engine API and manual verification](docs/phase-02-engine.md).

Phase 03 adds a relaxed pose, natural blinking/gaze, procedural idle motion, six emotions, behavior transitions, reduced motion, and an amplitude/viseme mouth interface. See [behavior API and manual verification](docs/phase-03-behavior.md).

Phases 04–05 add AudioWorklet microphone capture, PCM resampling and queued playback, playback-driven mouth movement, server-issued ephemeral tokens, and Gemini Live audio/text conversations on `/avtaar-connected`. Set `GEMINI_API_KEY` in `.env.local` and restart the server. See [audio and Gemini verification](docs/phase-04-05-audio-live.md).

Phase 06 extracts `useAvatarConversation`, centralizes conversation behavior, adds silence gating and immediate speech resets, and exposes emotion commands with a neutral fallback. See [lip-sync integration and manual checks](docs/phase-06-conversation.md). Automatic phoneme timing remains optional until an audio-analysis system is validated.

Phase 07 adds ten selectable body poses with a custom pose editor, 9 scene backgrounds, and rig-specific expression mapping. See [poses and rig mapping](docs/phase-07-poses.md).

Run `npm run test:live` with the app running on localhost:3001 for an optional real Gemini PCM-input smoke test. It sends Google's public audio sample and consumes API quota; ordinary `npm test` uses mocks and makes no Gemini calls.

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` for project verification.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
