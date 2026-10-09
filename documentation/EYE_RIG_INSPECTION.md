# Eye Rig Inspection

Asset inspected: `public/avtaar-rigged-blender/Untitled.slim.glb`

## Eye Bones

- Left eye: `CC_Base_L_Eye`
- Right eye: `CC_Base_R_Eye`
- Canonical engine names: `LeftEye`, `RightEye`
- Parent for both eyes: `CC_Base_FacialBone`
- Hierarchy:
  - `Scene`
  - `Armature`
  - `CC_Base_BoneRoot`
  - `CC_Base_Hip`
  - `CC_Base_Waist`
  - `CC_Base_Spine01`
  - `CC_Base_Spine02`
  - `CC_Base_NeckTwist01`
  - `CC_Base_NeckTwist02`
  - `CC_Base_Head`
  - `CC_Base_FacialBone`
  - `CC_Base_L_Eye` / `CC_Base_R_Eye`

## Rest Transforms

- `CC_Base_L_Eye`
  - Local position: `[7.161242, 7.504663, 3.319411]`
  - Local rotation XYZ: `[3.141586, 1.570535, 0]`
  - Local quaternion: `[0.707107, 0.000004, 0.707107, 0.000001]`
- `CC_Base_R_Eye`
  - Local position: `[7.161265, 7.504666, -3.319429]`
  - Local rotation XYZ: `[3.141588, 1.570535, 0]`
  - Local quaternion: `[-0.707107, -0.000004, -0.707107, 0.000001]`

The runtime stores these bind/rest quaternions in `resolveBindings` and applies gaze as offsets relative to rest.

## Eye Meshes And Materials

- Eye group: `CC_Base_Eye`
- Meshes:
  - `CC_Base_Eye_1`, material `Std_Eye_R`
  - `CC_Base_Eye_2`, material `Std_Cornea_R`
  - `CC_Base_Eye_3`, material `Std_Eye_L`
  - `CC_Base_Eye_4`, material `Std_Cornea_R`
- Occlusion group: `CC_Base_EyeOcclusion`
- Tearline group: `CC_Base_TearLine`

The runtime already hides `Std_Eye_Occlusion_*` and `Std_Tearline_*` materials because this export renders them opaque.

## Eye Morph Targets

Eye-related morphs found on occlusion, tearline, and lash meshes:

- `Eye_Blink_L`
- `Eye_Blink_R`
- `Eye_Widen_L`
- `Eye_Widen_R`
- `Eye_Squint_Inner_L`
- `Eye_Squint_Inner_R`
- `Eye_Cheek_Raise_L`
- `Eye_Cheek_Raise_R`
- brow morphs are also present on the same facial accessory meshes.

Canonical aliases in `modelProfile.ts` map blink and eye expression names to these asset morphs.

## Animation Clips

- Clip: `Default`
- Eye tracks:
  - `CC_Base_L_Eye.position`
  - `CC_Base_L_Eye.quaternion`
  - `CC_Base_L_Eye.scale`
  - `CC_Base_R_Eye.position`
  - `CC_Base_R_Eye.quaternion`
  - `CC_Base_R_Eye.scale`
- Each inspected eye track has one keyframe, so this clip appears to provide rest transforms rather than active eye movement.

## Axis And Sign Baseline

Current runtime mapping in `modelProfile.ts`:

- `CC_Base_L_Eye`: pitch `x`, yaw `z`, roll `y`
- `CC_Base_R_Eye`: pitch `x`, yaw `z`, roll `y`

Controller baseline signs:

- semantic `x`: `-1` left, `+1` right
- semantic `y`: `-1` down, `+1` up
- yaw sign: `1`
- pitch sign: `-1`

These preserve the existing visible behavior while making axis/sign calibration explicit.

## Safe-Limit Baseline

The current behavior values are retained as the initial baseline:

- Horizontal: `-0.17` to `0.17`
- Vertical: `-0.12` to `0.12`

These were treated as baseline values, not anatomical truth. Visual validation on the loaded avatar is required before promoting a value to calibrated.

## Step 9A Runtime Visual Calibration Attempt

Date: 2026-10-08

Scope: live avatar eye movement and blink visual calibration only.

Runtime findings:

- The local app was started with `npm run dev`.
- `http://127.0.0.1:3000/` returned HTTP 200.
- The Studio page at `/admin/appearance` loaded the existing eye calibration surface under Inspect.
- Browser automation reported the avatar viewer fallback: `WebGL is unavailable. Enable hardware acceleration or use a supported browser.`

Calibration result:

- No eye or blink calibration constants were changed in this pass.
- The current values remain initial baselines, not visually validated calibration:
  - Horizontal: `-0.17` to `0.17`
  - Vertical: `-0.12` to `0.12`
  - Yaw sign: `1`
  - Pitch sign: `-1`
  - EyeController smoothing: `0`
- Saccade and blink timing values remain unchanged.

Reason:

The running GLB avatar could not be visually inspected in the available browser automation environment because WebGL was unavailable. Per the calibration instructions, no value should be marked as visually validated without observing the actual rendered avatar.

Next visual pass:

- Re-run this calibration in a browser/session with WebGL enabled.
- Use the existing Inspect → Eye calibration panel.
- Verify center, left, right, up, down, diagonals, saccades, blink lifecycle, blink + gaze interaction, speaking regression, and reduced-motion behavior before changing constants.

## Step 9A WebGL Runtime Calibration

Date: 2026-10-08

Runtime:

- Browser/runtime: Codex in-app browser against `http://localhost:3000/admin/appearance`
- WebGL available: yes
- Avatar rendered: yes
- Existing calibration surface used: Inspect → Eye calibration

Visually validated eye calibration:

- Horizontal: `-0.17` to `0.17`
- Vertical: `-0.06` to `0.06`
- Yaw sign: `1`
- Pitch sign: `-1`
- EyeController smoothing: `0`

Calibration changes:

- Vertical range changed from `-0.12 .. 0.12` to `-0.06 .. 0.06`.
- Reason: the baseline `0.12` downward gaze exposed too much sclera and produced a wide-eyed/eye-popping look on the rendered GLB. `0.06` kept up/down and diagonal gaze readable while staying more anatomically conservative.

Unchanged values:

- Horizontal range remains `-0.17 .. 0.17`; left/right and diagonal horizontal movement were readable and did not show obvious clipping or unnatural over-rotation.
- Yaw sign remains `1`; semantic left/right moved in the expected avatar-local direction.
- Pitch sign remains `-1`; semantic up/down moved in the expected direction.
- Saccade parameters remain unchanged.
- Blink timing parameters remain unchanged.

Visual notes:

- Center, left, right, up, down, and diagonal eye targets were checked on the rendered avatar.
- Diagonal gaze showed consistent eye movement without visible roll or divergence.
- Blink morph closure was checked with the existing face preset; both eyelids closed consistently without obvious popping.
- No GLB, bone names, morph names, head motion, gestures, prosody, microphone, Gemini, or behavior architecture were changed in this calibration pass.
