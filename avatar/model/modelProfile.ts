const pair = (base: string) => [`${base}_L`, `${base}_R`];

/** Engine (ARKit-style) morph name -> this model's (Character Creator style) morph names. Applied only when the canonical name is absent. */
export const morphAliases: Record<string, string[]> = {
  eyeBlinkLeft: ["Eye_Blink_L"], eyeBlinkRight: ["Eye_Blink_R"],
  eyeWideLeft: ["Eye_Widen_L"], eyeWideRight: ["Eye_Widen_R"],
  eyeSquintLeft: ["Eye_Squint_Inner_L"], eyeSquintRight: ["Eye_Squint_Inner_R"],
  cheekSquintLeft: ["Eye_Cheek_Raise_L"], cheekSquintRight: ["Eye_Cheek_Raise_R"],
  browDownLeft: ["Brow_Down_L"], browDownRight: ["Brow_Down_R"],
  browInnerUp: pair("Brow_Raise_In"),
  browOuterUpLeft: ["Brow_Raise_Outer_L"], browOuterUpRight: ["Brow_Raise_Outer_R"],
  jawOpen: ["Jaw_Open"],
  mouthSmileLeft: ["Mouth_Corner_Pull_L", "Mouth_Corner_Up_L"], mouthSmileRight: ["Mouth_Corner_Pull_R", "Mouth_Corner_Up_R"],
  mouthFrownLeft: ["Mouth_Corner_Depress_L"], mouthFrownRight: ["Mouth_Corner_Depress_R"],
  mouthPressLeft: ["Mouth_Lips_Press_L"], mouthPressRight: ["Mouth_Lips_Press_R"],
  mouthPucker: ["Mouth_Lips_Purse_UL", "Mouth_Lips_Purse_UR", "Mouth_Lips_Purse_DL", "Mouth_Lips_Purse_DR"],
  aa: ["V_Open"], PP: ["V_Explosive"], FF: ["V_Dental_Lip"], oh: ["V_Tight_O"],
  E: ["V_Wide"], CH: ["V_Affricate"], SS: ["V_Tight"], sil: ["V_None"],
};

/** Engine bone name -> this model's bone name. Arms are deliberately omitted: this rig is already in a relaxed pose. */
export const boneAliases: Record<string, string> = {
  Head: "CC_Base_Head", Neck: "CC_Base_NeckTwist01",
  LeftEye: "CC_Base_L_Eye", RightEye: "CC_Base_R_Eye",
  Spine1: "CC_Base_Spine01", Spine2: "CC_Base_Spine02",
};

export const modelProfile = {
  url: "/avtaar-rigged-blender/Untitled.glb",
  displayHeight: 2.8,
  controls: ["eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "mouthSmileLeft", "mouthSmileRight", "mouthFrownLeft", "mouthFrownRight"],
  bones: ["Head", "Neck", "LeftEye", "RightEye"],
  presets: {
    Blink: { eyeBlinkLeft: 1, eyeBlinkRight: 1 },
    Smile: { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 },
    "Open jaw": { jawOpen: 0.65 },
  } as Record<string, Record<string, number>>,
};
