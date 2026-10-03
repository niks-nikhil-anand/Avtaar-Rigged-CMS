# Model inspection

Asset: `public/model.glb`

Inspected the GLB JSON metadata on 2026-10-03. This is a structural inspection; rendering and deformation quality still require the viewer milestone.

## Findings

- GLB version: 2.
- 12 mesh definitions, each containing one primitive.
- Three mesh definitions contain morph targets: mesh indices 1, 2, and 7 have 33, 66, and 19 targets respectively.
- Mesh definitions have no names. Resolve scene-node associations and morph dictionaries at runtime instead of assuming mesh names.
- One skeleton with 73 joint entries, including `Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Neck1`, `Neck2`, `Head`, `LeftEye`, and `RightEye`.
- No embedded animation clips. Plan procedural breathing/head movement.

## Available controls

| Feature | Verified target or bone names |
| --- | --- |
| Blink | `eyeBlinkLeft`, `eyeBlinkRight` |
| Eye morph movement | `eyeLookDownLeft/Right`, `eyeLookInLeft/Right`, `eyeLookOutLeft/Right`, `eyeLookUpLeft/Right` |
| Eye bones | `LeftEye`, `RightEye` |
| Smile | `mouthSmileLeft`, `mouthSmileRight` |
| Frown | `mouthFrownLeft`, `mouthFrownRight` |
| Brows | `browDownLeft/Right`, `browInnerUp`, `browOuterUpLeft/Right` |
| Mouth opening | `jawOpen` |
| Other mouth controls | `mouthClose`, `mouthFunnel`, `mouthPucker`, plus additional asymmetric mouth shapes |
| Visemes | `CH`, `DD`, `E`, `FF`, `PP`, `RR`, `SS`, `TH`, `aa`, `ih`, `kk`, `nn`, `oh`, `ou`, `sil` |

The face mesh at index 2 includes all 66 named targets. Mesh 1 includes a subset of expression controls; mesh 7 includes jaw controls and visemes. Runtime bindings should retain every mesh that implements a requested shape so connected facial parts move together.

## Runtime verification — Phase 01

The production viewer confirmed 12 meshes, 73 bones, and 66 unique morph names. Loaded scene nodes associate the unnamed GLB mesh definitions with:

| Scene mesh | Morph count |
| --- | --- |
| `AvatarBody` | 0 |
| `AvatarEyelashes` | 33 |
| `AvatarHead` | 66 |
| `AvatarLeftCornea`, `AvatarLeftEyeball` | 0 each |
| `AvatarRightCornea`, `AvatarRightEyeball` | 0 each |
| `AvatarTeethLower` | 19 |
| `AvatarTeethUpper` | 0 |
| `outfit_bottom`, `outfit_shoes`, `outfit_top` | 0 each |

Blink, smile, jaw opening, eye-look morphs, and head rotation were verified visually. Head rotation uses a constrained local offset relative to the captured rest quaternion. Reset restores original weights and transforms. The asset renders in its original T-pose; an automatic relaxed pose/idle controller belongs to Phase 02.

## Verification checklist

1. Load the asset in a viewer and associate mesh definitions with scene nodes.
2. Exercise blink and `jawOpen` through their full supported range.
3. Verify the face and other morph-bearing parts deform together.
4. Verify eye/head bone orientation before applying rotations.
5. Capture rest transforms and default weights before creating engine bindings.

Do not assume `mouthOpen` or uppercase `AA/EE/IH/OH/OU` exist. Use the actual names above, verified against loaded morph dictionaries.
