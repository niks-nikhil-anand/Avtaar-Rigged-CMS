import type { Bone, Mesh, Quaternion, Vector3 } from "three";

export interface ModelReport {
  meshes: { name: string; morphs: string[]; materials: string[] }[];
  bones: string[];
  animations: string[];
  bounds: [number, number, number];
}

export interface MorphBinding {
  mesh: Mesh;
  index: number;
  initial: number;
}

export interface BoneBinding {
  bone: Bone;
  quaternion: Quaternion;
  position: Vector3;
  scale: Vector3;
  /** Same-named bones in other skeletons of the asset, driven with the same offset. */
  copies?: Omit<BoneBinding, "copies">[];
}

export interface ModelBindings {
  morphs: Map<string, MorphBinding[]>;
  bones: Map<string, BoneBinding>;
  unsupported: string[];
  setMorph: (name: string, weight: number) => void;
  /** `wide` allows full-range pose angles; otherwise offsets are limited to the small behavior range. */
  setBoneRotation: (name: string, pitch: number, yaw: number, roll?: number, wide?: boolean) => void;
  reset: () => void;
}
