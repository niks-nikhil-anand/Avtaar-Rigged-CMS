# Lip-sync reference clips

These compact, deterministic WAV fixtures are used to benchmark playback timing, amplitude response, silence handling, and viseme classification. They are intentionally synthetic so the expected events remain stable across machines and do not depend on a third-party voice service.

Run `node scripts/generate-lip-sync-fixtures.mjs` to regenerate them. The source of truth is the generator; `manifest.json` records the clip metadata.

Coverage:

- Slow, normal, and fast speaking rates.
- A/E/O vowel sequences.
- P/B/M plosive sequences.
- Deliberate silence gaps.
- Low, neutral, and high pitch/timbre profiles.
- Mixed vowel/plosive phrases.
