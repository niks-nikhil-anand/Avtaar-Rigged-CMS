import type { AnimationChannels } from "./AnimationMixer";

export type GestureName = "none" | "open-hand" | "emphasis" | "small-point" | "thinking-touch";
export type GesturePhase = "idle" | "entering" | "holding" | "exiting";

export interface GestureInput {
  deltaTime: number;
  gesture?: GestureName | string | null;
  intensity?: number | null;
  reducedMotion?: boolean;
}

export interface GesturePose {
  channels: AnimationChannels;
}

export interface GestureConfig {
  enterDuration: number;
  holdDuration: number;
  exitDuration: number;
  maxDeltaTime: number;
  gestures: Record<GestureName, GesturePose>;
}

export interface GestureOutput {
  channels: AnimationChannels;
  activeGesture: GestureName;
  progress: number;
}

export interface GestureDiagnostics {
  activeGesture: GestureName;
  requestedGesture: GestureName;
  phase: GesturePhase;
  progress: number;
  intensity: number;
  channels: AnimationChannels;
  reducedMotion: boolean;
}

export const defaultGestureConfig: GestureConfig = {
  enterDuration: 0.22,
  holdDuration: 0.5,
  exitDuration: 0.28,
  maxDeltaTime: 0.1,
  gestures: {
    none: { channels: {} },
    "open-hand": {
      channels: {
        "bone:LeftUpperarm:roll": 0.24,
        "bone:RightUpperarm:roll": -0.24,
        "bone:LeftForearm:pitch": 0.18,
        "bone:RightForearm:pitch": 0.18,
        "bone:LeftHand:roll": -0.12,
        "bone:RightHand:roll": 0.12,
      },
    },
    emphasis: {
      channels: {
        "bone:RightUpperarm:pitch": 0.35,
        "bone:RightUpperarm:roll": 0.2,
        "bone:RightForearm:pitch": 0.45,
        "bone:RightHand:roll": 0.16,
      },
    },
    "small-point": {
      channels: {
        "bone:RightUpperarm:pitch": 0.38,
        "bone:RightUpperarm:yaw": -0.18,
        "bone:RightForearm:pitch": 0.52,
        "bone:RightHand:roll": -0.1,
      },
    },
    "thinking-touch": {
      channels: {
        "bone:RightUpperarm:pitch": 0.32,
        "bone:RightUpperarm:roll": 0.24,
        "bone:RightForearm:pitch": 0.55,
        "bone:RightHand:roll": 0.18,
      },
    },
  },
};

const gestureNames: GestureName[] = ["none", "open-hand", "emphasis", "small-point", "thinking-touch"];
const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smoothstep = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

/** Plays small semantic gesture poses into bounded animation channels. It does not mutate model objects. */
export class GestureEngine {
  private config: GestureConfig;
  private activeGesture: GestureName = "none";
  private requestedGesture: GestureName = "none";
  private phase: GesturePhase = "idle";
  private elapsed = 0;
  private intensity = 1;
  private channels: AnimationChannels = {};
  private reducedMotion = false;

  constructor(config: Partial<GestureConfig> = {}) {
    this.config = {
      ...defaultGestureConfig,
      ...config,
      enterDuration: this.duration(config.enterDuration, defaultGestureConfig.enterDuration),
      holdDuration: this.duration(config.holdDuration, defaultGestureConfig.holdDuration),
      exitDuration: this.duration(config.exitDuration, defaultGestureConfig.exitDuration),
      maxDeltaTime: this.duration(config.maxDeltaTime, defaultGestureConfig.maxDeltaTime),
      gestures: { ...defaultGestureConfig.gestures, ...config.gestures },
    };
  }

  update(input: GestureInput): GestureOutput {
    this.reducedMotion = input.reducedMotion === true;
    this.intensity = clamp01(input.intensity ?? this.intensity);
    const requested = this.cleanGesture(input.gesture);
    this.requestedGesture = requested;

    if (this.reducedMotion) {
      this.reset();
      this.reducedMotion = true;
      return this.output();
    }

    if (requested !== this.activeGesture && requested !== "none") this.start(requested);
    else if (requested === "none" && this.phase !== "idle" && this.phase !== "exiting") this.exit();

    this.advance(this.safeDelta(input.deltaTime));
    this.channels = this.weightedChannels();
    return this.output();
  }

  reset(): void {
    this.activeGesture = "none";
    this.requestedGesture = "none";
    this.phase = "idle";
    this.elapsed = 0;
    this.intensity = 1;
    this.channels = {};
    this.reducedMotion = false;
  }

  getDiagnostics(): GestureDiagnostics {
    return {
      activeGesture: this.activeGesture,
      requestedGesture: this.requestedGesture,
      phase: this.phase,
      progress: this.progress(),
      intensity: this.intensity,
      channels: { ...this.channels },
      reducedMotion: this.reducedMotion,
    };
  }

  private start(gesture: GestureName): void {
    this.activeGesture = gesture;
    this.phase = "entering";
    this.elapsed = 0;
  }

  private exit(): void {
    this.phase = "exiting";
    this.elapsed = 0;
  }

  private advance(delta: number): void {
    if (this.phase === "idle" || delta <= 0) return;
    this.elapsed += delta;
    if (this.phase === "entering" && this.elapsed >= this.config.enterDuration) {
      this.phase = "holding";
      this.elapsed = 0;
    }
    if (this.phase === "holding" && this.elapsed >= this.config.holdDuration) this.exit();
    if (this.phase === "exiting" && this.elapsed >= this.config.exitDuration) {
      this.activeGesture = "none";
      this.phase = "idle";
      this.elapsed = 0;
    }
  }

  private weightedChannels(): AnimationChannels {
    const weight = this.weight() * this.intensity;
    if (weight <= 0 || this.activeGesture === "none") return {};
    const channels: AnimationChannels = {};
    for (const [channel, value] of Object.entries(this.config.gestures[this.activeGesture].channels)) {
      if (typeof value === "number" && Number.isFinite(value)) channels[channel as keyof AnimationChannels] = value * weight;
    }
    return channels;
  }

  private weight(): number {
    if (this.phase === "entering") return smoothstep(this.elapsed / this.config.enterDuration);
    if (this.phase === "holding") return 1;
    if (this.phase === "exiting") return 1 - smoothstep(this.elapsed / this.config.exitDuration);
    return 0;
  }

  private progress(): number {
    if (this.phase === "entering") return clamp01(this.elapsed / this.config.enterDuration);
    if (this.phase === "holding") return 1;
    if (this.phase === "exiting") return clamp01(1 - this.elapsed / this.config.exitDuration);
    return 0;
  }

  private output(): GestureOutput {
    return { channels: { ...this.channels }, activeGesture: this.activeGesture, progress: this.progress() };
  }

  private cleanGesture(gesture: GestureInput["gesture"]): GestureName {
    return gestureNames.includes(gesture as GestureName) ? gesture as GestureName : "none";
  }

  private safeDelta(deltaTime: number): number {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return 0;
    return Math.min(deltaTime, this.config.maxDeltaTime);
  }

  private duration(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) ? Math.max(1e-6, value as number) : fallback;
  }
}
