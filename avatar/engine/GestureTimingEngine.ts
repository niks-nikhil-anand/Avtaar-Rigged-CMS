import type { GestureIntent, GestureIntentResult } from "./GestureIntentEngine";

export type GestureTimingState = "idle" | "started" | "holding" | "cooldown" | "cancelled";
export type GestureTimingReason =
  | "started"
  | "holding"
  | "cooldown"
  | "cooldown_complete"
  | "interrupted"
  | "reduced_motion"
  | "not_speaking"
  | "paused"
  | "no_intent"
  | "idle";

export interface GestureTimingInput {
  intent?: GestureIntentResult | null;
  speaking?: boolean | null;
  paused?: boolean | null;
  interrupted?: boolean | null;
  reducedMotion?: boolean | null;
  deltaTime: number;
}

export interface GestureTimingResult {
  gesture: GestureIntent;
  intensity: number;
  status: GestureTimingState;
  reason: GestureTimingReason;
}

export interface GestureTimingDiagnostics {
  state: GestureTimingState;
  activeGesture: GestureIntent;
  elapsed: number;
  cooldownRemaining: number;
  lastApprovedGesture: GestureIntent;
  intensity: number;
}

export interface GestureTimingConfig {
  minDuration: number;
  maxDuration: number;
  cooldown: number;
  maxDeltaTime: number;
}

export const defaultGestureTimingConfig: GestureTimingConfig = {
  minDuration: 0.35,
  maxDuration: 0.75,
  cooldown: 0.9,
  maxDeltaTime: 0.1,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const cleanDuration = (value: number, fallback: number) => Number.isFinite(value) ? Math.max(0, value) : fallback;

/** Decides when a semantic gesture intent may become an approved gesture. It does not animate or select gestures. */
export class GestureTimingEngine {
  private config: GestureTimingConfig;
  private state: GestureTimingState = "idle";
  private activeGesture: GestureIntent = "none";
  private lastApprovedGesture: GestureIntent = "none";
  private elapsed = 0;
  private cooldownRemaining = 0;
  private intensity = 0;

  constructor(config: Partial<GestureTimingConfig> = {}) {
    this.config = this.cleanConfig({ ...defaultGestureTimingConfig, ...config });
  }

  update(input: GestureTimingInput): GestureTimingResult {
    const delta = this.safeDelta(input.deltaTime);
    const intent = this.cleanIntent(input.intent);

    if (input.reducedMotion === true) return this.clear("reduced_motion");
    if (input.interrupted === true) return this.cancel();
    if (input.speaking !== true) return this.stopFor("not_speaking");
    if (input.paused === true) return this.stopFor("paused");

    if (this.state === "started") {
      this.state = "holding";
      this.elapsed = 0;
    }

    if (this.state === "holding") {
      this.elapsed += delta;
      if (intent.gesture === "none" && this.elapsed >= this.config.minDuration) return this.enterCooldown();
      if (this.elapsed >= this.config.maxDuration) return this.enterCooldown();
      return this.result(this.activeGesture, this.intensity, "holding", "holding");
    }

    if (this.state === "cooldown") {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - delta);
      if (this.cooldownRemaining > 0) return this.result("none", 0, "cooldown", "cooldown");
      this.state = "idle";
      this.cooldownRemaining = 0;
      return this.result("none", 0, "idle", "cooldown_complete");
    }

    if (this.state === "cancelled") {
      this.state = "idle";
      return this.result("none", 0, "idle", "idle");
    }

    if (intent.gesture === "none") return this.result("none", 0, "idle", "no_intent");
    this.state = "started";
    this.activeGesture = intent.gesture;
    this.lastApprovedGesture = intent.gesture;
    this.intensity = clamp01(intent.intensity);
    this.elapsed = 0;
    return this.result(this.activeGesture, this.intensity, "started", "started");
  }

  reset(): void {
    this.state = "idle";
    this.activeGesture = "none";
    this.lastApprovedGesture = "none";
    this.elapsed = 0;
    this.cooldownRemaining = 0;
    this.intensity = 0;
  }

  getDiagnostics(): GestureTimingDiagnostics {
    return {
      state: this.state,
      activeGesture: this.activeGesture,
      elapsed: this.elapsed,
      cooldownRemaining: this.cooldownRemaining,
      lastApprovedGesture: this.lastApprovedGesture,
      intensity: this.intensity,
    };
  }

  private stopFor(reason: GestureTimingReason): GestureTimingResult {
    if (this.state === "holding" || this.state === "started") return this.cancel(reason);
    if (this.state === "cooldown") {
      this.state = "idle";
      this.cooldownRemaining = 0;
    }
    return this.result("none", 0, "idle", reason);
  }

  private cancel(reason: GestureTimingReason = "interrupted"): GestureTimingResult {
    this.state = "cancelled";
    this.activeGesture = "none";
    this.elapsed = 0;
    this.cooldownRemaining = 0;
    this.intensity = 0;
    return this.result("none", 0, "cancelled", reason);
  }

  private clear(reason: GestureTimingReason): GestureTimingResult {
    this.reset();
    return this.result("none", 0, "idle", reason);
  }

  private enterCooldown(): GestureTimingResult {
    this.state = "cooldown";
    this.activeGesture = "none";
    this.elapsed = 0;
    this.intensity = 0;
    this.cooldownRemaining = this.config.cooldown;
    return this.result("none", 0, "cooldown", "cooldown");
  }

  private result(gesture: GestureIntent, intensity: number, status: GestureTimingState, reason: GestureTimingReason): GestureTimingResult {
    return { gesture, intensity: clamp01(intensity), status, reason };
  }

  private cleanIntent(intent: GestureTimingInput["intent"]): GestureIntentResult {
    return intent ? { gesture: this.cleanGesture(intent.gesture), intensity: clamp01(intent.intensity), reason: intent.reason } : { gesture: "none", intensity: 0, reason: "no_gesture" };
  }

  private cleanGesture(gesture: GestureIntent): GestureIntent {
    return ["none", "open-hand", "emphasis", "small-point", "thinking-touch"].includes(gesture) ? gesture : "none";
  }

  private safeDelta(deltaTime: number): number {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return 0;
    return Math.min(deltaTime, this.config.maxDeltaTime);
  }

  private cleanConfig(config: GestureTimingConfig): GestureTimingConfig {
    const minDuration = cleanDuration(config.minDuration, defaultGestureTimingConfig.minDuration);
    const maxDuration = Math.max(minDuration, cleanDuration(config.maxDuration, defaultGestureTimingConfig.maxDuration));
    return {
      minDuration,
      maxDuration,
      cooldown: cleanDuration(config.cooldown, defaultGestureTimingConfig.cooldown),
      maxDeltaTime: cleanDuration(config.maxDeltaTime, defaultGestureTimingConfig.maxDeltaTime),
    };
  }
}
