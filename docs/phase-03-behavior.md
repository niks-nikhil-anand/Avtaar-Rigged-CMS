# Phase 03: Natural avatar behavior

The viewer now starts with natural behavior enabled: a relaxed arm pose, procedural breathing/head movement, natural blink timing, and restrained gaze. The original GLB is preserved and still has no animation clips.

## Controllers and ownership

| Controller | Responsibility | Priority |
| --- | --- | --- |
| EyeEngine | Randomized blink curves; constrained gaze using eye bones | Blink 100; gaze 50 |
| IdleEngine | Breathing, head/neck movement, relaxed arms | Motion 20; resting pose 40 |
| EmotionEngine | Six verified expression profiles with intensity | 70 |
| LipSyncEngine | Supplied amplitude/visemes, mouth silence and release | 90 |
| BehaviorController | Idle/listening/thinking/speaking state and lifecycle | Coordinates the above |

All controllers are independent of React and use the existing per-channel compositor. Morph updates still coordinate every matching facial mesh. No second frame loop or browser timer was introduced. Blink channels use faster damping than other facial shapes to preserve eyelid closure.

The arm pose is specific to this model: its upper-arm local X axes lower both arms with a positive pitch offset of 1.1 radians. This was derived from the GLB hierarchy and verified in the viewer. Upper-arm pitch is limited to 1.25 radians; eye offsets remain limited to 0.18, and other rotations to 0.25. Roll channels are now supported and constrained too. No rest transform is overwritten.

## Behavior transitions

- **Idle:** relaxed pose, low-amplitude breathing/head movement, intermittent gaze and randomized blinking.
- **Listening:** centered gaze and reduced procedural head movement.
- **Thinking:** slightly raised/off-center gaze, reduced motion, and a thinking-expression fallback when the selected emotion is neutral.
- **Speaking:** mouth input is enabled; eyes and idle movement continue. The state alone does not generate speech or mouth opening.

Transitions use the engine's smooth blending. The emotion selection is independent of state and persists until changed. Leaving speaking clears amplitude and viseme inputs. Neutral releases expression channels toward captured original weights. A surprised expression may itself hold a small jaw opening when speech is inactive.

Reduced motion suppresses autonomous gaze shifts and breathing/head movement while retaining blinking, the resting pose, explicit gaze commands, and expressions. The browser's reduced-motion preference is read on setup and observed for changes; the debug checkbox supplies an immediate override until a subsequent system-preference change.

## Mouth-control API

```ts
engine.behavior.enable();
engine.behavior.setState("speaking");
engine.behavior.lips.setAmplitude(0.5);
engine.behavior.lips.setViseme("aa", 0.7);
engine.behavior.lips.clearVisemes();
engine.behavior.setState("listening"); // Stops and releases speech inputs.
```

`LipSyncEngine` also exposes `startSpeaking()` and `stopSpeaking()`. Amplitude is clamped and smoothed. Supported visemes are normalized when their summed weights exceed 1; amplitude-driven jaw opening is reduced as viseme coverage increases. Unsupported controls and invalid values are ignored. This interface is ready for later audio playback integration; the current sliders are synthetic input.

## Reset and cleanup

- **Reset pose** immediately removes all behavior/demo/manual sources and restores the original T-pose and morph weights. It stays in that pose until new commands arrive.
- **Return to idle** clears overrides and re-enables natural behavior with neutral emotion and a relaxed pose.
- Disabling natural behavior smoothly releases its channels.
- Pause/resume uses the existing engine lifecycle.
- Disposal removes the behavior clock, all owned layers, mouth inputs, and the reduced-motion event listener.
- Starting the legacy blend demo disables natural behavior. Activating a natural state removes the demo sources so they do not compete.

## Manual verification

1. Refresh http://localhost:3001 (or run `npm run dev` and use the printed URL). Wait for the avatar to load with lowered arms.
2. Observe idle for at least 20 seconds: expect subtle breathing/head motion, occasional blinks, and small gaze changes.
3. Click **Face view**. Select each emotion and move the intensity slider. Verify smooth changes, then select neutral.
4. Try **Listening**, **Thinking**, and **Idle**. Expect quieter head motion and corresponding gaze changes.
5. Click **Speaking**. With amplitude zero and no viseme, expect no speech mouth movement. Raise **Synthetic speech amplitude** and inspect jaw/teeth coordination.
6. Select `aa`, `oh`, `E`, or another **Test viseme**. Return to **None**. The avatar should respond smoothly without disrupting blink/expression channels.
7. Choose **Listening**. Speech inputs should clear and the mouth should release (an emotion can still affect it).
8. Expand **Gaze target**, exercise both sliders, and click **Release gaze**. Eyes should remain within their natural range.
9. Enable **Reduced motion** and wait briefly for motion to settle. Blinking and expressions remain available.
10. Test pause/resume, **Reset pose**, and **Return to idle**. Confirm the T-pose reset and relaxed idle are distinct and repeatable.
11. Start the blend demo, then select **Idle**. Demo controls should switch back to Run, and natural behavior should take over.
12. Check phone-width layout; the behavior panel should sit below the viewport without horizontal overflow.

## Verification

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

The 29-test suite includes 12 behavior tests covering deterministic blink curves, constrained gaze, reduced motion, emotion profiles, silent speaking, amplitude smoothing, normalized visemes, relaxed/original pose restoration, coordinated facial meshes, rapid state changes, roll limits, and frame-rate consistency. Five simulated minutes of animation are checked for finite values, bone limits, and bounded morphs.

Real browser verification covers the relaxed GLB pose, expressions, state controls, synthetic mouth input, resets, and responsive layout. The accelerated long-session test is not a physical-device performance benchmark. Gemini streaming audio remains a later phase.
