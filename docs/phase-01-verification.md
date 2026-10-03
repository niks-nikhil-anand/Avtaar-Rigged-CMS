# Phase 01 manual verification

## Start the application

From the project directory in PowerShell:

```powershell
npm run dev
```

Open the localhost URL printed by Next.js (normally http://localhost:3000). A production preview can instead be started with `npm run build`, followed by `npm run start -- --port 3001`.

## Viewer and environment

1. Wait for `model.glb · Ready`. Expect the textured avatar standing on a softly lit ground with a visible shadow.
2. The model's original pose is a T-pose. Automatic body/idle animation is not part of Phase 01.
3. Drag within the viewport to orbit. Scroll or pinch to zoom. Panning is disabled and camera angles/distances are constrained.
4. Click **Reset camera**. The avatar should return to centered framing.
5. Click **Face view** to inspect the face, then **Full body** to see the entire model.

## Facial and bone controls

1. Click **Blink**. Both eyelids should close together, including eyelashes.
2. Click **Reset pose**. Eyes should reopen.
3. Click **Smile**. Both sides of the mouth should smile.
4. Click **Open jaw**. Mouth and lower teeth should move together.
5. Filter shapes with `jaw`, `blink`, `eyeLook`, or a viseme such as `aa`. Adjust individual sliders and verify the corresponding deformation.
6. Expand **Head & eye rotation**. Move head/neck/eye sliders slightly. They should create constrained offsets rather than accumulating rotations.
7. Click **Reset pose**. All morph weights and bone transforms should return to their original values.
8. Set a slider, hide controls, and show controls again. Its displayed value and avatar pose should remain consistent.
9. Expand **Scene inventory**. Expect 12 meshes, 73 bones, 66 unique shapes, and no animation clips.

## Responsive layout and keyboard

1. Resize the browser to a phone-sized viewport (for example, 390 × 844).
2. Expect the debug panel below the viewer, with no horizontal page overflow.
3. In full-body view, the camera should fit both the model's height and outstretched arms.
4. Use Tab to reach controls. Buttons should show a visible focus outline; arrow keys should adjust sliders.

## Failure handling

In browser developer tools, block the `/model.glb` request, disable the browser cache, and reload. Expect a useful error with **Retry viewer**, rather than an empty scene. Remove the block and click **Retry viewer** to recover. Do not delete the original asset.

A browser without WebGL 2 should show an unsupported-viewer message. This fallback is implemented; a real unsupported-device check remains manual.

## Automated checks

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Four binding tests cover coordinated morph updates, weight limits/invalid input, restoration of rest transforms, non-accumulating bone offsets, and inspection/missing controls.

## Scope and validation notes

Desktop and phone-sized browser rendering, blink/smile/jaw/eye controls, head rotation, neutral reset, and missing-model recovery were checked against the production app. Phone viewport testing is not a physical-device performance test. Audio and automatic motion are intentionally deferred to their implementation phases.

Dependency versions are pinned in the lockfile. Three.js 0.181.2 and matching types avoid deprecations encountered with the newest Three.js release and the current Fiber/Drei renderer. npm audit reports five high findings in the existing ESLint tooling chain (`braces`/`micromatch`/`fast-glob`); its suggested automatic fix downgrades Next's ESLint configuration, so that unrelated change was not applied.
