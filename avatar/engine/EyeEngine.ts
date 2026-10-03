import type { AnimationChannels } from "./AnimationMixer";
import type { BehaviorState } from "./behaviorConfig";

export class EyeEngine {
  private time = 0;
  private nextBlink: number;
  private nextGaze = 0;
  private gaze = { x: 0, y: 0 };
  private lookTarget: { x: number; y: number } | null = null;
  constructor(private random: () => number = Math.random) { this.nextBlink = this.interval(); }
  private interval() { return 2.8 + Math.max(0, Math.min(1, this.random())) * 3.2; }
  setLookAt(x: number, y: number): void {
    if (Number.isFinite(x) && Number.isFinite(y)) this.lookTarget = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  }
  releaseLookAt(): void { this.lookTarget = null; }
  update(delta: number, state: BehaviorState, reducedMotion: boolean): { blink: AnimationChannels; gaze: AnimationChannels } {
    this.time += delta;
    const phase = this.time - this.nextBlink;
    let blink = 0;
    if (phase >= 0 && phase < 0.32) {
      const value = phase < 0.09 ? phase / 0.09 : phase < 0.16 ? 1 : 1 - (phase - 0.16) / 0.16;
      blink = value * value * (3 - 2 * value);
    } else if (phase >= 0.32) this.nextBlink += 0.32 + this.interval();
    if (this.time >= this.nextGaze) {
      this.gaze = { x: (this.random() - 0.5) * 0.6, y: (this.random() - 0.5) * 0.3 };
      this.nextGaze = this.time + 2 + this.random() * 3;
    }
    const target = this.lookTarget ?? (reducedMotion || state === "listening" ? { x: 0, y: 0 } : state === "thinking" ? { x: 0.35, y: 0.25 } : this.gaze);
    return { blink: { "morph:eyeBlinkLeft": blink, "morph:eyeBlinkRight": blink }, gaze: { "bone:LeftEye:yaw": target.x * 0.12, "bone:RightEye:yaw": target.x * 0.12, "bone:LeftEye:pitch": -target.y * 0.09, "bone:RightEye:pitch": -target.y * 0.09 } };
  }
}
