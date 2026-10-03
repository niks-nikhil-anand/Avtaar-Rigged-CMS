export type BehaviorState = "idle" | "listening" | "thinking" | "speaking";
export type Emotion = "neutral" | "happy" | "sad" | "angry" | "surprised" | "thinking";
export const behaviorStates: BehaviorState[] = ["idle", "listening", "thinking", "speaking"];
export const emotions: Emotion[] = ["neutral", "happy", "sad", "angry", "surprised", "thinking"];
export const visemes = ["CH", "DD", "E", "FF", "PP", "RR", "SS", "TH", "aa", "ih", "kk", "nn", "oh", "ou", "sil"] as const;
export type Viseme = typeof visemes[number];
export function boneLimit(name: string, axis = "pitch"): number {
  if (name === "LeftEye" || name === "RightEye") return 0.18;
  if ((name === "LeftArm" || name === "RightArm") && axis === "pitch") return 1.25;
  return 0.25;
}
export const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
