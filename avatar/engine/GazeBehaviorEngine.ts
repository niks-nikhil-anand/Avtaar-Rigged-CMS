import type { EyeTarget } from "./EyeController";
import type { BehaviorState } from "./behaviorConfig";

export type GazeBehaviorState = BehaviorState;

export interface GazeBehaviorInput {
  state: GazeBehaviorState | string | null | undefined;
  deltaTime: number;
  reducedMotion?: boolean;
}

export interface GazeBehaviorDiagnostics {
  state: GazeBehaviorState;
  target: EyeTarget;
  reducedMotion: boolean;
}

export const gazeTargets: Record<GazeBehaviorState, EyeTarget> = {
  idle: { x: 0, y: 0 },
  listening: { x: 0, y: 0 },
  thinking: { x: 0.25, y: 0.18 },
  speaking: { x: 0, y: 0 },
};

const validStates: GazeBehaviorState[] = ["idle", "listening", "thinking", "speaking"];
const center = (): EyeTarget => ({ x: 0, y: 0 });
const clone = (target: EyeTarget): EyeTarget => ({ x: target.x, y: target.y });
const clamp = (value: number) => Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));

/** Selects the intentional semantic gaze target for a behavior state. It does not create movement or rotations. */
export class GazeBehaviorEngine {
  private diagnostics: GazeBehaviorDiagnostics = { state: "idle", target: center(), reducedMotion: false };

  update(input: GazeBehaviorInput): EyeTarget {
    const state = this.state(input.state);
    const reducedMotion = input.reducedMotion === true;
    const target = reducedMotion ? center() : clone(gazeTargets[state] ?? gazeTargets.idle);
    const safe = { x: clamp(target.x), y: clamp(target.y) };
    this.diagnostics = { state, target: safe, reducedMotion };
    return clone(safe);
  }

  getDiagnostics(): GazeBehaviorDiagnostics {
    return { state: this.diagnostics.state, target: clone(this.diagnostics.target), reducedMotion: this.diagnostics.reducedMotion };
  }

  private state(value: GazeBehaviorInput["state"]): GazeBehaviorState {
    return validStates.includes(value as GazeBehaviorState) ? value as GazeBehaviorState : "idle";
  }
}
