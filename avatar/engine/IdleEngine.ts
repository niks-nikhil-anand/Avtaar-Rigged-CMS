import type { AnimationChannels } from "./AnimationMixer";
import type { BehaviorState } from "./behaviorConfig";

export class IdleEngine {
  private time = 0;
  private strength = 0;
  update(delta: number, state: BehaviorState, reducedMotion: boolean): AnimationChannels {
    this.time += delta;
    const target = reducedMotion ? 0 : state === "listening" ? 0.25 : state === "thinking" ? 0.45 : state === "speaking" ? 0.7 : 1;
    this.strength += (target - this.strength) * (1 - Math.exp(-5 * delta));
    return {
      "bone:Spine1:pitch": Math.sin(this.time * 1.5) * 0.008 * this.strength,
      "bone:Spine2:pitch": Math.sin(this.time * 1.5) * 0.006 * this.strength,
      "bone:Head:yaw": Math.sin(this.time * 0.65) * 0.025 * this.strength,
      "bone:Neck:pitch": Math.sin(this.time * 0.8) * 0.012 * this.strength,
    };
  }
  relaxedPose(): AnimationChannels {
    // This GLB's upper-arm local X axes map to opposite world Z directions.
    return { "bone:LeftArm:pitch": 1.1, "bone:RightArm:pitch": 1.1 };
  }
}
