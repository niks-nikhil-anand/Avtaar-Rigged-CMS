import type { AvatarEngine } from "./AvatarEngine";
import type { ModelBindings } from "../types";
import { EyeEngine } from "./EyeEngine";
import { IdleEngine } from "./IdleEngine";
import { EmotionEngine } from "./EmotionEngine";
import { LipSyncEngine } from "./LipSyncEngine";
import type { BehaviorState, Emotion } from "./behaviorConfig";

export class BehaviorController {
  private eyes: EyeEngine;
  private idle = new IdleEngine();
  readonly emotion: EmotionEngine;
  readonly lips: LipSyncEngine;
  state: BehaviorState = "idle";
  enabled = false;
  reducedMotion = false;
  constructor(private engine: AvatarEngine, bindings: ModelBindings, private random: () => number = Math.random) {
    const supported = new Set(bindings.morphs.keys());
    this.eyes = new EyeEngine(random);
    this.emotion = new EmotionEngine(supported);
    this.lips = new LipSyncEngine(supported);
  }
  enable(): void {
    if (this.enabled || this.engine.status === "disposed") return;
    this.enabled = true;
    if (this.state === "speaking") this.lips.startSpeaking();
    this.engine.addSystem("behavior:clock", { priority: 0, update: (delta) => {
      const eyes = this.eyes.update(delta, this.state, this.reducedMotion);
      this.engine.setLayer("behavior:blink", { priority: 100, channels: eyes.blink });
      this.engine.setLayer("behavior:gaze", { priority: 50, channels: eyes.gaze });
      this.engine.setLayer("behavior:idle", { priority: 20, channels: this.idle.update(delta, this.state, this.reducedMotion) });
      this.engine.setLayer("behavior:pose", { priority: 40, channels: this.idle.relaxedPose() });
      this.engine.setLayer("behavior:emotion", { priority: 70, channels: this.emotion.update(this.state === "thinking") });
      this.engine.setLayer("behavior:speech", { priority: 90, channels: this.lips.update(delta) });
      return {};
    }, dispose: () => {
      this.enabled = false;
      for (const source of ["blink", "gaze", "idle", "pose", "emotion", "speech"]) this.engine.mixer.removeLayer(`behavior:${source}`);
      this.lips.stopSpeaking();
    } });
  }
  disable(): void {
    this.enabled = false;
    this.engine.removeSystem("behavior:clock");
    for (const source of ["blink", "gaze", "idle", "pose", "emotion", "speech"]) this.engine.mixer.removeLayer(`behavior:${source}`);
    this.lips.stopSpeaking();
  }
  setState(state: BehaviorState): void {
    if (!["idle", "listening", "thinking", "speaking"].includes(state)) return;
    this.state = state;
    if (state === "speaking") this.lips.startSpeaking(); else this.lips.stopSpeaking();
  }
  setEmotion(emotion: Emotion, intensity?: number): void { this.emotion.setEmotion(emotion, intensity); }
  setReducedMotion(value: boolean): void { this.reducedMotion = value; }
  setLookAt(x: number, y: number): void { this.eyes.setLookAt(x, y); }
  releaseLookAt(): void { this.eyes.releaseLookAt(); }
  getLookAt(): { x: number; y: number } | null { return this.eyes.getLookAt(); }
  reset(): void {
    this.disable(); this.state = "idle"; this.emotion.setEmotion("neutral", 0.7);
    this.eyes = new EyeEngine(this.random); this.idle = new IdleEngine();
  }
}
