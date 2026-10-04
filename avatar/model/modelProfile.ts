export type BoneAxis = "x" | "y" | "z" | "-x" | "-y" | "-z";

export const modelProfile = {
  url: "/taro.glb",
  displayHeight: 2.8,
  controls: ["eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "mouthSmileLeft", "mouthSmileRight", "mouthFrownLeft", "mouthFrownRight"],
  bones: ["Head", "Neck", "LeftEye", "RightEye"],
  /** Canonical engine bone name → bone name in the asset. The asset may hold several skeleton copies per name. Arms are left unmapped: this asset already rests in an A-pose. */
  boneAliases: {
    Head: "head",
    Neck: "neck_02",
    LeftEye: "FACIAL_L_Eye",
    RightEye: "FACIAL_R_Eye",
  } as Record<string, string>,
  /** Asset bone name → local axis (optionally negated) carrying each canonical pitch/yaw/roll, for bones not oriented X-right, Y-up, Z-forward. */
  boneAxes: {
    head: { pitch: "-z", yaw: "x", roll: "-y" },
    neck_02: { pitch: "-z", yaw: "x", roll: "-y" },
  } as Record<string, Record<"pitch" | "yaw" | "roll", BoneAxis>>,
  presets: {
    Blink: { eyeBlinkLeft: 1, eyeBlinkRight: 1 },
    Smile: { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 },
    "Open jaw": { jawOpen: 0.65 },
  } as Record<string, Record<string, number>>,
};
