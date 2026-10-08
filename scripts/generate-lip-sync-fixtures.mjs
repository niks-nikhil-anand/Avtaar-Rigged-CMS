import fs from "node:fs";
import path from "node:path";

const sampleRate = 16_000;
const outputDir = path.resolve("tests/fixtures/lip-sync");
fs.mkdirSync(outputDir, { recursive: true });

const clips = [
  ["01-slow-vowels", "slow", "vowels", 0.22, 1.0],
  ["02-normal-vowels", "normal", "vowels", 0.33, 1.0],
  ["03-fast-vowels", "fast", "vowels", 0.46, 1.0],
  ["04-plosives-slow", "slow", "plosives", 0.25, 0.92],
  ["05-plosives-normal", "normal", "plosives", 0.38, 0.92],
  ["06-plosives-fast", "fast", "plosives", 0.52, 0.92],
  ["07-silence-gaps", "normal", "silence", 0.34, 1.0],
  ["08-vowels-low-voice", "normal", "vowels", 0.34, 0.78],
  ["09-vowels-high-voice", "normal", "vowels", 0.34, 1.32],
  ["10-mixed-phrase", "normal", "mixed", 0.34, 1.0],
  ["11-mixed-fast", "fast", "mixed", 0.50, 1.16],
  ["12-mixed-slow", "slow", "mixed", 0.24, 0.88],
];

function wav(samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + samples.length * 2, 4); buffer.write("WAVE", 8);
  buffer.write("fmt ", 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), 44 + index * 2));
  return buffer;
}

function envelope(t, duration) {
  const edge = Math.min(1, t / 0.012, (duration - t) / 0.022);
  return Math.max(0, edge);
}

function vowel(t, duration, base, formants) {
  const e = envelope(t, duration);
  return e * (0.48 * Math.sin(2 * Math.PI * base * t) + 0.20 * Math.sin(2 * Math.PI * formants[0] * t) + 0.11 * Math.sin(2 * Math.PI * formants[1] * t));
}

function makeClip(kind, speed, base, voice) {
  const unit = speed === "slow" ? 0.28 : speed === "fast" ? 0.14 : 0.20;
  const events = kind === "vowels" ? ["A", "E", "O", "A", "E", "O"] : kind === "plosives" ? ["P", "B", "M", "P", "B", "M"] : kind === "silence" ? ["A", "silence", "E", "silence", "O", "silence"] : ["M", "A", "P", "E", "B", "O", "M"];
  const samples = [];
  for (const event of events) {
    const duration = event === "silence" ? unit * 0.8 : unit;
    const count = Math.round(duration * sampleRate);
    for (let i = 0; i < count; i += 1) {
      const t = i / sampleRate;
      let value = 0;
      if (event === "silence") value = 0;
      else if (event === "A") value = vowel(t, duration, base, [700 * voice, 1200 * voice]);
      else if (event === "E") value = vowel(t, duration, base, [500 * voice, 2100 * voice]);
      else if (event === "O") value = vowel(t, duration, base, [450 * voice, 900 * voice]);
      else {
        const burst = t < duration * 0.18 ? Math.sin(2 * Math.PI * (900 + 1800 * t / Math.max(duration * 0.18, 0.001)) * t) * 0.66 : 0;
        const hum = event === "M" ? Math.sin(2 * Math.PI * base * t) * 0.24 : 0;
        value = envelope(t, duration) * (burst + hum);
      }
      samples.push(value * 0.62);
    }
    const gap = Math.round(sampleRate * 0.018);
    for (let i = 0; i < gap; i += 1) samples.push(0);
  }
  return samples;
}

const manifest = clips.map(([id, speed, content, , voice]) => {
  const samples = makeClip(content, speed, 120 * voice, voice);
  fs.writeFileSync(path.join(outputDir, `${id}.wav`), wav(samples));
  return { id, file: `${id}.wav`, sampleRate, channels: 1, durationSeconds: Number((samples.length / sampleRate).toFixed(3)), speed, content, voiceProfile: voice === 1 ? "neutral" : voice < 1 ? "low" : "high", expectedEvents: content === "vowels" ? ["A", "E", "O"] : content === "plosives" ? ["P", "B", "M"] : ["A", "E", "O", "P", "B", "M", "silence"] };
});
fs.writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify({ generatedBy: "scripts/generate-lip-sync-fixtures.mjs", purpose: "Deterministic audio fixtures for playback-clock and viseme benchmarks", clips: manifest }, null, 2)}\n`);
console.log(`Generated ${manifest.length} lip-sync fixtures in ${outputDir}`);
