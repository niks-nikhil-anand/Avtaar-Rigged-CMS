# Head + Eye Coordination

Date: 2026-10-08

Scope: Step 9D head + eye coordination only.

## Coordination Model

```text
Eyes = primary precise gaze
Head = secondary supporting motion
```

The runtime keeps the existing architecture:

```text
BehaviorController
  -> EyeEngine
  -> HeadEyeCoordinator
  -> HeadMotionEngine
  -> AnimationChannels
  -> AvatarEngine
  -> GLB
```

`HeadEyeCoordinator` consumes the existing semantic gaze target:

- `x = -1` left, `x = +1` right
- `y = -1` down, `y = +1` up

It outputs only a normalized `HeadTarget`. It does not calculate raw bone rotations, touch Three.js objects, or replace `EyeController` / `HeadMotionEngine`.

## Configuration

New coordination defaults:

- enabled: `true`
- dead zone: `0.18`
- yaw contribution: `0.42`
- pitch contribution: `0.32`
- smoothing: `4`
- max delta time: `0.1`

Before:

- Explicit look targets moved the eyes only.
- Head motion came from behavior state and prosody, not the semantic gaze target.

After:

- Small gaze targets stay eye-primary and produce no coordinated head target inside the dead zone.
- Larger gaze targets recruit subtle head support in the same semantic direction.
- Reduced motion immediately suppresses coordinated head support.

Reason:

The calibrated eye, head, and gesture systems were working independently. Step 9D adds a narrow coordination layer so large gaze changes feel like one natural gaze system while preserving existing calibration values.

## Visual Validation

Runtime:

- Browser/runtime: Codex in-app browser against `http://localhost:3000/admin/appearance`
- WebGL available: yes
- Avatar rendered: yes
- Calibration surface used: Inspect -> Head + eye coordination

Validated on the rendered GLB:

- Horizontal gaze: center, left, right, far right
- Vertical gaze: down and upper-direction pitch through diagonal target
- Diagonal gaze: upper-right
- Small target behavior: tested through focused unit behavior; small target remains eye-primary
- Large target behavior: far-right reached eye X `1.00` with head share `0.42`
- Diagonal target: upper-right reached eye X/Y `0.75/0.75`, head yaw `0.292`, head pitch `0.222`
- Reduced motion: enabled reduced motion at upper-right target; head target returned to yaw `0`, pitch `0`, roll `0`
- Neutral reset: reset control returns target to center and releases the behavior look target

## Timing / Lead-Follow

The coordinator has its own smoothing of `4`, while eyes remain immediate through the existing calibrated eye controller. This makes eyes begin first and head support follow gradually. `HeadMotionEngine` then applies its existing calibrated smoothing.

## Regression Notes

Preserved:

- Step 9A eye calibration
- Step 9B head calibration, including `pitchSign = -1`
- Step 9C gesture calibration
- Blink, saccades, gestures, lip sync, prosody, and behavior orchestration architecture

No changes were made to:

- `EyeController` calibration values
- `HeadMotionEngine` calibration values
- `GestureEngine`
- prosody tuning
- automatic gesture selection
- Gemini/audio/lip-sync architecture

## Known Limitations

- The coordination panel is development-only and not a production debug surface.
- Full naturalness tuning across live conversation remains a later pass.
