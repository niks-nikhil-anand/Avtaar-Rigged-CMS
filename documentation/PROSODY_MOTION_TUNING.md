# Prosody Motion Tuning

Date: 2026-10-08

Scope: Step 9E deeper prosody-to-motion tuning only.

## Current Prosody Signals

`ProsodyEngine` produces semantic speech signals:

- `energy`: normalized speech activity, `0..1`
- `pitch`: normalized pitch estimate, `0..1`, neutral at `0.5`
- `emphasis`: derived from energy and pitch deviation, `0..1`
- `speaking`: whether speech is active
- `pause`: true when speaking but energy is below the configured pause threshold

`ProsodyEngine` remains responsible only for interpreting normalized speech features. It does not write animation channels.

## Motion Mapping

Existing path preserved:

```text
ProsodyEngine
  -> BehaviorController
  -> HeadMotionEngine
  -> AnimationChannels
  -> AvatarEngine
```

Only `HeadMotionEngine` consumes prosody directly in this step. No automatic gesture selection was added, and lip-sync remains independent.

## Calibration Values

### Prosody influence

Unchanged:

- yaw: `0.015`
- pitch: `0.025`
- roll: `0.012`

### Mapping changes

Before:

- `speaking = true` allowed energy/emphasis to create a small head offset.
- Pitch was not used by `HeadMotionEngine`.
- Pause did not explicitly suppress head prosody offset.

After:

- `pause = true` returns prosody head offset to neutral.
- Pitch deviation from neutral contributes only a small bounded modulation.
- Energy, emphasis, and pitch combine into a bounded amount:
  - energy weight: `0.45`
  - emphasis weight: `0.35`
  - pitch-deviation weight: `0.20`
- Yaw uses emphasis plus a small pitch-deviation term.
- Roll uses emphasis plus a smaller pitch-deviation term.
- Pitch remains the primary subtle energy/emphasis response.

Reason:

This gives speech-aware motion without turning speaking into continuous head movement. Stable speech produces a stable subtle pose; pauses and reduced motion settle naturally.

## Visual Validation

Runtime:

- Browser/runtime: Codex in-app browser against `http://localhost:3000/admin/appearance`
- WebGL available: yes
- Avatar rendered: yes
- Calibration surface used: Inspect -> Prosody calibration

Validated:

- Normal speech sample
- High speech sample
- Emphasis sample
- Pause sample
- Reduced motion while paused

Observed diagnostics:

- Emphasis sample: energy `1.00`, pitch `1.00`, emphasis `1.00`
- Emphasis head offset: yaw `0.013`, pitch `-0.025`, roll `0.010`
- Pause sample: energy `0.04`, pitch `0.50`, pause `true`
- Pause head offset: yaw `0.000`, pitch `0.000`, roll `0.000`
- Reduced motion: true, head offset remained neutral

## Regression Notes

Preserved:

- Head + eye coordination remains gaze-primary.
- Gestures are not triggered by prosody.
- Gesture lifecycle remains independent.
- Lip-sync architecture and viseme behavior remain unchanged.
- Reduced motion uses the existing behavior controller path.

## Known Limitations

- Prosody tuning remains intentionally subtle.
- This step does not implement content-aware gestures or automatic gesture selection.
- Full live conversation naturalness remains a later validation/tuning pass.
