import { Box3, Mesh, Bone, Vector3, type Object3D, type AnimationClip } from "three";
import type { ModelReport } from "../types";

export function inspectModel(root: Object3D, animations: AnimationClip[] = []): ModelReport {
  root.updateMatrixWorld(true);
  const report: ModelReport = { meshes: [], bones: [], animations: animations.map((clip) => clip.name), bounds: [0, 0, 0] };
  root.traverse((node) => {
    if (node instanceof Mesh) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      report.meshes.push({ name: node.name || `mesh-${report.meshes.length}`, morphs: Object.keys(node.morphTargetDictionary ?? {}), materials: materials.map((material) => material.name || material.type) });
    }
    if (node instanceof Bone) report.bones.push(node.name);
  });
  report.bounds = new Box3().setFromObject(root).getSize(new Vector3()).toArray() as [number, number, number];
  return report;
}
