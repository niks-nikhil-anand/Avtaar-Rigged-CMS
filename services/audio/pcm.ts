export const INPUT_SAMPLE_RATE = 16_000;
export const OUTPUT_SAMPLE_RATE = 24_000;

/** Stateful area resampling retains fractional samples across microphone blocks. */
export class PcmResampler {
  private sum = 0;
  private covered = 0;
  private readonly ratio: number;
  constructor(sourceRate: number, targetRate = INPUT_SAMPLE_RATE) {
    if (!Number.isFinite(sourceRate) || sourceRate <= 0 || !Number.isFinite(targetRate) || targetRate <= 0) throw new Error("Invalid audio sample rate.");
    this.ratio = sourceRate / targetRate;
  }
  push(input: Float32Array): Float32Array {
    const output: number[] = [];
    for (const sample of input) {
      let remaining = 1;
      while (remaining > 1e-9) {
        const portion = Math.min(remaining, this.ratio - this.covered);
        this.sum += (Number.isFinite(sample) ? sample : 0) * portion;
        this.covered += portion;
        remaining -= portion;
        if (this.covered >= this.ratio - 1e-9) {
          output.push(this.sum / this.ratio); this.sum = 0; this.covered = 0;
        }
      }
    }
    return Float32Array.from(output);
  }
}

export function encodePcm16(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  samples.forEach((sample, index) => {
    const value = Math.max(-1, Math.min(1, Number.isFinite(sample) ? sample : 0));
    view.setInt16(index * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  });
  return bytes;
}

export function decodePcm16(bytes: Uint8Array): Float32Array {
  if (bytes.byteLength % 2) throw new Error("PCM audio must contain complete 16-bit samples.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Float32Array.from({ length: bytes.byteLength / 2 }, (_, i) => view.getInt16(i * 2, true) / 32768);
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return btoa(binary);
}
export function fromBase64(data: string): Uint8Array { return Uint8Array.from(atob(data), (value) => value.charCodeAt(0)); }
export function rms(samples: Float32Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

export function audioSampleRate(mimeType = "audio/pcm;rate=24000"): number {
  if (!/^audio\/(pcm|l16)(;|$)/i.test(mimeType)) throw new Error("Gemini returned an unsupported audio format.");
  const rate = Number(/rate=(\d+)/i.exec(mimeType)?.[1] ?? OUTPUT_SAMPLE_RATE);
  if (rate < 8000 || rate > 96000) throw new Error("Unsupported playback sample rate.");
  return rate;
}
