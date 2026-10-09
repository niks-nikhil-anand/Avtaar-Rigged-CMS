# Gesture Rig Calibration

Asset inspected: `public/avtaar-rigged-blender/Untitled.slim.glb`

Date: 2026-10-08

Scope: Step 9C live avatar gesture visual calibration only.

## Runtime

- Browser/runtime: Codex in-app browser against `http://localhost:3000/admin/appearance`
- WebGL available: yes
- Avatar rendered: yes
- Calibration surface used: Inspect -> Gesture calibration

## Rig Discovered

The existing gesture implementation is procedural and framework-independent:

`GestureCalibrationPanel` -> `GestureEngine` -> animation channels -> `AvatarEngine` / `AnimationMixer` -> GLB bones.

Relevant canonical bones/channels currently used:

- `LeftUpperarm`, `RightUpperarm`
- `LeftForearm`, `RightForearm`
- `LeftHand`, `RightHand`

These resolve through `modelProfile.boneAliases` to the Character Creator GLB bones such as `CC_Base_L_Upperarm`, `CC_Base_R_Upperarm`, `CC_Base_L_Forearm`, `CC_Base_R_Forearm`, `CC_Base_L_Hand`, and `CC_Base_R_Hand`.

No new gesture channels, gesture names, animation clips, fingers, shoulders, audio, prosody, or automatic gesture selection were added.

## Calibration Results

| Gesture | Result | Change |
|---|---|---|
| None | Pass | No change. Neutral returns cleanly. |
| Open hand | Pass | Increased range and corrected upper-arm roll signs for left/right symmetry. |
| Emphasis | Pass | Increased right arm/forearm range so the gesture is readable from the front. |
| Small point | Pass | Increased right arm/forearm range while keeping the point subtle. |
| Thinking touch | Pass with limitation | Increased right arm/forearm range; reads as a thinking hand lift but does not touch the face. |

## Final Calibrated Values

### Gesture lifecycle

- Enter duration: `0.22`
- Hold duration: `0.5`
- Exit duration: `0.28`
- Max delta time: `0.1`

Lifecycle timing remains unchanged. Existing timing was treated as baseline and was not changed because visual validation did not show a concrete timing problem.

### Behavior arm limit

- Arm/hand behavior channel limit: `0.25 -> 0.65`
- Affected canonical bones: `LeftClavicle`, `RightClavicle`, `LeftUpperarm`, `RightUpperarm`, `LeftForearm`, `RightForearm`, `LeftHand`, `RightHand`
- Reason: the previous generic body clamp made all gestures barely readable on the rendered GLB. Head and eye limits remain unchanged.

### Open hand

- `LeftUpperarm:roll`: `-0.10 -> 0.24`
- `RightUpperarm:roll`: `0.10 -> -0.24`
- `LeftForearm:pitch`: `0.08 -> 0.18`
- `RightForearm:pitch`: `0.08 -> 0.18`
- `LeftHand:roll`: `-0.05 -> -0.12`
- `RightHand:roll`: `0.05 -> 0.12`
- Reason: baseline movement was too subtle, and the first larger pass revealed upper-arm roll signs were inverted for an opening gesture. Corrected signs produce symmetric outward arm movement.

### Emphasis

- `RightUpperarm:pitch`: `0.12 -> 0.35`
- `RightUpperarm:roll`: `0.08 -> 0.20`
- `RightForearm:pitch`: `0.16 -> 0.45`
- `RightHand:roll`: `0.08 -> 0.16`
- Reason: baseline motion was too subtle to read from the front. Calibrated values make a visible one-arm emphasis gesture without clipping.

### Small point

- `RightUpperarm:pitch`: `0.14 -> 0.38`
- `RightUpperarm:yaw`: `-0.06 -> -0.18`
- `RightForearm:pitch`: `0.20 -> 0.52`
- `RightHand:roll`: `-0.04 -> -0.10`
- Reason: baseline point was barely visible. Calibrated values keep it subtle but readable.

### Thinking touch

- `RightUpperarm:pitch`: `0.08 -> 0.32`
- `RightUpperarm:roll`: `0.12 -> 0.24`
- `RightForearm:pitch`: `0.18 -> 0.55`
- `RightHand:roll`: `0.12 -> 0.18`
- Reason: baseline motion was too subtle. Calibrated values create a readable thinking lift without face penetration.

## Intensity Findings

- Low, medium, and high intensity scale the same calibrated channels.
- High intensity remains within the arm behavior limit and did not show visible mesh breakage.

## Lifecycle Findings

- Gestures enter, hold, and exit cleanly.
- Repeated gesture cycles return to neutral without visible drift.
- Unit tests cover repeated cycles and non-accumulation.

## Reduced Motion Findings

- Reduced motion suppresses gesture output.
- Live diagnostics reported `activeGesture: none`, `phase: idle`, and neutral channels when reduced motion was enabled.

## Known Limitations

- `thinking-touch` remains a conservative thinking lift rather than a true face-touch gesture. Reaching the face naturally would likely require additional calibrated channels and should be handled in a later gesture-authoring pass, not Step 9C.
- Finger poses were not added or calibrated in this step.
