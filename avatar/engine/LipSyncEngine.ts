import type { AnimationChannels } from "./AnimationMixer";
import { clamp01, visemes, type Viseme } from "./behaviorConfig";

export class LipSyncEngine {
  private speaking = false;
  private amplitude = 0;
  private smoothed = 0;
  private shapes = new Map<Viseme, number>();
  constructor(private supported: ReadonlySet<string>) {}
  startSpeaking(): void { this.speaking = true; }
  stopSpeaking(): void { this.speaking = false; this.amplitude = 0; this.smoothed = 0; this.shapes.clear(); }
  resetAmplitude(): void { this.amplitude = 0; this.smoothed = 0; }
  setAmplitude(value: number): void { if (Number.isFinite(value)) this.amplitude = clamp01(value); }
  setViseme(name: Viseme, weight: number): void {
    if (visemes.includes(name) && this.supported.has(name) && Number.isFinite(weight)) this.shapes.set(name, clamp01(weight));
  }
  clearVisemes(): void { this.shapes.clear(); }
  update(delta: number): AnimationChannels {
    if (!this.speaking) return {};
    if (!Number.isFinite(delta) || delta <= 0) return {};
    const target = this.amplitude < 0.025 ? 0 : this.amplitude;
    this.smoothed += (target - this.smoothed) * (1 - Math.exp(-(target > this.smoothed ? 30 : 45) * delta));
    if (target === 0 && this.smoothed < 0.001) this.smoothed = 0;
    const total = [...this.shapes.values()].reduce((sum, value) => sum + value, 0);
    const channels: AnimationChannels = {};
    for (const name of visemes) if (this.supported.has(name)) channels[`morph:${name}`] = (this.shapes.get(name) ?? 0) / Math.max(1, total);
    if (this.supported.has("jawOpen")) channels["morph:jawOpen"] = this.smoothed * 0.75 * (1 - Math.min(1, total));
    return channels;
  }
}
