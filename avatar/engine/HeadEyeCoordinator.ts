import type { EyeTarget } from "./EyeController";
import type { HeadTarget } from "./HeadMotionEngine";

export interface HeadEyeCoordinationConfig {
  enabled: boolean;
  deadZone: number;
  yawContribution: number;
  pitchContribution: number;
  smoothing: number;
  maxDeltaTime: number;
}

export interface HeadEyeCoordinationInput {
  deltaTime: number;
  target?: EyeTarget | null;
  reducedMotion?: boolean;
}

export interface HeadEyeCoordinationOutput {
  headTarget: HeadTarget;
  eyeTarget: EyeTarget;
  enabled: boolean;
  contribution: number;
}

export interface HeadEyeCoordinationDiagnostics extends HeadEyeCoordinationOutput {
  rawTarget: EyeTarget;
  reducedMotion: boolean;
}

const zeroEye = (): EyeTarget => ({ x: 0, y: 0 });
const zeroHead = (): HeadTarget => ({ yaw: 0, pitch: 0, roll: 0 });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
const clamp01 = (value: number) => clamp(value, 0, 1);

export const defaultHeadEyeCoordinationConfig: HeadEyeCoordinationConfig = {
  enabled: true,
  deadZone: 0.18,
  yawContribution: 0.42,
  pitchContribution: 0.32,
  smoothing: 4,
  maxDeltaTime: 0.1,
};

/** Turns the semantic gaze target into subtle supporting head motion. It never calculates raw bone rotations. */
export class HeadEyeCoordinator {
  private config: HeadEyeCoordinationConfig;
  private rawTarget = zeroEye();
  private eyeTarget = zeroEye();
  private headTarget = zeroHead();
  private contribution = 0;
  private reducedMotion = false;

  constructor(config: Partial<HeadEyeCoordinationConfig> = {}) {
    this.config = {
      ...defaultHeadEyeCoordinationConfig,
      ...config,
      deadZone: clamp01(config.deadZone ?? defaultHeadEyeCoordinationConfig.deadZone),
      yawContribution: clamp01(config.yawContribution ?? defaultHeadEyeCoordinationConfig.yawContribution),
      pitchContribution: clamp01(config.pitchContribution ?? defaultHeadEyeCoordinationConfig.pitchContribution),
      smoothing: Math.max(0, Number.isFinite(config.smoothing) ? config.smoothing as number : defaultHeadEyeCoordinationConfig.smoothing),
      maxDeltaTime: Math.max(0, Number.isFinite(config.maxDeltaTime) ? config.maxDeltaTime as number : defaultHeadEyeCoordinationConfig.maxDeltaTime),
    };
  }

  update(input: HeadEyeCoordinationInput): HeadEyeCoordinationOutput {
    this.reducedMotion = input.reducedMotion === true;
    this.rawTarget = { x: input.target?.x ?? 0, y: input.target?.y ?? 0 };
    this.eyeTarget = { x: clamp(this.rawTarget.x, -1, 1), y: clamp(this.rawTarget.y, -1, 1) };
    if (this.reducedMotion || !this.config.enabled) {
      this.headTarget = zeroHead();
      this.contribution = 0;
      return this.output();
    }

    const desired = this.calculateHeadTarget(this.eyeTarget);
    const alpha = this.alpha(input.deltaTime);
    this.headTarget = {
      yaw: this.mix(this.headTarget.yaw, desired.yaw, alpha),
      pitch: this.mix(this.headTarget.pitch, desired.pitch, alpha),
      roll: 0,
    };
    this.contribution = Math.max(Math.abs(this.headTarget.yaw), Math.abs(this.headTarget.pitch));
    return this.output();
  }

  reset(): void {
    this.rawTarget = zeroEye();
    this.eyeTarget = zeroEye();
    this.headTarget = zeroHead();
    this.contribution = 0;
    this.reducedMotion = false;
  }

  getDiagnostics(): HeadEyeCoordinationDiagnostics {
    return {
      ...this.output(),
      rawTarget: { ...this.rawTarget },
      reducedMotion: this.reducedMotion,
    };
  }

  private calculateHeadTarget(target: EyeTarget): HeadTarget {
    return {
      yaw: this.axisContribution(target.x, this.config.yawContribution),
      pitch: this.axisContribution(target.y, this.config.pitchContribution),
      roll: 0,
    };
  }

  private axisContribution(value: number, maxContribution: number): number {
    const magnitude = Math.abs(value);
    if (magnitude <= this.config.deadZone) return 0;
    const scaled = (magnitude - this.config.deadZone) / (1 - this.config.deadZone);
    return Math.sign(value) * clamp01(scaled) * maxContribution;
  }

  private alpha(deltaTime: number): number {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return 0;
    if (this.config.smoothing <= 0) return 1;
    return clamp01(1 - Math.exp(-this.config.smoothing * Math.min(deltaTime, this.config.maxDeltaTime)));
  }

  private mix(current: number, target: number, alpha: number): number {
    const next = current + (target - current) * alpha;
    return Math.abs(next) < 1e-10 ? 0 : next;
  }

  private output(): HeadEyeCoordinationOutput {
    return {
      headTarget: { ...this.headTarget },
      eyeTarget: { ...this.eyeTarget },
      enabled: this.config.enabled,
      contribution: this.contribution,
    };
  }
}
