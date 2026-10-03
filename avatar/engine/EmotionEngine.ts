import type { AnimationChannels } from "./AnimationMixer";
import { clamp01, type Emotion } from "./behaviorConfig";

const profiles: Record<Emotion, Record<string, number>> = {
  neutral: {},
  happy: { mouthSmileLeft: 0.7, mouthSmileRight: 0.7, cheekSquintLeft: 0.15, cheekSquintRight: 0.15 },
  sad: { mouthFrownLeft: 0.5, mouthFrownRight: 0.5, browInnerUp: 0.45 },
  angry: { browDownLeft: 0.65, browDownRight: 0.65, eyeSquintLeft: 0.2, eyeSquintRight: 0.2, mouthPressLeft: 0.2, mouthPressRight: 0.2 },
  surprised: { browInnerUp: 0.6, browOuterUpLeft: 0.55, browOuterUpRight: 0.55, eyeWideLeft: 0.55, eyeWideRight: 0.55, jawOpen: 0.2 },
  thinking: { browDownLeft: 0.15, browInnerUp: 0.2, mouthPucker: 0.1 },
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
