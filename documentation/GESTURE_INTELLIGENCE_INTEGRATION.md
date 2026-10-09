# Gesture Intelligence Integration

## Step Roles

Step 10A decides what gesture is appropriate.

```text
Prosody / conversation signals
  -> GestureIntentEngine
  -> GestureIntentResult
```

Step 10B decides when that gesture is allowed.

```text
GestureIntentResult
  -> GestureTimingEngine
  -> GestureTimingResult
```

Step 10C connects approved gestures to the existing animation pipeline.

```text
GestureTimingResult
  -> BehaviorController
  -> GestureEngine
  -> Animation channels
```

Step 10C does not redesign gesture animation.

## Data Flow

During each `BehaviorController` update:

```text
ProsodyEngine
  -> GestureIntentEngine
  -> GestureTimingEngine
  -> GestureEngine
  -> AnimationMixer
  -> AvatarEngine
```

`BehaviorController` supplies semantic inputs from existing state:

- behavior state
- prosody speaking state
- prosody energy
- prosody pitch
- prosody emphasis
- prosody pause
- reduced motion
- delta time

It does not inspect PCM, Web Audio, Gemini, DOM, GLB objects, or Three.js objects.

## BehaviorController Responsibility

`BehaviorController` orchestrates the pipeline. It does not make hard-coded gesture decisions.

Good:

```text
BehaviorController
  -> GestureIntentEngine
  -> GestureTimingEngine
  -> GestureEngine
```

Avoid:

```text
if energy > threshold then play open-hand
```

## GestureEngine Responsibility

`GestureEngine` remains responsible for animation:

- entering
- holding
- exiting
- easing
- intensity scaling
- calibrated channel output

Step 10C does not change gesture poses, ranges, or animation curves.

## Automatic Gesture Approval

Only a `GestureTimingResult` with:

```text
status = started
```

introduces a new automatic gesture.

While timing is `holding`, the current automatic gesture is preserved so the existing `GestureEngine` lifecycle can continue. `cooldown`, `idle`, and `cancelled` do not introduce a new gesture.

## Explicit Gesture Compatibility

Explicit/manual gestures keep higher priority than automatic gestures.

```text
explicit gesture > automatic gesture
```

When an explicit gesture is active, the automatic timing layer is suppressed and the explicit request is passed to the existing `GestureEngine`.

## Reduced Motion

Reduced motion remains authoritative:

```text
reducedMotion
  -> GestureIntentEngine none
  -> GestureTimingEngine idle / none
  -> no automatic gesture execution
```

The existing `GestureEngine` reduced-motion behavior remains unchanged.

## Interruption, Speech Stop, And Pause

Pause and speech stop are routed through `GestureTimingEngine`, preventing new automatic gestures and clearing active timing state.

Conversation-level interruption can be represented later as an explicit timing interruption signal. Step 10C does not redesign `ConversationCoordinator`.

## Channel Integration

Gesture channels continue through the existing behavior layer:

```text
eye channels
head channels
gesture channels
speech channels
emotion channels
  -> existing AnimationMixer
  -> AvatarEngine
```

No direct avatar mutation path was added.

## Diagnostics

`BehaviorController.getDiagnostics()` now includes:

- `gestureIntent`
- `gestureTiming`
- existing `gesture` diagnostics

Diagnostics are serializable and intended for tests/development inspection only.

## Remaining Work For Step 10D

Step 10D can tune naturalness:

- thresholds
- frequency feel
- timing feel
- interaction with long speech
- subjective polish

Step 10D should not be mixed into Step 10C.
