export type BehaviorState = "idle" | "listening" | "thinking" | "speaking";
export type Emotion = "neutral" | "happy" | "sad" | "angry" | "surprised" | "thinking";
export const behaviorStates: BehaviorState[] = ["idle", "listening", "thinking", "speaking"];
export const emotions: Emotion[] = ["neutral", "happy", "sad", "angry", "surprised", "thinking"];
export const visemes = ["CH", "DD", "E", "FF", "PP", "RR", "SS", "TH", "aa", "ih", "kk", "nn", "oh", "ou", "sil"] as const;
export type Viseme = typeof visemes[number];
/** How far the jaw drops for each mouth shape (0-1), so shapes that need an open mouth are visible on rigs whose viseme morphs only move the lips. */
export const visemeJaw: Record<Viseme, number> = {
  CH: 0.15, DD: 0.25, E: 0.25, FF: 0.05, PP: 0, RR: 0.15, SS: 0.1, TH: 0.2, aa: 0.55, ih: 0.15, kk: 0.3, nn: 0.15, oh: 0.4, ou: 0.2, sil: 0,
};
export function boneLimit(name: string, axis = "pitch"): number {
  if (name === "LeftEye" || name === "RightEye") return 0.18;
  if (/^(Left|Right)(Clavicle|Upperarm|Forearm|Hand)$/.test(name)) return 0.65;
  if ((name === "LeftArm" || name === "RightArm") && axis === "pitch") return 1.25;
  return 0.25;
}
export const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** On rigs whose mouth opens with the jaw bone, a full "jawOpen" of 1 rotates it this many radians. */
export const jawBoneGain = 0.4;
