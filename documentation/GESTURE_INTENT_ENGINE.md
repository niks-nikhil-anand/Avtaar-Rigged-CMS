# Gesture Intent Engine

## Purpose

`GestureIntentEngine` is a pure semantic decision subsystem. It decides what gesture intent is appropriate from speech, prosody, and conversation signals.

Step 10A decides what gesture is appropriate. It does not decide when the gesture should execute or animate the avatar.

## Why It Exists

The avatar already has `GestureEngine`, which can execute calibrated gesture poses. That engine should not also own conversational intelligence. `GestureIntentEngine` keeps gesture choice independent from animation, Three.js, React, WebGL, Gemini, and the GLB rig.

## Input Contract

The engine accepts normalized semantic signals:

```ts
interface GestureIntentInput {
  speaking?: boolean;
  energy?: number;
  pitch?: number;
  emphasis?: number;
  pause?: boolean | number | null;
  conversationState?: BehaviorState | string | null;
  reducedMotion?: boolean | null;
  deltaTime?: number | null;
}
```

Numeric inputs are clamped to `0..1`. Invalid values such as `NaN`, `Infinity`, negative numbers, and missing values are made safe before selection.

## Output Contract

The output is semantic only:

```ts
interface GestureIntentResult {
  gesture: "none" | "open-hand" | "emphasis" | "small-point" | "thinking-touch";
  intensity: number;
  reason: string;
}
```

The engine does not output bones, morphs, Euler angles, animation channels, meshes, clips, or Three.js objects.

## Decision Priority

The priority order is deterministic:

```text
reduced motion
  -> none
not speaking
  -> none
pause
  -> none
thinking
  -> thinking-touch
very strong emphasis
  -> small-point
strong emphasis
  -> emphasis
high-energy explanatory speech
  -> open-hand
otherwise
  -> none
```

Only one intent is returned.

## Gesture Selection Rules

- `none`: default result for idle, quiet speech, weak emphasis, pause, malformed input, and reduced motion.
- `thinking-touch`: selected only when the existing conversation state is `thinking`, after reduced-motion, speaking, and pause checks.
- `small-point`: selected for very strong emphasis with meaningful speech energy.
- `emphasis`: selected for clear speech emphasis below the very-strong pointing threshold.
- `open-hand`: selected for high-energy explanatory speech with moderate emphasis.

The policy is intentionally conservative. Normal speech should usually produce no automatic gesture.

## Reduced Motion

Reduced motion always returns:

```ts
{ gesture: "none", intensity: 0, reason: "reduced_motion" }
```

The engine does not substitute smaller gestures when reduced motion is active.

## Safety And Clamping

The engine:

- clamps numeric inputs to `0..1`
- treats invalid numbers as neutral values
- ignores unknown conversation states
- returns only known gesture names
- keeps intensity within `0..1`
- does not accumulate state
- remains deterministic under identical inputs

## Randomness Strategy

Step 10A does not use randomness. The selection policy is deterministic:

```text
very strong emphasis -> small-point
strong emphasis      -> emphasis
high energy          -> open-hand
```

If future steps need variation, randomness should be injected and tested explicitly.

## What This Subsystem Does Not Do

`GestureIntentEngine` does not:

- animate the avatar
- write animation channels
- schedule gestures
- manage cooldowns
- prevent overlap
- cancel gestures
- modify `BehaviorController`
- modify `GestureEngine`
- modify GLB or Three.js objects
- add new gesture types
- add UI or calibration controls

## Step 10B Extension

Step 10B can consume `GestureIntentResult` and decide when an intent should become an executed gesture. That later layer should own cooldowns, minimum gesture intervals, overlap prevention, cancellation, and integration with `BehaviorController`.
