export const modelProfile = {
  url: "/model.glb",
  displayHeight: 2.8,
  controls: ["eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "mouthSmileLeft", "mouthSmileRight", "mouthFrownLeft", "mouthFrownRight"],
  bones: ["Head", "Neck", "LeftEye", "RightEye"],
  presets: {
    Blink: { eyeBlinkLeft: 1, eyeBlinkRight: 1 },
    Smile: { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 },
    "Open jaw": { jawOpen: 0.65 },
  } as Record<string, Record<string, number>>,
};
