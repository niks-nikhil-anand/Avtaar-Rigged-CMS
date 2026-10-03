import type { ModelBindings } from "../types";
import { AnimationMixer, animationPriorities, type AnimationChannels } from "./AnimationMixer";

export class FacialEngine {
  private targets = new Map<string, Record<string, number>>();
  private neutralControls = new Set<string>();

  constructor(private bindings: ModelBindings, private mixer: AnimationMixer, private damping = 14) {}

  setExpression(weights: Record<string, number>, source = "expression", priority: number = animationPriorities.emotion, weight = 1): void {
    const supported: Record<string, number> = {};
    const channels: AnimationChannels = {};
    for (const [name, value] of Object.entries(weights)) {
      if (!this.bindings.morphs.has(name) || !Number.isFinite(value)) continue;
      supported[name] = Math.max(0, Math.min(1, value));
      channels[`morph:${name}`] = supported[name];
    }
    this.targets.set(source, supported);
    this.mixer.setLayer(source, { priority, weight, channels });
  }

  setMorph(name: string, value: number, source = "expression", priority: number = animationPriorities.emotion): void {
    if (!this.bindings.morphs.has(name) || !Number.isFinite(value)) return;
    this.setExpression({ ...this.targets.get(source), [name]: value }, source, priority);
  }

  resetExpression(source = "expression"): void {
    this.targets.delete(source);
    this.mixer.removeLayer(source);
  }

  clear(): void {
    for (const source of this.targets.keys()) this.mixer.removeLayer(source);
    this.targets.clear();
    this.neutralControls.clear();
  }

  /** Conversation silence owns only speech controls, preserving each mesh's rest weight. */
  setNeutralControls(names: readonly string[], active: boolean): void {
    for (const name of names) {
      if (active) this.neutralControls.add(name); else this.neutralControls.delete(name);
      if (active) for (const entry of this.bindings.morphs.get(name) ?? []) {
        if (entry.mesh.morphTargetInfluences) entry.mesh.morphTargetInfluences[entry.index] = entry.initial;
      }
    }
  }

  update(delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    for (const [name, entries] of this.bindings.morphs) {
      const alpha = 1 - Math.exp(-(name.startsWith("eyeBlink") ? 45 : this.damping) * delta);
      for (const entry of entries) {
        const target = this.neutralControls.has(name) ? entry.initial : Math.max(0, Math.min(1, this.mixer.resolve(`morph:${name}`, entry.initial)));
        const influences = entry.mesh.morphTargetInfluences;
        if (!influences) continue;
        const current = influences[entry.index];
        const next = current + (target - current) * alpha;
        influences[entry.index] = Math.abs(next - target) < 1e-6 ? target : next;
      }
    }
  }
}
