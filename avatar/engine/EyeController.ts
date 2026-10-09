import type { AnimationChannels } from "./AnimationMixer";

export type EyeAxis = "x" | "y" | "z";
export type EyeSign = 1 | -1;

export interface EyeTarget {
  /** -1 looks left, +1 looks right. */
  x: number;
  /** -1 looks down, +1 looks up. */
  y: number;
}

export interface EyeRotation {
  pitch: number;
  yaw: number;
  roll: number;
}

export interface EyeOutput {
  left: EyeRotation;
  right: EyeRotation;
}

export interface EyeDiagnostics {
  rawTarget: EyeTarget;
  clampedTarget: EyeTarget;
  desired: EyeOutput;
  output: EyeOutput;
  limits: Pick<EyeRigConfig, "horizontalLimit" | "verticalLimit">;
  axisMapping: EyeRigConfig["axisMapping"];
  smoothing: number;
}

export interface EyeRigConfig {
  leftEye: string;
  rightEye: string;
  horizontalLimit: { min: number; max: number };
  verticalLimit: { min: number; max: number };
  axisMapping: {
    pitch: EyeAxis;
    yaw: EyeAxis;
    roll: EyeAxis;
    pitchSign: EyeSign;
    yawSign: EyeSign;
    rollSign: EyeSign;
  };
  restRotation: {
    left: EyeRotation;
    right: EyeRotation;
  };
  smoothing: number;
}

const zeroRotation = (): EyeRotation => ({ pitch: 0, yaw: 0, roll: 0 });
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, finite(value)));
const signedLimit = (value: number, limit: { min: number; max: number }) => value < 0 ? -value * limit.min : value * limit.max;
const cloneRotation = (rotation: EyeRotation): EyeRotation => ({ pitch: rotation.pitch, yaw: rotation.yaw, roll: rotation.roll });
const cloneOutput = (output: EyeOutput): EyeOutput => ({ left: cloneRotation(output.left), right: cloneRotation(output.right) });

export const defaultEyeRigConfig: EyeRigConfig = {
  leftEye: "LeftEye",
  rightEye: "RightEye",
  // Baseline values from the existing implementation; keep calibrated values here after rig validation.
  horizontalLimit: { min: -0.17, max: 0.17 },
  verticalLimit: { min: -0.06, max: 0.06 },
  axisMapping: { pitch: "x", yaw: "z", roll: "y", pitchSign: -1, yawSign: 1, rollSign: 1 },
  restRotation: { left: zeroRotation(), right: zeroRotation() },
  smoothing: 0,
};

export const eyeCalibrationTargets: EyeTarget[] = [
  { x: 0, y: 0 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
];

/** Converts a semantic gaze target into bounded eye rotation offsets. It does not touch Three.js objects. */
export class EyeController {
  private rawTarget: EyeTarget = { x: 0, y: 0 };
  private target: EyeTarget = { x: 0, y: 0 };
  private desired: EyeOutput = { left: zeroRotation(), right: zeroRotation() };
  private output: EyeOutput = { left: zeroRotation(), right: zeroRotation() };

  constructor(readonly config: EyeRigConfig = defaultEyeRigConfig) {}

  setTarget(target: Partial<EyeTarget> | null | undefined): void {
    const x = finite(target?.x ?? 0);
    const y = finite(target?.y ?? 0);
    this.rawTarget = { x, y };
    this.target = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }

  releaseTarget(): void { this.setTarget({ x: 0, y: 0 }); }

  update(delta: number): EyeOutput {
    this.desired = this.calculate(this.target);
    const alpha = this.alpha(delta);
    this.output = {
      left: this.mixRotation(this.output.left, this.desired.left, alpha),
      right: this.mixRotation(this.output.right, this.desired.right, alpha),
    };
    return this.getOutput();
  }

  reset(immediate = true): void {
    this.rawTarget = { x: 0, y: 0 };
    this.target = { x: 0, y: 0 };
    this.desired = { left: zeroRotation(), right: zeroRotation() };
    if (immediate) this.output = { left: zeroRotation(), right: zeroRotation() };
  }

  getOutput(): EyeOutput { return cloneOutput(this.output); }

  getDiagnostics(): EyeDiagnostics {
    return {
      rawTarget: { ...this.rawTarget },
      clampedTarget: { ...this.target },
      desired: cloneOutput(this.desired),
      output: cloneOutput(this.output),
      limits: {
        horizontalLimit: { ...this.config.horizontalLimit },
        verticalLimit: { ...this.config.verticalLimit },
      },
      axisMapping: { ...this.config.axisMapping },
      smoothing: this.config.smoothing,
    };
  }

  toChannels(output: EyeOutput = this.output): AnimationChannels {
    return {
      [`bone:${this.config.leftEye}:pitch`]: output.left.pitch,
      [`bone:${this.config.leftEye}:yaw`]: output.left.yaw,
      [`bone:${this.config.leftEye}:roll`]: output.left.roll,
      [`bone:${this.config.rightEye}:pitch`]: output.right.pitch,
      [`bone:${this.config.rightEye}:yaw`]: output.right.yaw,
      [`bone:${this.config.rightEye}:roll`]: output.right.roll,
    };
  }

  private calculate(target: EyeTarget): EyeOutput {
    const yaw = this.config.axisMapping.yawSign * signedLimit(target.x, this.config.horizontalLimit);
    const pitch = this.config.axisMapping.pitchSign * signedLimit(target.y, this.config.verticalLimit);
    const roll = 0;
    return {
      left: this.limitRotation({ pitch, yaw, roll }),
      right: this.limitRotation({ pitch, yaw, roll }),
    };
  }

  private limitRotation(rotation: EyeRotation): EyeRotation {
    return {
      pitch: clamp(rotation.pitch, Math.min(-Math.abs(this.config.verticalLimit.min), -Math.abs(this.config.verticalLimit.max)), Math.max(Math.abs(this.config.verticalLimit.min), Math.abs(this.config.verticalLimit.max))),
      yaw: clamp(rotation.yaw, this.config.horizontalLimit.min, this.config.horizontalLimit.max),
      roll: finite(rotation.roll),
    };
  }

  private alpha(delta: number): number {
    if (!Number.isFinite(delta) || delta <= 0) return 0;
    if (!Number.isFinite(this.config.smoothing) || this.config.smoothing <= 0) return 1;
    return 1 - Math.exp(-this.config.smoothing * Math.min(delta, 0.1));
  }

  private mixRotation(current: EyeRotation, target: EyeRotation, alpha: number): EyeRotation {
    return {
      pitch: this.mix(current.pitch, target.pitch, alpha),
      yaw: this.mix(current.yaw, target.yaw, alpha),
      roll: this.mix(current.roll, target.roll, alpha),
    };
  }

  private mix(current: number, target: number, alpha: number): number {
    const next = finite(current) + (finite(target) - finite(current)) * clamp(alpha, 0, 1);
    return Math.abs(next) < 1e-10 ? 0 : next;
  }
}
