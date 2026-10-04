import { Bone, Mesh, Quaternion, Euler, MathUtils, type Object3D } from "three";
import type { ModelBindings, MorphBinding, BoneBinding } from "../types";
import { modelProfile } from "./modelProfile";
import { boneLimit } from "../engine/behaviorConfig";

export function resolveBindings(root: Object3D): ModelBindings {
  const morphs = new Map<string, MorphBinding[]>();
  const bones = new Map<string, BoneBinding>();
  const canonical = new Map(Object.entries(modelProfile.boneAliases).map(([name, alias]) => [alias, name]));
  root.traverse((node) => {
    if (node instanceof Mesh && node.morphTargetInfluences) {
      for (const [name, index] of Object.entries(node.morphTargetDictionary ?? {})) {
        const entries = morphs.get(name) ?? [];
        entries.push({ mesh: node, index, initial: node.morphTargetInfluences[index] });
        morphs.set(name, entries);
      }
    }
    if (node instanceof Bone) {
      const name = canonical.get(node.name) ?? node.name;
      const pose = { bone: node, quaternion: node.quaternion.clone(), position: node.position.clone(), scale: node.scale.clone() };
      // Assets that skin each garment separately repeat a bone per skeleton; every copy must move together.
      const existing = bones.get(name);
      if (existing) (existing.copies ??= []).push(pose);
      else bones.set(name, pose);
    }
  });
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
      const angles = { pitch: clamp(pitch, "pitch"), yaw: clamp(yaw, "yaw"), roll: clamp(roll, "roll") };
      const axes = modelProfile.boneAxes[entry.bone.name];
      const local = { x: 0, y: 0, z: 0 };
      if (axes) for (const axis of ["pitch", "yaw", "roll"] as const) local[axes[axis].slice(-1) as "x" | "y" | "z"] += axes[axis].startsWith("-") ? -angles[axis] : angles[axis];
      else Object.assign(local, { x: angles.pitch, y: angles.yaw, z: angles.roll });
      const offset = new Quaternion().setFromEuler(new Euler(local.x, local.y, local.z));
      for (const pose of [entry, ...(entry.copies ?? [])]) pose.bone.quaternion.copy(pose.quaternion).multiply(offset);
    },
    reset() {
      for (const entries of morphs.values()) for (const entry of entries) entry.mesh.morphTargetInfluences![entry.index] = entry.initial;
      for (const entry of bones.values()) for (const pose of [entry, ...(entry.copies ?? [])]) {
        pose.bone.quaternion.copy(pose.quaternion);
        pose.bone.position.copy(pose.position);
        pose.bone.scale.copy(pose.scale);
      }
      root.updateMatrixWorld(true);
    },
  };
}
