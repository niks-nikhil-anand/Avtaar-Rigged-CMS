import { boneLimit } from "./behaviorConfig";
export type AnimationChannel = `morph:${string}` | `bone:${string}:pitch` | `bone:${string}:yaw` | `bone:${string}:roll`;
export type AnimationChannels = Partial<Record<AnimationChannel, number>>;

export interface AnimationLayer {
  priority: number;
  weight?: number;
  channels: AnimationChannels;
}

export const animationPriorities = { idle: 20, emotion: 70, speech: 90, blink: 100, debug: 110 } as const;

/** Sparse layers: a source can only override channels it explicitly contributes. */
export class AnimationMixer {
  private layers = new Map<string, Required<AnimationLayer>>();

  setLayer(source: string, layer: AnimationLayer): void {
    if (!source || !Number.isFinite(layer.priority)) return;
    const weight = layer.weight ?? 1;
    if (!Number.isFinite(weight)) return;
    const channels: AnimationChannels = {};
    for (const [channel, value] of Object.entries(layer.channels)) {
      if (typeof value === "number" && Number.isFinite(value) && /^(morph:.+|bone:.+:(pitch|yaw|roll))$/.test(channel)) {
        const isMorph = channel.startsWith("morph:");
        const parts = channel.split(":");
        const limit = boneLimit(parts[1], parts[2]);
        channels[channel as AnimationChannel] = isMorph
          ? Math.max(0, Math.min(1, value))
          : Math.max(-limit, Math.min(limit, value));
      }
    }
    this.layers.set(source, { priority: layer.priority, weight: Math.max(0, Math.min(1, weight)), channels });
  }

  removeLayer(source: string): void { this.layers.delete(source); }
  clear(): void { this.layers.clear(); }
  get size(): number { return this.layers.size; }

  /** Equal priorities mix by weight; higher priorities blend over the lower result. */
  resolve(channel: AnimationChannel, rest = 0): number {
    const groups = new Map<number, { total: number; weight: number }>();
    for (const layer of this.layers.values()) {
      const value = layer.channels[channel];
      if (value === undefined || layer.weight === 0) continue;
      const group = groups.get(layer.priority) ?? { total: 0, weight: 0 };
      group.total += value * layer.weight;
      group.weight += layer.weight;
      groups.set(layer.priority, group);
    }
    let result = rest;
    for (const [, group] of [...groups].sort(([a], [b]) => a - b)) {
      result += (group.total / group.weight - result) * Math.min(1, group.weight);
    }
    return result;
  }
}
