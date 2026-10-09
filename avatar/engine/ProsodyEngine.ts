export interface ProsodyInput {
  deltaTime: number;
  energy?: number | null;
  pitch?: number | null;
  speaking?: boolean | null;
}

export interface ProsodySignal {
  energy: number;
  pitch: number;
  emphasis: number;
  speaking: boolean;
  pause: boolean;
}

export interface ProsodyConfig {
  smoothing: number;
  pauseThreshold: number;
  emphasisSensitivity: number;
  maxDeltaTime: number;
  neutralPitch: number;
}

export const defaultProsodyConfig: ProsodyConfig = {
  smoothing: 18,
  pauseThreshold: 0.08,
  emphasisSensitivity: 1,
  maxDeltaTime: 0.1,
  neutralPitch: 0.5,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

const cleanDelta = (deltaTime: number, maxDeltaTime: number) => {
  if (!Number.isFinite(deltaTime) || deltaTime <= 0) return 0;
  return Math.min(deltaTime, Math.max(0, maxDeltaTime));
};

const smoothAlpha = (smoothing: number, deltaTime: number) => {
  if (!Number.isFinite(smoothing) || smoothing <= 0) return 1;
  if (deltaTime <= 0) return 0;
  return clamp01(1 - Math.exp(-smoothing * deltaTime));
};

const cloneSignal = (signal: ProsodySignal): ProsodySignal => ({ ...signal });

/** Converts normalized speech/audio features into semantic prosody signals only. */
export class ProsodyEngine {
  private config: ProsodyConfig;
  private signal: ProsodySignal;

  constructor(config: Partial<ProsodyConfig> = {}) {
    this.config = this.cleanConfig({ ...defaultProsodyConfig, ...config });
    this.signal = this.neutralSignal();
  }

  update(input: ProsodyInput): ProsodySignal {
    const speaking = input.speaking === true;
    const targetPitch = speaking ? this.cleanPitch(input.pitch) : this.config.neutralPitch;
    const targetEnergy = speaking ? clamp01(input.energy ?? 0) : 0;
    const alpha = smoothAlpha(this.config.smoothing, cleanDelta(input.deltaTime, this.config.maxDeltaTime));

    const energy = this.lerp(this.signal.energy, targetEnergy, alpha);
    const pitch = this.lerp(this.signal.pitch, targetPitch, alpha);
    const emphasis = speaking ? this.calculateEmphasis(energy, pitch) : 0;
    const pause = speaking && energy < this.config.pauseThreshold;

    this.signal = {
      energy: clamp01(energy),
      pitch: clamp01(pitch),
      emphasis,
      speaking,
      pause,
    };

    return this.getSignal();
  }

  reset(): void {
    this.signal = this.neutralSignal();
  }

  getSignal(): ProsodySignal {
    return cloneSignal(this.signal);
  }

  private neutralSignal(): ProsodySignal {
    return {
      energy: 0,
      pitch: this.config.neutralPitch,
      emphasis: 0,
      speaking: false,
      pause: false,
    };
  }

  private cleanConfig(config: ProsodyConfig): ProsodyConfig {
    const neutralPitch = clamp01(config.neutralPitch);
    return {
      smoothing: Number.isFinite(config.smoothing) ? config.smoothing : defaultProsodyConfig.smoothing,
      pauseThreshold: clamp01(config.pauseThreshold),
      emphasisSensitivity: Number.isFinite(config.emphasisSensitivity) ? Math.max(0, config.emphasisSensitivity) : 1,
      maxDeltaTime: Number.isFinite(config.maxDeltaTime) ? Math.max(0, config.maxDeltaTime) : defaultProsodyConfig.maxDeltaTime,
      neutralPitch,
    };
  }

  private cleanPitch(pitch: ProsodyInput["pitch"]): number {
    return Number.isFinite(pitch) ? clamp01(pitch as number) : this.config.neutralPitch;
  }

  private calculateEmphasis(energy: number, pitch: number): number {
    const lowerRange = Math.max(this.config.neutralPitch, 1e-6);
    const upperRange = Math.max(1 - this.config.neutralPitch, 1e-6);
    const pitchDeviation = pitch >= this.config.neutralPitch
      ? (pitch - this.config.neutralPitch) / upperRange
      : (this.config.neutralPitch - pitch) / lowerRange;
    return clamp01((energy * 0.75 + clamp01(pitchDeviation) * 0.25) * this.config.emphasisSensitivity);
  }

  private lerp(current: number, target: number, alpha: number): number {
    return current + (target - current) * alpha;
  }
}
