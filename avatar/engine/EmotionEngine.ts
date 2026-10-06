import type { AnimationChannels } from "./AnimationMixer";
import { clamp01, type Emotion } from "./behaviorConfig";

const profiles: Record<Emotion, Record<string, number>> = {
  neutral: {},
  happy: { mouthSmileLeft: 0.95, mouthSmileRight: 0.95, cheekSquintLeft: 0.35, cheekSquintRight: 0.35 },
  sad: { mouthFrownLeft: 0.9, mouthFrownRight: 0.9, browInnerUp: 0.85 },
  angry: { browDownLeft: 1, browDownRight: 1, eyeSquintLeft: 0.45, eyeSquintRight: 0.45, mouthPressLeft: 0.45, mouthPressRight: 0.45 },
  surprised: { browInnerUp: 0.9, browOuterUpLeft: 0.85, browOuterUpRight: 0.85, eyeWideLeft: 0.95, eyeWideRight: 0.95, jawOpen: 0.2 },
  thinking: { browDownLeft: 0.3, browInnerUp: 0.3, mouthPucker: 0.2 },
};
export class EmotionEngine {
  emotion: Emotion = "neutral";
  intensity = 0.7;
  constructor(private supported: ReadonlySet<string>) {}
  setEmotion(emotion: Emotion, intensity = this.intensity): void {
    if (!Object.hasOwn(profiles, emotion) || !Number.isFinite(intensity)) return;
    this.emotion = emotion; this.intensity = clamp01(intensity);
  }
  update(thinking = false): AnimationChannels {
    const profile = profiles[thinking && this.emotion === "neutral" ? "thinking" : this.emotion];
    const channels: AnimationChannels = {};
    for (const [name, value] of Object.entries(profile)) if (this.supported.has(name)) channels[`morph:${name}`] = value * this.intensity;
    return channels;
  }
}
