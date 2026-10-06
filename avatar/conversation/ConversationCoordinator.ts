import type { AvatarEngine } from "../engine/AvatarEngine";
import { emotions, clamp01, type Emotion, type BehaviorState } from "../engine/behaviorConfig";
import type { PlaybackFrame } from "../../services/audio/PcmPlayer";
import type { ConnectionState } from "../../services/gemini/GeminiLiveClient";

/** Coordinates playback events without React or an independent animation loop. */
export class ConversationCoordinator {
  private engine: AvatarEngine | null = null;
  private connection: ConnectionState = "disconnected";
  private waiting = false;
  private userSpeaking = false;
  private frame: PlaybackFrame = { playing: false, amplitude: 0, queuedSeconds: 0 };
  private silent = true;
  emotion: Emotion = "neutral";
  intensity = 0.7;
  /** The expression to return to when the session ends; defaults to neutral, or the saved avatar look. */
  private baseline: { emotion: Emotion; intensity: number } = { emotion: "neutral", intensity: 0.7 };
  get state(): BehaviorState {
    if (this.userSpeaking && this.connection === "connected") return "listening";
    if (this.frame.playing) return "speaking";
    if (this.connection !== "connected") return "idle";
    return this.waiting || this.frame.queuedSeconds > 0 ? "thinking" : "listening";
  }
  attach(engine: AvatarEngine | null): void {
    if (this.engine && this.engine !== engine && this.engine.status !== "disposed") {
      this.engine.setSpeechSilence(false); this.engine.behavior.setState("idle"); this.engine.behavior.setEmotion("neutral");
    }
    this.engine = engine; this.silent = true;
    this.sync(true);
  }
  setConnection(connection: ConnectionState): void {
    this.connection = connection;
    if (connection !== "connected") { this.waiting = false; this.userSpeaking = false; this.interrupt(); }
    if (connection === "disconnected" || connection === "error") this.setEmotion(this.baseline.emotion, this.baseline.intensity);
    this.sync();
  }
  beginTurn(): void { if (this.connection === "connected") this.waiting = true; this.sync(); }
  userActivity(active: boolean): void {
    if (this.connection !== "connected") return;
    this.userSpeaking = active;
    if (active) this.interrupt(); else this.waiting = true;
    this.sync();
  }
  completeTurn(): void { this.waiting = false; this.sync(); }
  updatePlayback(frame: PlaybackFrame): void {
    this.frame = { playing: frame.playing, amplitude: clamp01(frame.amplitude), queuedSeconds: Math.max(0, frame.queuedSeconds) };
    if (frame.playing) this.waiting = false;
    this.sync();
  }
  interrupt(): void {
    this.waiting = false; this.frame = { playing: false, amplitude: 0, queuedSeconds: 0 };
    this.sync(true);
  }
  setEmotion(command: string, intensity = this.intensity): Emotion {
    this.emotion = emotions.includes(command as Emotion) ? command as Emotion : "neutral";
    this.intensity = Number.isFinite(intensity) ? clamp01(intensity) : 0.7;
    this.engine?.behavior.setEmotion(this.emotion, this.intensity);
    return this.emotion;
  }
  setBaseline(command: string, intensity = this.baseline.intensity): Emotion {
    const emotion = this.setEmotion(command, intensity);
    this.baseline = { emotion, intensity: this.intensity };
    return emotion;
  }
  private sync(force = false): void {
    const engine = this.engine;
    if (!engine || engine.status === "disposed") return;
    engine.start(); engine.behavior.enable();
    if (engine.behavior.state !== this.state) engine.behavior.setState(this.state);
    const silent = !this.frame.playing || this.frame.amplitude < 0.025 || this.userSpeaking;
    if (force || silent !== this.silent) engine.setSpeechSilence(silent);
    this.silent = silent;
    engine.behavior.lips.setAmplitude(silent ? 0 : this.frame.amplitude);
    engine.behavior.setEmotion(this.emotion, this.intensity);
  }
  dispose(): void { this.setConnection("disconnected"); this.attach(null); }
}
