# Gesture Timing Engine

## Purpose

`GestureTimingEngine` is a pure semantic scheduling state machine. It decides when a gesture intent is allowed to become an approved gesture action.

Step 10A decides what gesture is appropriate.

Step 10B decides when that gesture is allowed to execute.

Step 10B does not animate the avatar.

## Relationship To GestureIntentEngine

`GestureIntentEngine` returns semantic intent:

```ts
{ gesture: "emphasis", intensity: 0.65, reason: "strong_speech_emphasis" }
```

`GestureTimingEngine` consumes that result and applies lifecycle, duration, cooldown, interruption, pause, speech, and reduced-motion rules.

The timing engine does not choose between `emphasis`, `open-hand`, `small-point`, or `thinking-touch`. That remains the intent engine's job.

## Input Contract

```ts
interface GestureTimingInput {
  intent?: GestureIntentResult | null;
  speaking?: boolean | null;
  paused?: boolean | null;
  interrupted?: boolean | null;
  reducedMotion?: boolean | null;
  deltaTime: number;
}
```

Inputs are semantic only. Do not pass bones, meshes, morphs, animation clips, GLB references, DOM objects, Web Audio objects, or Three.js objects.

## Output Contract

```ts
interface GestureTimingResult {
  gesture: GestureIntent;
  intensity: number;
  status: "idle" | "started" | "holding" | "cooldown" | "cancelled";
  reason: string;
}
```

`started` is a transient one-update output state. It marks the exact update where a gesture has just been approved.

## Lifecycle

```text
idle
  -> started
  -> holding
  -> cooldown
  -> idle
```

Cancellation path:

```text
started / holding
  -> cancelled
  -> idle
```

Only one gesture can be active at a time. A second intent cannot overlap or replace the active gesture in Step 10B.

## Duration

Timing is configured with:

```ts
interface GestureTimingConfig {
  minDuration: number;
  maxDuration: number;
  cooldown: number;
  maxDeltaTime: number;
}
```

`minDuration` prevents a gesture from ending immediately if intent drops out.

`maxDuration` prevents continuous intent from holding the gesture indefinitely.

## Cooldown

After completion, the engine enters cooldown and returns:

```text
gesture: none
status: cooldown
```

New intents are ignored during cooldown. When cooldown expires, the engine returns to idle and a later valid intent can start.

## Interruption

If `interrupted` is true, active scheduling is cancelled immediately:

```text
active gesture
  -> cancelled
  -> idle
```

The engine does not animate the avatar back to neutral.

## Pause

If `paused` is true, no new gesture may start. If pause happens during an active gesture, the timing state is cancelled deterministically.

## Reduced Motion

Reduced motion dominates all rules:

```text
any state
  -> idle / none
```

It clears active gesture, elapsed time, cooldown, intensity, and diagnostic history.

## Delta-Time Handling

The engine advances only through `update(input)`.

It does not use:

- `Date.now`
- `performance.now`
- `setTimeout`
- `setInterval`
- `requestAnimationFrame`

Invalid `deltaTime` values are treated as zero. Very large deltas are clamped by `maxDeltaTime`.

## Reset

`reset()` returns the engine to:

```text
state = idle
activeGesture = none
elapsed = 0
cooldownRemaining = 0
lastApprovedGesture = none
intensity = 0
```

Reset is deterministic from idle, active, cooldown, or cancelled state.

## Diagnostics

Diagnostics expose:

```ts
state
activeGesture
elapsed
cooldownRemaining
lastApprovedGesture
intensity
```

`lastApprovedGesture` is diagnostic history only. It is not a repetition-blocking rule.

## What This Engine Does Not Do

`GestureTimingEngine` does not:

- animate the avatar
- execute gestures
- write animation channels
- integrate with `BehaviorController`
- integrate with `GestureEngine`
- choose semantic gesture type
- blend gestures
- add new gestures
- change GLB, WebGL, Three.js, React, Gemini, Web Audio, or lip-sync behavior
- add UI or debug panels

Step 10C can later connect:

```text
GestureIntentEngine
  -> GestureTimingEngine
  -> BehaviorController
  -> GestureEngine
  -> Avatar
```
