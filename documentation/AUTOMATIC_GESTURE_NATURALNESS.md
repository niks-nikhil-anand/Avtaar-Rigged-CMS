# Automatic Gesture Naturalness

## Objective

Step 10D validates and tunes the automatic gesture policy so gestures feel intentional instead of mechanical.

The central rule is:

```text
No strong semantic signal -> no gesture
```

Step 10D tunes when and why automatic gestures are selected within the existing architecture. It does not introduce a new animation system or new gesture types.

## Existing Architecture

```text
Prosody / Behavior State
  -> GestureIntentEngine
  -> GestureTimingEngine
  -> BehaviorController
  -> GestureEngine
  -> Animation Channels
  -> Avatar
```

Responsibilities remain unchanged:

- `GestureIntentEngine`: decides what gesture is semantically appropriate.
- `GestureTimingEngine`: decides when that gesture is allowed.
- `BehaviorController`: orchestrates the existing subsystems.
- `GestureEngine`: animates the approved gesture using existing calibrated channels.

## Naturalness Principles

- Quiet speech should not gesture.
- Normal speech should usually not gesture.
- Emphasis should gesture only when the signal is clear.
- Very strong emphasis may produce `small-point`, but it should remain rare.
- High-energy explanatory speech may produce `open-hand`.
- Thinking may produce `thinking-touch` only from the existing `thinking` behavior state.
- Pause and reduced motion should produce no new automatic gesture.
- No randomness is used.

## Gesture Selection Policy

Current deterministic policy:

```text
reduced motion
  -> none
not speaking
  -> none
pause
  -> none
thinking state
  -> thinking-touch
very strong emphasis + meaningful energy
  -> small-point
strong emphasis
  -> emphasis
high energy + moderate emphasis
  -> open-hand
otherwise
  -> none
```

## Quiet Speech Behavior

Quiet speech and low-emphasis speech produce:

```text
gesture = none
```

This is expected and desirable.

## Normal Speech Behavior

Normal conversational speech remains mostly gesture-free. The avatar should not move its hands simply because it is speaking.

## Emphasis Behavior

Clear emphasis produces:

```text
gesture = emphasis
```

Very strong emphasis with meaningful energy produces:

```text
gesture = small-point
```

`small-point` remains intentionally conservative.

## Open-Hand Behavior

`open-hand` is reserved for elevated explanatory speech:

```text
high energy + moderate emphasis -> open-hand
```

If emphasis becomes strong enough, `emphasis` takes precedence over `open-hand`.

## Thinking Behavior

The only automatic path to `thinking-touch` is the existing `thinking` behavior state. No new thinking detection was added.

## Pause Behavior

Pause suppresses new automatic gesture intent:

```text
pause -> none
```

Existing active gesture settling remains owned by `GestureTimingEngine` and `GestureEngine`.

## Reduced-Motion Behavior

Reduced motion remains authoritative:

```text
reducedMotion -> none
```

There are no smaller substitute gestures.

## Interruption Behavior

Timing tests cover cancellation and stale-state cleanup. Step 10D did not redesign interruption handling.

## Timing Interaction

`GestureTimingEngine` remains the only cooldown and repetition-control layer. Step 10D does not add a second scheduler or cooldown.

## Test Scenarios

Added/strengthened coverage for:

- quiet speech
- normal speech
- threshold boundaries for emphasis
- threshold boundaries for `open-hand`
- very strong emphasis
- thinking
- pause
- reduced motion
- deterministic long conversation sequence
- bounded gesture starts through repeated speech changes

## WebGL Validation Findings

No WebGL validation was performed in Step 10D. The policy was validated through deterministic unit and integration tests. Step 10E remains the WebGL-focused validation milestone.

## Remaining Issues

### C - Minor Polish

Visual feel may still need subjective tuning after real avatar validation in Step 10E.

### D - Future Enhancements

Deferred intentionally:

- semantic content analysis
- language-specific gestures
- personality-specific gesture style
- gesture diversity models
- LLM-based gesture generation
- new gesture types
- gesture blending

## Deferred Milestones

Step 10E should validate the automatic gesture policy on the real WebGL avatar.
