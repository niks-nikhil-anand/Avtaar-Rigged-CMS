import type { AvatarEngine } from "../engine/AvatarEngine";
import { animationPriorities } from "../engine/AnimationMixer";
import { clamp01, emotions, type Emotion } from "../engine/behaviorConfig";
import { customPoseId } from "../pose/PoseController";
import { findPose, type Euler3 } from "../pose/poses";
import { validateCustomTheme, type SceneTheme } from "../../components/avatar/sceneThemes";

export const savedStateKey = "avatar-saved-state";
export const manualFaceSource = "debug:morph";
export const savedFaceSource = "saved:face";

export interface AvatarState {
  version: 1;
  savedAt: string;
  pose: { id: string; bones: Record<string, Euler3>; root: { x: number; y: number } };
  face: { emotion: Emotion; intensity: number; morphs: Record<string, number>; gaze: { x: number; y: number } | null };
  behavior: { naturalBehavior: boolean; reducedMotion: boolean };
  scene: { themeId: string; custom: SceneTheme | null };
  camera: { closeUp: boolean };
}

export interface CaptureExtras { scene: { themeId: string; custom: SceneTheme | null }; closeUp: boolean }

/** Everything that makes up the avatar's look. Runtime activity (speaking, preview visemes, pause) is deliberately left out. */
export function captureAvatarState(engine: AvatarEngine, extras: CaptureExtras, now: Date = new Date()): AvatarState {
  const pose = engine.pose.snapshot();
  return {
    version: 1,
    savedAt: now.toISOString(),
    pose: { id: engine.pose.id, bones: pose.bones, root: pose.root },
    face: {
      emotion: engine.behavior.emotion.emotion,
      intensity: engine.behavior.emotion.intensity,
      morphs: engine.face.getExpression(manualFaceSource),
      gaze: engine.behavior.getLookAt(),
    },
    behavior: { naturalBehavior: engine.behavior.enabled, reducedMotion: engine.behavior.reducedMotion },
    scene: { themeId: extras.scene.themeId, custom: extras.scene.custom },
    camera: { closeUp: extras.closeUp },
  };
}

/**
 * Put a saved look onto an engine.
 * - studio: restores everything, including manual face sliders at debug priority and the natural-behavior switch.
 * - connected: the conversation coordinator owns emotion and behavior state, so only pose, gaze and reduced motion are applied here;
 *   manual face weights go in below speech priority so a saved jaw or smile can never freeze lip-sync.
 */
export function applyAvatarState(engine: AvatarEngine, state: AvatarState, mode: "studio" | "connected"): void {
  const preset = state.pose.id !== customPoseId && findPose(state.pose.id).id === state.pose.id;
  if (preset) engine.pose.reset(state.pose.id);
  else engine.pose.load(state.pose.bones, state.pose.root, true);

  engine.behavior.setReducedMotion(state.behavior.reducedMotion);
  if (state.face.gaze && (state.face.gaze.x !== 0 || state.face.gaze.y !== 0)) engine.behavior.setLookAt(state.face.gaze.x, state.face.gaze.y);
  const hasMorphs = Object.keys(state.face.morphs).length > 0;

  if (mode === "studio") {
    engine.start();
    if (state.behavior.naturalBehavior) engine.behavior.enable(); else engine.behavior.disable();
    engine.behavior.setEmotion(state.face.emotion, state.face.intensity);
    if (hasMorphs) engine.setExpression(state.face.morphs, manualFaceSource, animationPriorities.debug);
  } else if (hasMorphs) {
    engine.setExpression(state.face.morphs, savedFaceSource, animationPriorities.emotion);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const limit = (value: number, max: number) => Math.max(-max, Math.min(max, value));

/** Saved data comes from storage, so check every field and fall back to nothing rather than half-applying a broken save. */
export function parseAvatarState(raw: string | null): AvatarState | null {
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value) || value.version !== 1 || typeof value.savedAt !== "string") return null;
  const { pose, face, behavior, scene, camera } = value;
  if (!isRecord(pose) || !isRecord(face) || !isRecord(behavior) || !isRecord(scene) || !isRecord(camera)) return null;
  if (typeof pose.id !== "string" || !isRecord(pose.bones) || !isRecord(pose.root) || !finite(pose.root.x) || !finite(pose.root.y)) return null;

  const bones: Record<string, Euler3> = {};
  for (const [name, angles] of Object.entries(pose.bones)) {
    if (!Array.isArray(angles) || angles.length !== 3 || !angles.every(finite)) return null;
    bones[name] = [limit(angles[0], Math.PI), limit(angles[1], Math.PI), limit(angles[2], Math.PI)];
  }
  if (typeof face.emotion !== "string" || !emotions.includes(face.emotion as Emotion) || !finite(face.intensity) || !isRecord(face.morphs)) return null;
  const morphs: Record<string, number> = {};
  for (const [name, weight] of Object.entries(face.morphs)) {
    if (!finite(weight)) return null;
    morphs[name] = clamp01(weight);
  }
  let gaze: { x: number; y: number } | null = null;
  if (face.gaze !== null && face.gaze !== undefined) {
    if (!isRecord(face.gaze) || !finite(face.gaze.x) || !finite(face.gaze.y)) return null;
    gaze = { x: limit(face.gaze.x, 1), y: limit(face.gaze.y, 1) };
  }
  if (typeof behavior.naturalBehavior !== "boolean" || typeof behavior.reducedMotion !== "boolean") return null;
  if (typeof scene.themeId !== "string" || typeof camera.closeUp !== "boolean") return null;
  const custom = scene.custom === null || scene.custom === undefined ? null : validateCustomTheme(scene.custom);
  if (scene.custom && !custom) return null;

  return {
    version: 1,
    savedAt: value.savedAt,
    pose: { id: pose.id, bones, root: { x: limit(pose.root.x, 2), y: limit(pose.root.y, 2) } },
    face: { emotion: face.emotion as Emotion, intensity: clamp01(face.intensity), morphs, gaze },
    behavior: { naturalBehavior: behavior.naturalBehavior, reducedMotion: behavior.reducedMotion },
    scene: { themeId: scene.themeId, custom },
    camera: { closeUp: camera.closeUp },
  };
}

export function loadSavedState(): AvatarState | null {
  try { return parseAvatarState(localStorage.getItem(savedStateKey)); } catch { return null; }
}
/** Returns an error message, or null when the save worked. */
export function saveState(state: AvatarState): string | null {
  try { localStorage.setItem(savedStateKey, JSON.stringify(state)); return null; }
  catch { return "Could not save: browser storage is unavailable or full."; }
}
export function clearSavedState(): void {
  try { localStorage.removeItem(savedStateKey); } catch { /* nothing to clear */ }
}
