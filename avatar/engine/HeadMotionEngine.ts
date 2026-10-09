import type { AnimationChannels } from "./AnimationMixer";
import type { ProsodySignal } from "./ProsodyEngine";

export type HeadAxis = "pitch" | "yaw" | "roll";
export type HeadSign = 1 | -1;

export interface HeadTarget {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface HeadProsodyInput {
  energy: number;
  pitch?: number;
  emphasis: number;
  speaking: boolean;
  pause?: boolean;
}

export interface HeadMotionInput {
  deltaTime: number;
  target?: Partial<HeadTarget> | null;
  prosody?: Partial<HeadProsodyInput> | Partial<ProsodySignal> | null;
  reducedMotion?: boolean;
}

export interface HeadMotionRigConfig {
  headBone: string;
  neckBone?: string;
  axisMapping: {
    yaw: HeadAxis;
    pitch: HeadAxis;
    roll: HeadAxis;
    yawSign: HeadSign;
    pitchSign: HeadSign;
    rollSign: HeadSign;
  };
  limits: HeadTarget;
  neckInfluence: number;
}

export interface HeadMotionConfig {
  rig: HeadMotionRigConfig;
  smoothing: number;
  maxDeltaTime: number;
  prosodyInfluence: HeadTarget;
}

export interface HeadMotionOutput {
  channels: AnimationChannels;
  target: HeadTarget;
}

export interface HeadMotionDiagnostics {
  target: HeadTarget;
  prosodyOffset: HeadTarget;
  output: HeadTarget;
  reducedMotion: boolean;
  channels: AnimationChannels;
}

const zeroTarget = (): HeadTarget => ({ yaw: 0, pitch: 0, roll: 0 });
const cloneTarget = (target: HeadTarget): HeadTarget => ({ yaw: target.yaw, pitch: target.pitch, roll: target.roll });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
const clamp01 = (value: number) => clamp(value, 0, 1);

export const defaultHeadMotionConfig: HeadMotionConfig = {
  rig: {
    headBone: "Head",
    neckBone: "Neck",
    // Baseline semantic mapping only. Do not treat as GLB-calibrated until visual rig validation confirms axes/signs.
    axisMapping: { yaw: "yaw", pitch: "pitch", roll: "roll", yawSign: 1, pitchSign: -1, rollSign: 1 },
    limits: { yaw: 0.12, pitch: 0.08, roll: 0.06 },
    neckInfluence: 0.35,
  },
  smoothing: 10,
  maxDeltaTime: 0.1,
  prosodyInfluence: { yaw: 0.015, pitch: 0.025, roll: 0.012 },
};

/** Converts semantic head intent into bounded animation channels. It does not mutate model objects. */
export class HeadMotionEngine {
  private config: HeadMotionConfig;
  private target = zeroTarget();
  private prosodyOffset = zeroTarget();
  private output = zeroTarget();
  private channels: AnimationChannels = {};
  private reducedMotion = false;

  constructor(config: Partial<HeadMotionConfig> = {}) {
    this.config = this.cleanConfig(config);
  }

  update(input: HeadMotionInput): HeadMotionOutput {
    this.reducedMotion = input.reducedMotion === true;
    this.target = this.reducedMotion ? zeroTarget() : this.cleanTarget(input.target);
    this.prosodyOffset = this.reducedMotion ? zeroTarget() : this.calculateProsodyOffset(input.prosody);

    const desired = this.combine(this.target, this.prosodyOffset);
    const alpha = this.alpha(input.deltaTime);
    this.output = this.mixTarget(this.output, desired, alpha);
    this.channels = this.toChannels(this.output);

    return { channels: { ...this.channels }, target: cloneTarget(this.output) };
  }

  reset(): void {
    this.target = zeroTarget();
    this.prosodyOffset = zeroTarget();
    this.output = zeroTarget();
    this.channels = {};
    this.reducedMotion = false;
  }

  getDiagnostics(): HeadMotionDiagnostics {
    return {
      target: cloneTarget(this.target),
      prosodyOffset: cloneTarget(this.prosodyOffset),
      output: cloneTarget(this.output),
      reducedMotion: this.reducedMotion,
      channels: { ...this.channels },
    };
  }

  private cleanConfig(config: Partial<HeadMotionConfig>): HeadMotionConfig {
    const rig = { ...defaultHeadMotionConfig.rig, ...config.rig };
    return {
      rig: {
        ...rig,
        axisMapping: { ...defaultHeadMotionConfig.rig.axisMapping, ...config.rig?.axisMapping },
        limits: this.absTarget({ ...defaultHeadMotionConfig.rig.limits, ...config.rig?.limits }),
        neckInfluence: clamp(rig.neckInfluence, 0, 1),
      },
      smoothing: Number.isFinite(config.smoothing) ? config.smoothing as number : defaultHeadMotionConfig.smoothing,
      maxDeltaTime: Number.isFinite(config.maxDeltaTime) ? Math.max(0, config.maxDeltaTime as number) : defaultHeadMotionConfig.maxDeltaTime,
      prosodyInfluence: this.absTarget({ ...defaultHeadMotionConfig.prosodyInfluence, ...config.prosodyInfluence }),
    };
  }

  private cleanTarget(target: HeadMotionInput["target"]): HeadTarget {
    return {
      yaw: clamp(target?.yaw ?? 0, -1, 1),
      pitch: clamp(target?.pitch ?? 0, -1, 1),
      roll: clamp(target?.roll ?? 0, -1, 1),
    };
  }

  private calculateProsodyOffset(prosody: HeadMotionInput["prosody"]): HeadTarget {
    const speaking = prosody?.speaking === true;
    const pause = prosody?.pause === true;
    if (!speaking || pause) return zeroTarget();
    const energy = clamp01(prosody.energy ?? 0);
    const pitch = clamp01(prosody.pitch ?? 0.5);
    const emphasis = clamp01(prosody.emphasis ?? 0);
    const pitchDeviation = clamp((pitch - 0.5) * 2, -1, 1);
    const amount = clamp01(energy * 0.45 + emphasis * 0.35 + Math.abs(pitchDeviation) * 0.2);
    return {
      yaw: this.config.prosodyInfluence.yaw * (emphasis * 0.65 + pitchDeviation * 0.2),
      pitch: -this.config.prosodyInfluence.pitch * amount,
      roll: this.config.prosodyInfluence.roll * (emphasis * 0.7 + pitchDeviation * 0.15),
    };
  }

  private combine(target: HeadTarget, prosody: HeadTarget): HeadTarget {
    return {
      yaw: clamp(target.yaw * this.config.rig.limits.yaw + prosody.yaw, -this.config.rig.limits.yaw, this.config.rig.limits.yaw),
      pitch: clamp(target.pitch * this.config.rig.limits.pitch + prosody.pitch, -this.config.rig.limits.pitch, this.config.rig.limits.pitch),
      roll: clamp(target.roll * this.config.rig.limits.roll + prosody.roll, -this.config.rig.limits.roll, this.config.rig.limits.roll),
    };
  }

  private toChannels(output: HeadTarget): AnimationChannels {
    const channels: AnimationChannels = {};
    this.assignBoneChannels(channels, this.config.rig.headBone, output, 1);
    if (this.config.rig.neckBone && this.config.rig.neckInfluence > 0) this.assignBoneChannels(channels, this.config.rig.neckBone, output, this.config.rig.neckInfluence);
    return channels;
  }

  private assignBoneChannels(channels: AnimationChannels, bone: string, output: HeadTarget, influence: number): void {
    const { axisMapping } = this.config.rig;
    channels[`bone:${bone}:${axisMapping.yaw}`] = this.cleanZero(output.yaw * axisMapping.yawSign * influence);
    channels[`bone:${bone}:${axisMapping.pitch}`] = this.cleanZero(output.pitch * axisMapping.pitchSign * influence);
    channels[`bone:${bone}:${axisMapping.roll}`] = this.cleanZero(output.roll * axisMapping.rollSign * influence);
  }

  private alpha(deltaTime: number): number {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return 0;
    if (!Number.isFinite(this.config.smoothing) || this.config.smoothing <= 0) return 1;
    return clamp01(1 - Math.exp(-this.config.smoothing * Math.min(deltaTime, this.config.maxDeltaTime)));
  }

  private mixTarget(current: HeadTarget, desired: HeadTarget, alpha: number): HeadTarget {
    return {
      yaw: this.cleanZero(current.yaw + (desired.yaw - current.yaw) * alpha),
      pitch: this.cleanZero(current.pitch + (desired.pitch - current.pitch) * alpha),
      roll: this.cleanZero(current.roll + (desired.roll - current.roll) * alpha),
    };
  }

  private absTarget(target: HeadTarget): HeadTarget {
    return {
      yaw: Math.abs(clamp(target.yaw, -Math.PI, Math.PI)),
      pitch: Math.abs(clamp(target.pitch, -Math.PI, Math.PI)),
      roll: Math.abs(clamp(target.roll, -Math.PI, Math.PI)),
    };
  }

  private cleanZero(value: number): number {
    return Math.abs(value) < 1e-10 ? 0 : value;
  }
}
