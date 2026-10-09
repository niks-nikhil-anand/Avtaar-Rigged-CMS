# Head Rig Calibration

Asset inspected: `public/avtaar-rigged-blender/Untitled.slim.glb`

Date: 2026-10-08

Scope: Step 9B live avatar head visual calibration only.

## Runtime

- Browser/runtime: Codex in-app browser against `http://localhost:3000/admin/appearance`
- WebGL available: yes
- Avatar rendered: yes
- Calibration surface used: Inspect -> Head calibration

## Head Rig

- Actual head bone: `CC_Base_Head`
- Actual neck bone used by the controller: `CC_Base_NeckTwist01`
- Canonical animation channels:
  - `bone:Head:yaw`
  - `bone:Head:pitch`
  - `bone:Head:roll`
  - `bone:Neck:yaw`
  - `bone:Neck:pitch`
  - `bone:Neck:roll`
- Runtime application path: `BehaviorController` -> `HeadMotionEngine` -> animation channels -> `AvatarEngine` / `AnimationMixer` -> GLB bones.

## Visually Validated Values

These values were checked on the rendered GLB. They are visually validated for this asset and runtime, not general anatomical constants.

### Yaw

- Semantic target: `-1` left to `+1` right
- Axis mapping: semantic `yaw` channel
- Sign: `+1`
- Range: `-0.12` to `0.12`
- Result: left and right moved in the expected direction with conservative, natural motion and no visible neck distortion.

### Pitch

- Semantic target: `-1` down to `+1` up
- Axis mapping: semantic `pitch` channel
- Sign: `-1`
- Range: `-0.08` to `0.08`
- Result: baseline sign `+1` was reversed in the live rig. Inverting the sign made semantic up/down match the rendered avatar.

### Roll

- Semantic target: `-1` roll left to `+1` roll right
- Axis mapping: semantic `roll` channel
- Sign: `+1`
- Range: `-0.06` to `0.06`
- Result: roll remained subtle and did not show visible shoulder or neck distortion.

## Neutral And Smoothing

- Neutral offsets: none; neutral target remains `{ yaw: 0, pitch: 0, roll: 0 }`.
- Smoothing: `10`
- Max delta clamp: `0.1s`
- Result: transitions were smooth without snapping, jitter, oscillation, or accumulated rotation.

## Prosody Sensitivity

- Prosody influence:
  - yaw: `0.015`
  - pitch: `0.025`
  - roll: `0.012`
- Result: low/normal/high prosody samples stayed subtle. No prosody amplitude changes were required.

## Calibration Changes

- Pitch sign: `+1` -> `-1`
- Reason: live GLB visual inspection showed semantic pitch was reversed. The corrected sign makes `pitch: +1` lift the head and `pitch: -1` lower it.

Unchanged values:

- Yaw sign: `+1`
- Roll sign: `+1`
- Yaw limit: `0.12`
- Pitch limit: `0.08`
- Roll limit: `0.06`
- Neck influence: `0.35`
- Smoothing: `10`
- Prosody influence values

## Visual Validation Checklist

- Yaw: visually validated
- Pitch: visually validated after sign correction
- Roll: visually validated
- Combined movement: visually validated with yaw + pitch and yaw + roll targets
- Smoothing: visually validated
- Idle/listening/thinking/speaking: verified through existing behavior path
- Prosody: visually validated with panel samples
- Reduced motion: visually validated as neutral output from `HeadMotionEngine`

No eye, blink, gesture, audio, microphone, webcam, Gemini, or production debug-control behavior was changed in this pass.
