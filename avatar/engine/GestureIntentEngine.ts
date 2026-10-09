import type { GestureName } from "./GestureEngine";
import type { ProsodySignal } from "./ProsodyEngine";
import type { BehaviorState } from "./behaviorConfig";

export type GestureIntent = GestureName;
export type GestureIntentReason =
  | "reduced_motion"
  | "not_speaking"
  | "speech_pause"
  | "thinking_state"
  | "very_strong_speech_emphasis"
  | "strong_speech_emphasis"
  | "high_energy_explanation"
  | "no_gesture";

export interface GestureIntentInput extends Partial<Pick<ProsodySignal, "speaking" | "energy" | "pitch" | "emphasis">> {
  pause?: boolean | number | null;
  conversationState?: BehaviorState | string | null;
  reducedMotion?: boolean | null;
  deltaTime?: number | null;
}

export interface GestureIntentResult {
  gesture: GestureIntent;
  intensity: number;
  reason: GestureIntentReason;
}

export interface GestureIntentConfig {
  pauseThreshold: number;
  strongEmphasisThreshold: number;
  veryStrongEmphasisThreshold: number;
  highEnergyThreshold: number;
  explanatoryEmphasisThreshold: number;
}

export const defaultGestureIntentConfig: GestureIntentConfig = {
  pauseThreshold: 0.5,
  strongEmphasisThreshold: 0.62,
  veryStrongEmphasisThreshold: 0.88,
  highEnergyThreshold: 0.72,
  explanatoryEmphasisThreshold: 0.3,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** Selects a semantic gesture intent from speech and conversation signals. It does not animate or schedule gestures. */
export class GestureIntentEngine {
  private config: GestureIntentConfig;

  constructor(config: Partial<GestureIntentConfig> = {}) {
    this.config = this.cleanConfig({ ...defaultGestureIntentConfig, ...config });
  }

  update(input: GestureIntentInput = {}): GestureIntentResult {
    const clean = this.cleanInput(input);

    if (clean.reducedMotion) return this.result("none", 0, "reduced_motion");
    if (!clean.speaking) return this.result("none", 0, "not_speaking");
    if (clean.pause >= this.config.pauseThreshold) return this.result("none", 0, "speech_pause");
    if (clean.conversationState === "thinking") return this.result("thinking-touch", 0.45, "thinking_state");
    if (clean.emphasis >= this.config.veryStrongEmphasisThreshold && clean.energy >= 0.55) {
      return this.result("small-point", this.intentIntensity(0.58, clean.emphasis, clean.energy), "very_strong_speech_emphasis");
    }
    if (clean.emphasis >= this.config.strongEmphasisThreshold) {
      return this.result("emphasis", this.intentIntensity(0.48, clean.emphasis, clean.energy), "strong_speech_emphasis");
    }
    if (clean.energy >= this.config.highEnergyThreshold && clean.emphasis >= this.config.explanatoryEmphasisThreshold) {
      return this.result("open-hand", this.intentIntensity(0.42, clean.energy, clean.emphasis), "high_energy_explanation");
    }
    return this.result("none", 0, "no_gesture");
  }

  private cleanInput(input: GestureIntentInput) {
    return {
      speaking: input.speaking === true,
      energy: clamp01(input.energy ?? 0),
      pitch: clamp01(input.pitch ?? 0.5),
      emphasis: clamp01(input.emphasis ?? 0),
      pause: typeof input.pause === "boolean" ? (input.pause ? 1 : 0) : clamp01(input.pause ?? 0),
      conversationState: input.conversationState,
      reducedMotion: input.reducedMotion === true,
      deltaTime: Number.isFinite(input.deltaTime) && (input.deltaTime as number) > 0 ? input.deltaTime as number : 0,
    };
  }

  private result(gesture: GestureIntent, intensity: number, reason: GestureIntentReason): GestureIntentResult {
    return { gesture, intensity: clamp01(intensity), reason };
  }

  private intentIntensity(base: number, primary: number, secondary: number): number {
    return clamp01(base + primary * 0.3 + secondary * 0.12);
  }

  private cleanConfig(config: GestureIntentConfig): GestureIntentConfig {
    return {
      pauseThreshold: clamp01(config.pauseThreshold),
      strongEmphasisThreshold: clamp01(config.strongEmphasisThreshold),
      veryStrongEmphasisThreshold: clamp01(config.veryStrongEmphasisThreshold),
      highEnergyThreshold: clamp01(config.highEnergyThreshold),
      explanatoryEmphasisThreshold: clamp01(config.explanatoryEmphasisThreshold),
    };
  }
}
