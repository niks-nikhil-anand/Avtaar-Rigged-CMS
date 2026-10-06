import { Bone, Mesh, Quaternion, Euler, MathUtils, type Object3D } from "three";
import type { ModelBindings, MorphBinding, BoneBinding } from "../types";
import { modelProfile, morphAliases, boneAliases } from "./modelProfile";
import { boneLimit } from "../engine/behaviorConfig";

export function resolveBindings(root: Object3D): ModelBindings {
  const morphs = new Map<string, MorphBinding[]>();
  const bones = new Map<string, BoneBinding>();
  root.traverse((node) => {
    if (node instanceof Mesh && node.morphTargetInfluences) {
      for (const [name, index] of Object.entries(node.morphTargetDictionary ?? {})) {
        const entries = morphs.get(name) ?? [];
        entries.push({ mesh: node, index, initial: node.morphTargetInfluences[index] });
        morphs.set(name, entries);
      }
    }
    if (node instanceof Bone) bones.set(node.name, { bone: node, quaternion: node.quaternion.clone(), position: node.position.clone(), scale: node.scale.clone() });
  });
  for (const [canonical, targets] of Object.entries(morphAliases)) {
    if (morphs.has(canonical)) continue;
    const entries = targets.flatMap((target) => morphs.get(target) ?? []);
    if (entries.length) morphs.set(canonical, entries);
  }
  // Drop the raw names so each morph/bone has a single owner; two keys on one target would fight every frame.
  for (const [canonical, targets] of Object.entries(morphAliases)) if (morphs.has(canonical)) for (const target of targets) morphs.delete(target);
  for (const [canonical, target] of Object.entries(boneAliases)) {
    const entry = bones.get(target);
    if (entry && !bones.has(canonical)) { bones.set(canonical, entry); bones.delete(target); }
  }
  return {
    morphs, bones,
    unsupported: [...modelProfile.controls.filter((name) => !morphs.has(name)), ...modelProfile.bones.filter((name) => !bones.has(name))],
    setMorph(name, weight) {
      if (!Number.isFinite(weight)) return;
      for (const entry of morphs.get(name) ?? []) entry.mesh.morphTargetInfluences![entry.index] = MathUtils.clamp(weight, 0, 1);
    },
    setBoneRotation(name, pitch, yaw, roll = 0) {
      const entry = bones.get(name);
      if (!entry || ![pitch, yaw, roll].every(Number.isFinite)) return;
      const clamp = (value: number, axis: string) => MathUtils.clamp(value, -boneLimit(name, axis), boneLimit(name, axis));
      const offset = new Quaternion().setFromEuler(new Euler(clamp(pitch, "pitch"), clamp(yaw, "yaw"), clamp(roll, "roll")));
      entry.bone.quaternion.copy(entry.quaternion).multiply(offset);
    },
    reset() {
      for (const entries of morphs.values()) for (const entry of entries) entry.mesh.morphTargetInfluences![entry.index] = entry.initial;
      for (const entry of bones.values()) {
        entry.bone.quaternion.copy(entry.quaternion);
        entry.bone.position.copy(entry.position);
        entry.bone.scale.copy(entry.scale);
      }
      root.updateMatrixWorld(true);
    },
  };
}
