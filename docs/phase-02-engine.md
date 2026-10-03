# Phase 02: Core animation engine

## Implementation

`AvatarEngine`, `FacialEngine`, and the project `AnimationMixer` have no React or browser dependencies. The viewer captures model bindings before animation begins, creates an engine during effect setup, invokes `update(delta)` from one Fiber `useFrame` callback, and disposes the instance during teardown. A fresh instance is created on each effect setup so development Strict Mode cleanup does not leave a disposed instance active.

- `AvatarEngine`: start/stop, commands, system registration, elapsed time, bone-channel blending, exact reset, and disposal.
- `FacialEngine`: supported morph commands, sparse expression layers, exponential damping, and smooth release to captured rest weights.
- `AnimationMixer`: per-channel priorities and weighted composition. This is the project's layer compositor, not Three.js's animation-clip mixer.
- `createBlendDemo`: synthetic sources for verifying composition, not Gemini audio or the final natural-behavior controllers.

## Channel rules

Channels use `morph:<name>`, `bone:<name>:pitch`, and `bone:<name>:yaw` keys. Phase 03 adds `bone:<name>:roll` and model-specific upper-arm limits. Layers replace their own prior channel contribution when submitted. A missing channel makes no contribution; an explicit zero is a real override.

Default priorities: idle 20, emotion 70, speech 90, blink 100, manual debug 110. Priorities are local to each channel. A blink source cannot suppress an unrelated jaw or smile channel.

Equal-priority sources use a weighted average. Their summed weight determines coverage up to 1. Higher-priority groups blend over the lower-priority result according to their coverage. A full-weight highest-priority source overrides that channel completely. Each source's values are clamped before mixing so out-of-range inputs cannot overpower a partial layer weight. Source identifiers uniquely own a layer; use different identifiers for different systems and manual expressions.

The final morph target is clamped to `[0, 1]`, then damped. Every mesh implementing the same morph receives the composed target. When no source contributes, each mesh returns to its own original weight, including nonzero or differing defaults. Bone offsets are constrained and applied relative to captured rest quaternions, without accumulating rotations.

## Lifecycle and commands

```ts
const engine = new AvatarEngine(bindings);
engine.start();
engine.setExpression({ mouthSmileLeft: 0.7, mouthSmileRight: 0.7 });
engine.setLayer("speech", {
  priority: 90,
  channels: { "morph:jawOpen": 0.5 },
});
engine.addSystem("head-motion", {
  priority: 20,
  update: (_delta, time) => ({ "bone:Head:yaw": Math.sin(time) * 0.05 }),
});
engine.update(1 / 60); // Call from the host frame loop, once per frame.
engine.removeLayer("speech");
engine.resetExpression(); // Smoothly releases the expression source.
engine.stop(); // Holds the current pose and elapsed time.
engine.start(); // Resumes.
engine.reset(); // Immediate exact restoration; removes all layers/systems.
engine.dispose(); // Idempotent cleanup; cannot restart this instance.
```

System updates run once per valid frame. Invalid/zero/negative deltas are ignored. Delta is capped at 100 ms to avoid large motion jumps after a background tab resumes. Exponential damping is frame-rate independent within that cap. Removed or replaced systems receive their optional disposal callback. A failing update is removed and recorded in `engine.errors`; it does not prevent other sources from updating. Engine disposal releases animation sources, not shared GLTF geometry/materials owned by the viewer cache.

React debug controls send commands through the engine. They do not write morph influences or bone transforms. Slider values represent requested targets; animation values interpolate toward those targets. Changes requested while paused take effect after resuming.

## Manual verification

1. Open the running preview at http://localhost:3001 and refresh. Alternatively run `npm run dev` and open its printed URL.
2. Click **Face view**, then **Smile**. Expect a smooth transition instead of an immediate jump.
3. Click **Release facial controls**. Expect a smooth return to the original facial weights.
4. Click **Run blend demo**. Over several seconds, observe the smile, pulsing jaw, occasional blink, and subtle head motion together. No audio is connected.
5. Filter shapes to `jawOpen` and move its slider to zero. The jaw should settle closed while the smile, blinks, and head movement continue. The manual layer outranks the simulated speech layer.
6. Click **Release facial controls**. The pulsing jaw should return while the other demo sources continue.
7. Click **Pause engine**. Motion should freeze. Click **Resume engine** to continue.
8. Click **Reset pose** or **Stop blend demo**. The original pose must return immediately and stay neutral on subsequent frames.
9. Adjust head/eye sliders, then reset again. Original bone transforms must return without drift.
10. Hide/show controls and refresh the page. Controls and the new engine instance should remain usable.

## Validation

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

The suite contains the four original binding tests plus thirteen core-engine tests. Coverage includes sparse priority composition, weighted ties, stale/invalid inputs, multi-mesh damping, frame-rate independence, rest-weight restoration, simultaneous systems, pause/resume, exact reset, idempotent disposal, failed source isolation, clamping, and independent bone axes.

Browser checks cover the blend demo, manual eyelid overrides during mouth/head animation, pause/resume, release, and reset. Physical-device performance remains a later verification task. Natural idle/eye/emotion controllers belong to Phase 03; streamed voice and audio-driven lip-sync belong to later phases.
