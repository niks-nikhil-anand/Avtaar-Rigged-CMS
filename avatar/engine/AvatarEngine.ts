import type { ModelBindings } from "../types";
import { AnimationMixer, animationPriorities, type AnimationChannels, type AnimationLayer } from "./AnimationMixer";
import { FacialEngine } from "./FacialEngine";
import { BehaviorController } from "./BehaviorController";
import { boneLimit, jawBoneGain, visemes } from "./behaviorConfig";
import { PoseController } from "../pose/PoseController";

const poseLimit = Math.PI;

export interface AnimationSystem {
  priority: number;
  weight?: number;
  update: (delta: number, elapsed: number) => AnimationChannels;
  dispose?: () => void;
}

/** Owns model writes and timing, but never starts a browser loop or depends on React. */
export class AvatarEngine {
  readonly mixer = new AnimationMixer();
  readonly face: FacialEngine;
  readonly behavior: BehaviorController;
  readonly pose = new PoseController();
  private systems = new Map<string, AnimationSystem>();
  private boneOffsets = new Map<string, { pitch: number; yaw: number; roll: number }>();
  private elapsed = 0;
  private failures = new Map<string, string>();
  private state: "stopped" | "running" | "disposed" = "stopped";

  constructor(private bindings: ModelBindings) {
    this.face = new FacialEngine(bindings, this.mixer);
    this.behavior = new BehaviorController(this, bindings);
  }

  /** True when the loaded model can show this morph, so UI can disable controls that would do nothing. */
  hasMorph(name: string): boolean { return this.bindings.morphs.has(name); }
  get status(): string { return this.state; }
  get time(): number { return this.elapsed; }
  get systemCount(): number { return this.systems.size; }
  get errors(): ReadonlyMap<string, string> { return this.failures; }
  start(): void { if (this.state !== "disposed") this.state = "running"; }
  stop(): void { if (this.state !== "disposed") this.state = "stopped"; }

  setSpeechSilence(silent: boolean): void {
    if (this.state === "disposed") return;
    if (silent) {
      this.behavior.lips.resetAmplitude(); this.behavior.lips.clearVisemes();
      this.mixer.removeLayer("behavior:speech");
    }
    this.face.setNeutralControls(["jawOpen", ...visemes], silent);
  }

  setMorph(name: string, value: number): void {
    if (this.state !== "disposed") this.face.setMorph(name, value, "debug:morph", animationPriorities.debug);
  }

  setExpression(weights: Record<string, number>, source = "expression", priority: number = animationPriorities.emotion): void {
    if (this.state !== "disposed") this.face.setExpression(weights, source, priority);
  }

  resetExpression(source = "expression"): void {
    if (this.state !== "disposed") this.face.resetExpression(source);
  }

  setLayer(source: string, layer: AnimationLayer): void {
    if (this.state !== "disposed") this.mixer.setLayer(source, layer);
  }

  removeLayer(source: string): void {
    if (this.state !== "disposed") this.face.resetExpression(source);
  }

  setBoneRotation(name: string, pitch: number, yaw: number): void {
    if (this.state === "disposed" || !this.bindings.bones.has(name) || !Number.isFinite(pitch) || !Number.isFinite(yaw)) return;
    this.mixer.setLayer(`debug:bone:${name}`, { priority: animationPriorities.debug, channels: { [`bone:${name}:pitch`]: pitch, [`bone:${name}:yaw`]: yaw } });
  }

  addSystem(source: string, system: AnimationSystem): void {
    if (this.state === "disposed" || !source || !Number.isFinite(system.priority)) return;
    this.removeSystem(source);
    this.failures.delete(source);
    this.systems.set(source, system);
  }

  removeSystem(source: string): void {
    const system = this.systems.get(source);
    this.systems.delete(source);
    this.mixer.removeLayer(source);
    try { system?.dispose?.(); }
    catch (error) { this.failures.set(source, error instanceof Error ? error.message : String(error)); }
  }

  update(delta: number): void {
    if (this.state !== "running" || !Number.isFinite(delta) || delta <= 0) return;
    // Avoid jumping through several seconds of motion when a background tab resumes.
    const step = Math.min(delta, 0.1);
    this.elapsed += step;
    for (const [source, system] of this.systems) {
      try {
        this.mixer.setLayer(source, { priority: system.priority, weight: system.weight, channels: system.update(step, this.elapsed) });
      } catch (error) {
        this.removeSystem(source);
        this.failures.set(source, error instanceof Error ? error.message : String(error));
      }
    }
    this.face.update(step);
    this.pose.update(step);
    const alpha = 1 - Math.exp(-14 * step);
    for (const name of this.bindings.bones.keys()) {
      const current = this.boneOffsets.get(name) ?? { pitch: 0, yaw: 0, roll: 0 };
      for (const axis of ["pitch", "yaw", "roll"] as const) {
        const limit = boneLimit(name, axis);
        // Behavior (idle, gaze) stays within its small limit; the pose adds on top and may use the full range.
        const behavior = Math.max(-limit, Math.min(limit, this.mixer.resolve(`bone:${name}:${axis}`)));
        // The jaw bone opens the mouth; it follows the same "jawOpen" value the morph rigs use.
        const jaw = name === "Jaw" && axis === "roll" ? this.face.control("jawOpen") * jawBoneGain : 0;
        const target = Math.max(-poseLimit, Math.min(poseLimit, behavior + this.pose.offset(name, axis) + jaw));
        current[axis] += (target - current[axis]) * alpha;
        if (Math.abs(current[axis]) < 1e-6) current[axis] = 0;
      }
      this.bindings.setBoneRotation(name, current.pitch, current.yaw, current.roll, true);
      this.boneOffsets.set(name, current);
    }
  }

  /** Immediate exact reset, including running sources so the next frame remains neutral. */
  reset(): void {
    this.behavior.reset();
    this.pose.reset();
    for (const source of [...this.systems.keys()]) this.removeSystem(source);
    this.face.clear();
    this.mixer.clear();
    this.boneOffsets.clear();
    this.elapsed = 0;
    this.failures.clear();
    this.bindings.reset();
  }

  dispose(): void {
    if (this.state === "disposed") return;
    this.state = "disposed";
    this.reset();
  }
}
