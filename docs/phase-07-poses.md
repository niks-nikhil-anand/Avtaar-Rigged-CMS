# Poses, scene themes, and rig-specific expression mapping

## Poses
- `avatar/pose/poses.ts` defines the 10 presets (T, A, arms up, one up/one down, elbows 90, hands behind head, deep squat, one-leg balance, twist + head turn, wave). Each pose is bone-local euler offsets `[pitch, yaw, roll]` in radians plus an optional body `root` shift and looping `motion`.
- `avatar/pose/PoseController.ts` eases toward the target pose. `AvatarEngine` owns one (`engine.pose`) and adds its offsets on top of the small behavior offsets (idle, gaze), so blink, gaze and speech keep running during a pose.
- Rig conventions for this model (bones run along local +Y): arm roll lowers (left negative, right positive) or raises; pitch swings arms and thighs forward; calf pitch is negative to bend the knee; spine pitch leans forward.
- The default is A-Pose. `engine.reset()` snaps back to it.
- UI: `AvatarPosePanel` in the Studio sidebar (10 toggles, custom editor, mirror, body position, save/load in `localStorage`, copy JSON) and a pose select in the Connected page dock.
- Skinned meshes have `frustumCulled = false`, because their culling bounds stay at the bind pose and a lowered body (squat) would otherwise be culled.

## Expressions on this rig
- Morph and bone names are mapped in `modelProfile.ts` (`morphAliases`, `boneAliases`, `boneAxes`).
- The mouth opens with the `CC_Base_JawRoot` bone (canonical `Jaw`), driven from `jawOpen` by `jawBoneGain`; the jaw morph alone does not move the face.
- Visemes use the rig's `V_*` shapes plus a per-viseme jaw opening (`visemeJaw`). Names may share one raw shape; the facial engine takes the strongest request.
- Eye bones point backward along local Y, so gaze yaw is a rotation about local Z (`boneAxes`).
- Eye-occlusion and tear-line materials are hidden: this export gives them no alpha.

## Scene themes
`sceneThemes.ts` defines 9 backgrounds (Day, Evening, Dawn, Night, Moon, Full moon, Studio dark, Neon, Forest). The choice is stored in `localStorage`.

## Model asset
`Untitled.slim.glb` is built from `Untitled.glb` (kept untouched) by keeping only the morph targets the engine uses, dropping vertex colors, converting textures to WebP at 1024 px, and meshopt-compressing geometry.

## Page UI and theming
- Colors, radii and shadows are CSS variables in `app/globals.css`; `:root[data-theme="dark"]` overrides them. `ThemeToggle` stores `light | dark | system` in `localStorage` (`avatar-ui-theme`), and an inline script in `app/layout.tsx` applies it before first paint so there is no flash. The 3D backdrop picker is independent of this page theme.
- The Studio is a full-height app shell. The sidebar (`.debug-panel`) is its own scroll container (`.sidebar-body`) with a fixed header and tab bar, so the page itself never scrolls on desktop.
- Sidebar tabs: Poses, Face, Behavior, Lighting, Inspect. Sections carry `data-tab`; CSS shows only the active tab's sections, which keeps every control mounted so state is never lost when switching tabs. The last tab is remembered.
- Below 860px the layout stacks and the sidebar keeps its own scroll area with a capped height.

## Lighting tab
- `LightingPanel` edits a copy of the active scene theme: sky top, horizon/fog, floor, stars, an optional moon or sun disc, key and rim lights (color, intensity, direction and height as angles), ambient and sky bounce. Any edit turns the scene into "Custom", which is saved in `localStorage` (`avatar-scene-custom`) and validated on load.
- The quick preset toggle on the canvas is unchanged. Picking a preset there (or in the tab) replaces the custom edits; "Reset custom lighting" goes back to the last preset.

## Saving the avatar look and the Connected page
- **Save look** (Studio toolbar and sidebar header) stores one `AvatarState` JSON in `localStorage` (`avatar-saved-state`, see `avatar/state/avatarState.ts`): pose (preset or custom bones and body offset), face (emotion, intensity, manual morph sliders, gaze), behavior (natural behavior, reduced motion), scene (preset or custom lighting) and camera (face view or full body). Runtime activity and the page's light/dark theme are not saved. "Clear" in the sidebar removes it.
- The Studio restores the saved look on load. `/avtaar-connected` renders it automatically and shows nothing else from the Studio; without a save it uses A-Pose and the Day scene. Unsaved Studio experiments never reach the Connected page.
- On the Connected page the saved expression becomes the conversation baseline (`ConversationCoordinator.setBaseline`), so the avatar returns to it after disconnects. Saved manual face weights are applied below the speech priority, so lip-sync is never frozen by them.
- The Connected page is a viewer plus a Gemini sidebar (`GeminiPanel`): connection status, Connect/Disconnect, microphone, speaker mute, stop audio, message box and transcript. The speaker test, local recording, microphone device picker, and pose/emotion pickers were removed from the UI; the hook still provides them.
- Corrupt or invalid saved data is rejected as a whole (`parseAvatarState`) and the defaults are used.
