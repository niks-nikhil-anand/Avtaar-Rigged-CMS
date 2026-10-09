import type { AnimationChannels } from "./AnimationMixer";
import type { BehaviorState } from "./behaviorConfig";
import { BlinkCoordinator, defaultBlinkConfig } from "./BlinkCoordinator";
import { EyeController, defaultEyeRigConfig } from "./EyeController";
import type { EyeTarget } from "./EyeController";
import { GazeBehaviorEngine } from "./GazeBehaviorEngine";
import { SaccadeEngine, defaultSaccadeConfig } from "./SaccadeEngine";

export class EyeEngine {
  private lookTarget: { x: number; y: number } | null = null;
  private blinks: BlinkCoordinator;
  private behavior = new GazeBehaviorEngine();
  private controller = new EyeController(defaultEyeRigConfig);
  private saccades: SaccadeEngine;
  constructor(private random: () => number = Math.random) {
    this.blinks = new BlinkCoordinator({ ...defaultBlinkConfig, random });
    this.saccades = new SaccadeEngine({ ...defaultSaccadeConfig, random });
  }
  setLookAt(x: number, y: number): void {
    if (Number.isFinite(x) && Number.isFinite(y)) this.lookTarget = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  }
  releaseLookAt(): void { this.lookTarget = null; }
  getLookAt(): { x: number; y: number } | null { return this.lookTarget ? { ...this.lookTarget } : null; }
  update(delta: number, state: BehaviorState, reducedMotion: boolean): { blink: AnimationChannels; gaze: AnimationChannels; target: EyeTarget } {
    const blink = this.blinks.update({ deltaTime: delta, behaviorState: state, reducedMotion }).blinkWeight;
    const target = this.lookTarget ?? this.behavior.update({ state, deltaTime: delta, reducedMotion });
    this.controller.setTarget(this.saccades.update({ baseTarget: target, deltaTime: delta, reducedMotion, behaviorState: state }));
    return { blink: { "morph:eyeBlinkLeft": blink, "morph:eyeBlinkRight": blink }, gaze: this.controller.toChannels(this.controller.update(delta)), target: { ...target } };
  }
}
