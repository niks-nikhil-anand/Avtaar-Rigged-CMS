"use client";

import { useEffect, useState } from "react";
import type { PlaybackFrame } from "@/services/audio/PcmPlayer";
import type { AvatarReady } from "./Avatar";

type MetricSample = { fps: number; frameTime: number; p95: number; jaw: number; morphs: [string, number][] };

function percentile(values: number[], rank: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * rank))];
}

export default function DebugMetricsOverlay({ model, playback }: { model: AvatarReady | null; playback?: PlaybackFrame }) {
  const [visible, setVisible] = useState(false);
  const [sample, setSample] = useState<MetricSample>({ fps: 0, frameTime: 0, p95: 0, jaw: 0, morphs: [] });
  const [waveform, setWaveform] = useState<number[]>(Array.from({ length: 28 }, () => 0.08));
  const [offset, setOffset] = useState<number | null>(null);

  useEffect(() => {
    if (!model) return;
    let frame = 0;
    let last = performance.now();
    let windowStart = last;
    const frameTimes: number[] = [];
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      if (delta > 0 && delta < 1000) frameTimes.push(delta);
      if (now - windowStart >= 500) {
        const average = frameTimes.reduce((total, value) => total + value, 0) / Math.max(1, frameTimes.length);
        const morphNames = ["jawOpen", "eyeBlinkLeft", "eyeBlinkRight", "mouthSmileLeft", "mouthSmileRight", "mouthFunnel", "mouthPucker", "browInnerUp"];
        setSample({
          fps: frameTimes.length * 1000 / Math.max(1, now - windowStart),
          frameTime: average,
          p95: percentile(frameTimes, 0.95),
          jaw: model.engine.face.control("jawOpen"),
          morphs: morphNames.filter((name) => model.engine.hasMorph(name)).map((name) => [name, model.engine.face.control(name)]),
        });
        frameTimes.length = 0;
        windowStart = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [model]);

  useEffect(() => {
    const amplitude = Math.max(0.04, playback?.amplitude ?? 0);
    const timer = window.setTimeout(() => setWaveform((current) => [...current.slice(-27), amplitude * (0.55 + Math.random() * 0.45)]), 0);
    return () => window.clearTimeout(timer);
  }, [playback?.amplitude]);

  useEffect(() => {
    const updateOffset = () => setOffset(playback?.timestamp ? Math.max(0, performance.now() - playback.timestamp) : null);
    updateOffset();
    const timer = window.setInterval(updateOffset, 250);
    return () => window.clearInterval(timer);
  }, [playback?.timestamp]);

  if (!visible) return <button className="metrics-toggle" onClick={() => setVisible(true)} type="button">⌁ Metrics</button>;
  return <section className="metrics-overlay" aria-label="Debug metrics overlay">
    <header><div><strong>Runtime metrics</strong><span>Development overlay</span></div><button onClick={() => setVisible(false)} aria-label="Hide metrics">×</button></header>
    <div className="metrics-wave" aria-label="Audio waveform">{waveform.map((height, index) => <i key={index} style={{ height: `${Math.max(8, height * 100)}%` }} />)}</div>
    <div className="metrics-grid"><div><span>FPS</span><b>{sample.fps.toFixed(0)}</b></div><div><span>Frame avg</span><b>{sample.frameTime.toFixed(1)} ms</b></div><div><span>Frame p95</span><b>{sample.p95.toFixed(1)} ms</b></div><div><span>Queue</span><b>{(playback?.queuedSeconds ?? 0).toFixed(2)} s</b></div><div><span>Mouth offset*</span><b>{offset === null ? "—" : `${offset.toFixed(0)} ms`}</b></div><div><span>Amplitude</span><b>{(playback?.amplitude ?? 0).toFixed(2)}</b></div></div>
    <div className="metrics-section"><h4>Current morph weights</h4>{sample.morphs.length ? sample.morphs.map(([name, value]) => <div className="metric-bar" key={name}><span>{name}</span><i><b style={{ width: `${value * 100}%` }} /></i><em>{value.toFixed(2)}</em></div>) : <p>Waiting for avatar model…</p>}</div>
    <small className="metrics-note">* Measures time since the latest playback sample reached the UI; use the reference clips to calibrate true audio-to-mouth offset.</small>
  </section>;
}
