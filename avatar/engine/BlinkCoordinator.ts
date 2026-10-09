import type { BehaviorState } from "./behaviorConfig";

export type BlinkState = "open" | "closing" | "closed" | "opening";

export interface BlinkInput {
  deltaTime: number;
  behaviorState?: BehaviorState;
  reducedMotion?: boolean;
}

export interface BlinkConfig {
  minInterval: number;
  maxInterval: number;
  closeDuration: number;
  closedDuration: number;
  openDuration: number;
  maxDeltaTime: number;
  random: () => number;
}

export interface BlinkOutput {
  blinkWeight: number;
  state: BlinkState;
}

export interface BlinkDiagnostics extends BlinkOutput {
  timeUntilNext: number;
}

export const defaultBlinkConfig: BlinkConfig = {
  minInterval: 2.8,
  maxInterval: 6,
  closeDuration: 0.09,
  closedDuration: 0.07,
  openDuration: 0.16,
  maxDeltaTime: 0.1,
  random: Math.random,
};

const finite = (value: number | null | undefined, fallback = 0) => Number.isFinite(value) ? value as number : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, finite(value)));
const smooth = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Owns blink timing and blink weight only. It never touches morphs, bones, or render objects. */
export class BlinkCoordinator {
  private state: BlinkState = "open";
  private blinkWeight = 0;
  private elapsed = 0;
  private timeUntilNext: number;

  constructor(private config: BlinkConfig = defaultBlinkConfig) {
    this.timeUntilNext = this.nextInterval();
  }

  update(input: BlinkInput): BlinkOutput {
    if (input.reducedMotion) {
      this.reset();
      return this.output();
    }
    const delta = this.safeDelta(input.deltaTime);
    if (delta > 0) this.advance(delta);
    return this.output();
  }

  reset(): void {
    this.state = "open";
    this.blinkWeight = 0;
    this.elapsed = 0;
    this.timeUntilNext = this.nextInterval();
  }

  getDiagnostics(): BlinkDiagnostics {
    return { ...this.output(), timeUntilNext: this.timeUntilNext };
  }

  private advance(delta: number): void {
    if (this.state === "open") {
      this.blinkWeight = 0;
      this.timeUntilNext -= delta;
      if (this.timeUntilNext <= 0) this.startClosing();
      else return;
    }

    if (this.state === "closing") {
      this.elapsed += delta;
      this.blinkWeight = smooth(this.elapsed / Math.max(1e-6, this.config.closeDuration));
      if (this.elapsed >= this.config.closeDuration) {
        this.state = "closed";
        this.elapsed = 0;
        this.blinkWeight = 1;
      }
      return;
    }

    if (this.state === "closed") {
      this.elapsed += delta;
      this.blinkWeight = 1;
      if (this.elapsed >= this.config.closedDuration) {
        this.state = "opening";
        this.elapsed = 0;
      }
      return;
    }

    this.elapsed += delta;
    this.blinkWeight = 1 - smooth(this.elapsed / Math.max(1e-6, this.config.openDuration));
    if (this.elapsed >= this.config.openDuration) {
      this.state = "open";
      this.elapsed = 0;
      this.blinkWeight = 0;
      this.timeUntilNext = this.nextInterval();
    }
  }

  private startClosing(): void {
    this.state = "closing";
    this.elapsed = 0;
    this.blinkWeight = 0;
  }

  private nextInterval(): number {
    const min = finite(this.config.minInterval, defaultBlinkConfig.minInterval);
    const max = finite(this.config.maxInterval, defaultBlinkConfig.maxInterval);
    const low = Math.max(0, Math.min(min, max));
    const high = Math.max(low, Math.max(min, max));
    return low + (high - low) * clamp(this.config.random(), 0, 1);
  }

  private safeDelta(delta: number): number {
    if (!Number.isFinite(delta) || delta <= 0) return 0;
    return Math.min(delta, Math.max(0.001, finite(this.config.maxDeltaTime, defaultBlinkConfig.maxDeltaTime)));
  }

  private output(): BlinkOutput {
    return { blinkWeight: clamp(this.blinkWeight, 0, 1), state: this.state };
  }
}
