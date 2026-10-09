import type { EyeTarget } from "./EyeController";
import type { BehaviorState } from "./behaviorConfig";

export type SaccadeState = "waiting" | "active" | "settling";

export interface SaccadeInput {
  baseTarget: Partial<EyeTarget> | null | undefined;
  deltaTime: number;
  reducedMotion?: boolean;
  behaviorState?: BehaviorState;
}

export interface SaccadeConfig {
  minInterval: number;
  maxInterval: number;
  minOffset: number;
  maxOffset: number;
  duration: number;
  settleDuration: number;
  random: () => number;
}

export interface SaccadeDiagnostics {
  state: SaccadeState;
  baseTarget: EyeTarget;
  offset: EyeTarget;
  output: EyeTarget;
  timeUntilNext: number;
}

export const defaultSaccadeConfig: SaccadeConfig = {
  minInterval: 1.6,
  maxInterval: 4.8,
  minOffset: 0.012,
  maxOffset: 0.045,
  duration: 0.055,
  settleDuration: 0.14,
  random: Math.random,
};

const finite = (value: number | null | undefined, fallback = 0) => Number.isFinite(value) ? value as number : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, finite(value)));
const smooth = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
const sameTarget = (a: EyeTarget, b: EyeTarget) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;

/** Adds tiny temporary semantic gaze offsets. It never mutates model objects or emits physical rotations. */
export class SaccadeEngine {
  private state: SaccadeState = "waiting";
  private waitRemaining: number;
  private elapsed = 0;
  private base: EyeTarget = { x: 0, y: 0 };
  private offset: EyeTarget = { x: 0, y: 0 };
  private activeOffset: EyeTarget = { x: 0, y: 0 };
  private settleFrom: EyeTarget = { x: 0, y: 0 };
  private output: EyeTarget = { x: 0, y: 0 };

  constructor(private config: SaccadeConfig = defaultSaccadeConfig) {
    this.waitRemaining = this.nextInterval();
  }

  update(input: SaccadeInput): EyeTarget {
    const base = this.cleanTarget(input.baseTarget);
    this.base = base;
    if (input.reducedMotion) {
      this.reset();
      this.base = base;
      this.output = { ...base };
      return this.getOutput();
    }

    const delta = this.safeDelta(input.deltaTime);
    if (delta > 0) this.advance(delta);
    this.output = this.combine(base, this.offset);
    return this.getOutput();
  }

  reset(): void {
    this.state = "waiting";
    this.elapsed = 0;
    this.offset = { x: 0, y: 0 };
    this.activeOffset = { x: 0, y: 0 };
    this.settleFrom = { x: 0, y: 0 };
    this.waitRemaining = this.nextInterval();
    this.output = { ...this.base };
  }

  getOutput(): EyeTarget { return { ...this.output }; }

  getDiagnostics(): SaccadeDiagnostics {
    return {
      state: this.state,
      baseTarget: { ...this.base },
      offset: { ...this.offset },
      output: { ...this.output },
      timeUntilNext: this.waitRemaining,
    };
  }

  private advance(delta: number): void {
    if (this.state === "waiting") {
      this.waitRemaining -= delta;
      this.offset = { x: 0, y: 0 };
      if (this.waitRemaining <= 0) this.start();
      else return;
    }

    if (this.state === "active") {
      this.elapsed += delta;
      const amount = smooth(this.elapsed / Math.max(1e-6, this.config.duration));
      this.offset = { x: this.activeOffset.x * amount, y: this.activeOffset.y * amount };
      if (this.elapsed >= this.config.duration) {
        this.state = "settling";
        this.elapsed = 0;
        this.settleFrom = { ...this.activeOffset };
        this.offset = { ...this.activeOffset };
      }
      return;
    }

    this.elapsed += delta;
    const amount = 1 - smooth(this.elapsed / Math.max(1e-6, this.config.settleDuration));
    this.offset = { x: this.settleFrom.x * amount, y: this.settleFrom.y * amount };
    if (this.elapsed >= this.config.settleDuration) {
      this.state = "waiting";
      this.elapsed = 0;
      this.offset = { x: 0, y: 0 };
      this.waitRemaining = this.nextInterval();
    }
  }

  private start(): void {
    this.state = "active";
    this.elapsed = 0;
    this.activeOffset = this.pickOffset();
    this.offset = { x: 0, y: 0 };
  }

  private pickOffset(): EyeTarget {
    const angle = this.random() * Math.PI * 2;
    const magnitude = this.range(this.config.minOffset, this.config.maxOffset);
    return {
      x: Math.cos(angle) * magnitude,
      y: Math.sin(angle) * magnitude * 0.65,
    };
  }

  private nextInterval(): number {
    return this.range(this.config.minInterval, this.config.maxInterval);
  }

  private range(min: number, max: number): number {
    const low = Math.min(finite(min), finite(max));
    const high = Math.max(finite(min), finite(max));
    return low + (high - low) * this.random();
  }

  private random(): number {
    return clamp(this.config.random(), 0, 1);
  }

  private cleanTarget(target: Partial<EyeTarget> | null | undefined): EyeTarget {
    return { x: clamp(target?.x ?? 0, -1, 1), y: clamp(target?.y ?? 0, -1, 1) };
  }

  private combine(base: EyeTarget, offset: EyeTarget): EyeTarget {
    const next = { x: clamp(base.x + offset.x, -1, 1), y: clamp(base.y + offset.y, -1, 1) };
    return sameTarget(next, base) ? { ...base } : next;
  }

  private safeDelta(delta: number): number {
    if (!Number.isFinite(delta) || delta <= 0) return 0;
    return Math.min(delta, 0.1);
  }
}
