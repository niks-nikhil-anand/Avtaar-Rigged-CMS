import type { AvatarEngine } from "./AvatarEngine";
import type { ModelBindings } from "../types";
import { EyeEngine } from "./EyeEngine";
import { IdleEngine } from "./IdleEngine";
import { EmotionEngine } from "./EmotionEngine";
import { LipSyncEngine } from "./LipSyncEngine";
import { ProsodyEngine, type ProsodySignal } from "./ProsodyEngine";
import { HeadEyeCoordinator, type HeadEyeCoordinationDiagnostics } from "./HeadEyeCoordinator";
import { HeadMotionEngine, type HeadMotionDiagnostics, type HeadTarget } from "./HeadMotionEngine";
import { GestureEngine, type GestureDiagnostics, type GestureName } from "./GestureEngine";
import { GestureIntentEngine, type GestureIntentResult } from "./GestureIntentEngine";
import { GestureTimingEngine, type GestureTimingDiagnostics, type GestureTimingResult } from "./GestureTimingEngine";
import type { AnimationChannels } from "./AnimationMixer";
import type { BehaviorState, Emotion } from "./behaviorConfig";

export interface BehaviorDiagnostics {
  state: BehaviorState;
  reducedMotion: boolean;
  prosody: ProsodySignal;
  headEye: HeadEyeCoordinationDiagnostics;
  head: HeadMotionDiagnostics;
  gesture: GestureDiagnostics;
  gestureIntent: GestureIntentResult;
  gestureTiming: GestureTimingDiagnostics & { result: GestureTimingResult };
  channels: AnimationChannels;
}

export class BehaviorController {
  private eyes: EyeEngine;
  private idle = new IdleEngine();
  private prosody = new ProsodyEngine();
  private headEye = new HeadEyeCoordinator();
  private head = new HeadMotionEngine();
  private gesture = new GestureEngine();
  private gestureIntent = new GestureIntentEngine();
  private gestureTiming = new GestureTimingEngine();
  private audio: { energy?: number; pitch?: number; speaking?: boolean } | null = null;
  private requestedGesture: GestureName = "none";
  private gestureIntensity = 1;
  private diagnostics: BehaviorDiagnostics | null = null;
  readonly emotion: EmotionEngine;
  readonly lips: LipSyncEngine;
  state: BehaviorState = "idle";
  enabled = false;
  reducedMotion = false;
  constructor(private engine: AvatarEngine, bindings: ModelBindings, private random: () => number = Math.random) {
    const supported = new Set(bindings.morphs.keys());
    this.eyes = new EyeEngine(random);
    this.emotion = new EmotionEngine(supported);
    this.lips = new LipSyncEngine(supported);
  }
  enable(): void {
    if (this.enabled || this.engine.status === "disposed") return;
    this.enabled = true;
    if (this.state === "speaking") this.lips.startSpeaking();
    this.engine.addSystem("behavior:clock", { priority: 0, update: (delta) => {
      const eyes = this.eyes.update(delta, this.state, this.reducedMotion);
      const prosody = this.prosody.update({
        deltaTime: delta,
        energy: this.audio?.energy,
        pitch: this.audio?.pitch,
        speaking: this.audio?.speaking ?? this.state === "speaking",
      });
      const headEye = this.headEye.update({ deltaTime: delta, target: eyes.target, reducedMotion: this.reducedMotion });
      const head = this.head.update({ deltaTime: delta, target: this.combinedHeadTarget(headEye.headTarget), prosody, reducedMotion: this.reducedMotion });
      const gestureSpeaking = prosody.speaking || this.state === "thinking";
      const gestureIntent = this.gestureIntent.update({
        speaking: gestureSpeaking,
        energy: prosody.energy,
        pitch: prosody.pitch,
        emphasis: prosody.emphasis,
        pause: prosody.pause,
        conversationState: this.state,
        reducedMotion: this.reducedMotion,
        deltaTime: delta,
      });
      const explicitGestureActive = this.requestedGesture !== "none";
      const gestureTiming = this.gestureTiming.update({
        intent: gestureIntent,
        speaking: gestureSpeaking,
        paused: prosody.pause,
        interrupted: false,
        reducedMotion: this.reducedMotion || explicitGestureActive,
        deltaTime: delta,
      });
      const automaticGesture = gestureTiming.status === "started" || gestureTiming.status === "holding" ? gestureTiming.gesture : "none";
      const gesture = this.gesture.update({
        deltaTime: delta,
        gesture: explicitGestureActive ? this.requestedGesture : automaticGesture,
        intensity: explicitGestureActive ? this.gestureIntensity : gestureTiming.intensity,
        reducedMotion: this.reducedMotion,
      });
      this.engine.setLayer("behavior:blink", { priority: 100, channels: eyes.blink });
      this.engine.setLayer("behavior:gaze", { priority: 50, channels: eyes.gaze });
      this.engine.setLayer("behavior:idle", { priority: 20, channels: this.idle.update(delta, this.state, this.reducedMotion) });
      this.engine.setLayer("behavior:pose", { priority: 40, channels: this.idle.relaxedPose() });
      this.setOrClearLayer("behavior:head", 45, head.channels);
      this.setOrClearLayer("behavior:gesture", 45, gesture.channels);
      this.engine.setLayer("behavior:emotion", { priority: 70, channels: this.emotion.update(this.state === "thinking") });
      this.engine.setLayer("behavior:speech", { priority: 90, channels: this.lips.update(delta) });
      this.diagnostics = {
        state: this.state,
        reducedMotion: this.reducedMotion,
        prosody,
        headEye: this.headEye.getDiagnostics(),
        head: this.head.getDiagnostics(),
        gesture: this.gesture.getDiagnostics(),
        gestureIntent,
        gestureTiming: { ...this.gestureTiming.getDiagnostics(), result: gestureTiming },
        channels: { ...eyes.blink, ...eyes.gaze, ...head.channels, ...gesture.channels },
      };
      return {};
    }, dispose: () => {
      this.enabled = false;
      this.clearBehaviorLayers();
      this.lips.stopSpeaking();
    } });
  }
  disable(): void {
    this.enabled = false;
    this.engine.removeSystem("behavior:clock");
    this.clearBehaviorLayers();
    this.lips.stopSpeaking();
  }
  setState(state: BehaviorState): void {
    if (!["idle", "listening", "thinking", "speaking"].includes(state)) return;
    this.state = state;
    if (state === "speaking") this.lips.startSpeaking(); else this.lips.stopSpeaking();
  }
  setEmotion(emotion: Emotion, intensity?: number): void { this.emotion.setEmotion(emotion, intensity); }
  setReducedMotion(value: boolean): void { this.reducedMotion = value; }
  setProsodyInput(input: { energy?: number; pitch?: number; speaking?: boolean } | null): void {
    this.audio = input ? { ...input } : null;
    if (!input) this.prosody.reset();
  }
  setGesture(gesture: GestureName | null, intensity = 1): void {
    this.requestedGesture = gesture ?? "none";
    this.gestureIntensity = Math.max(0, Math.min(1, Number.isFinite(intensity) ? intensity : 1));
  }
  setLookAt(x: number, y: number): void { this.eyes.setLookAt(x, y); }
  releaseLookAt(): void { this.eyes.releaseLookAt(); }
  getLookAt(): { x: number; y: number } | null { return this.eyes.getLookAt(); }
  getDiagnostics(): BehaviorDiagnostics | null {
    return this.diagnostics ? {
      state: this.diagnostics.state,
      reducedMotion: this.diagnostics.reducedMotion,
      prosody: { ...this.diagnostics.prosody },
      headEye: {
        rawTarget: { ...this.diagnostics.headEye.rawTarget },
        eyeTarget: { ...this.diagnostics.headEye.eyeTarget },
        headTarget: { ...this.diagnostics.headEye.headTarget },
        enabled: this.diagnostics.headEye.enabled,
        contribution: this.diagnostics.headEye.contribution,
        reducedMotion: this.diagnostics.headEye.reducedMotion,
      },
      head: {
        target: { ...this.diagnostics.head.target },
        prosodyOffset: { ...this.diagnostics.head.prosodyOffset },
        output: { ...this.diagnostics.head.output },
        reducedMotion: this.diagnostics.head.reducedMotion,
        channels: { ...this.diagnostics.head.channels },
      },
      gesture: {
        activeGesture: this.diagnostics.gesture.activeGesture,
        requestedGesture: this.diagnostics.gesture.requestedGesture,
        phase: this.diagnostics.gesture.phase,
        progress: this.diagnostics.gesture.progress,
        intensity: this.diagnostics.gesture.intensity,
        channels: { ...this.diagnostics.gesture.channels },
        reducedMotion: this.diagnostics.gesture.reducedMotion,
      },
      gestureIntent: { ...this.diagnostics.gestureIntent },
      gestureTiming: {
        state: this.diagnostics.gestureTiming.state,
        activeGesture: this.diagnostics.gestureTiming.activeGesture,
        elapsed: this.diagnostics.gestureTiming.elapsed,
        cooldownRemaining: this.diagnostics.gestureTiming.cooldownRemaining,
        lastApprovedGesture: this.diagnostics.gestureTiming.lastApprovedGesture,
        intensity: this.diagnostics.gestureTiming.intensity,
        result: { ...this.diagnostics.gestureTiming.result },
      },
      channels: { ...this.diagnostics.channels },
    } : null;
  }
  reset(): void {
    this.disable(); this.state = "idle"; this.emotion.setEmotion("neutral", 0.7);
    this.eyes = new EyeEngine(this.random); this.idle = new IdleEngine();
    this.prosody = new ProsodyEngine(); this.headEye = new HeadEyeCoordinator(); this.head = new HeadMotionEngine(); this.gesture = new GestureEngine();
    this.gestureIntent = new GestureIntentEngine(); this.gestureTiming = new GestureTimingEngine();
    this.audio = null; this.requestedGesture = "none"; this.gestureIntensity = 1; this.diagnostics = null;
  }

  private headTarget(): HeadTarget {
    if (this.state === "listening") return { yaw: 0, pitch: 0.12, roll: 0 };
    if (this.state === "thinking") return { yaw: 0.2, pitch: 0.12, roll: -0.08 };
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  private combinedHeadTarget(coordination: HeadTarget): HeadTarget {
    const state = this.headTarget();
    return {
      yaw: Math.max(-1, Math.min(1, state.yaw + coordination.yaw)),
      pitch: Math.max(-1, Math.min(1, state.pitch + coordination.pitch)),
      roll: Math.max(-1, Math.min(1, state.roll + coordination.roll)),
    };
  }

  private setOrClearLayer(source: string, priority: number, channels: AnimationChannels): void {
    const active: AnimationChannels = {};
    for (const [channel, value] of Object.entries(channels)) {
      if (typeof value === "number" && Number.isFinite(value) && Math.abs(value) > 1e-8) active[channel as keyof AnimationChannels] = value;
    }
    if (Object.keys(active).length) this.engine.setLayer(source, { priority, channels: active });
    else this.engine.mixer.removeLayer(source);
  }

  private clearBehaviorLayers(): void {
    for (const source of ["blink", "gaze", "idle", "pose", "head", "gesture", "emotion", "speech"]) this.engine.mixer.removeLayer(`behavior:${source}`);
  }
}
