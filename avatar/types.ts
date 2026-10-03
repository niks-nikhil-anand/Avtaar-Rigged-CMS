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
}

export interface ModelBindings {
  morphs: Map<string, MorphBinding[]>;
  bones: Map<string, BoneBinding>;
  unsupported: string[];
  setMorph: (name: string, weight: number) => void;
  setBoneRotation: (name: string, pitch: number, yaw: number, roll?: number) => void;
  reset: () => void;
}
