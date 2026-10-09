"use client";

import { useEffect, useState } from "react";
import type { AvatarEngine } from "@/avatar/engine/AvatarEngine";
import { animationPriorities } from "@/avatar/engine/AnimationMixer";
import {
  defaultGestureConfig,
  GestureEngine,
  type GestureDiagnostics,
  type GestureName,
} from "@/avatar/engine/GestureEngine";

const source = "debug:gesture-calibration";
const gestureNames: GestureName[] = ["none", "open-hand", "emphasis", "small-point", "thinking-touch"];
const fmt = (value: number) => value.toFixed(3);

export default function GestureCalibrationPanel({ engine }: { engine: AvatarEngine }) {
  const [gesture, setGesture] = useState<GestureName>("none");
  const [intensity, setIntensity] = useState(1);
  const [holdDuration, setHoldDuration] = useState(2);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [diagnostics, setDiagnostics] = useState<GestureDiagnostics>(() => new GestureEngine().getDiagnostics());

  useEffect(() => {
    const controller = new GestureEngine({ holdDuration });
    let frame = 0;
    let last = performance.now();
    let lastSample = 0;
    let remainingCycles = cycleCount;
    let cycleElapsed = 0;
    const cycleGesture: GestureName = gesture === "none" ? "emphasis" : gesture;
    const activeWindow = defaultGestureConfig.enterDuration + holdDuration;
    const cycleWindow = activeWindow + defaultGestureConfig.exitDuration + 0.2;
    const tick = (now: number) => {
      const delta = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      cycleElapsed += delta || 1 / 60;
      const current = remainingCycles > 0 ? cycleElapsed <= activeWindow ? cycleGesture : "none" : gesture;
      const output = controller.update({ deltaTime: delta || 1 / 60, gesture: current, intensity, reducedMotion });
      engine.setLayer(source, { priority: animationPriorities.debug, channels: output.channels });
      const currentDiagnostics = controller.getDiagnostics();
      if (remainingCycles > 0 && cycleElapsed >= cycleWindow) {
        remainingCycles -= 1;
        cycleElapsed = 0;
      }
      if (now - lastSample > 150) {
        lastSample = now;
        setDiagnostics(currentDiagnostics);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      engine.mixer.removeLayer(source);
    };
  }, [cycleCount, engine, gesture, holdDuration, intensity, reducedMotion]);

  const reset = () => {
    setGesture("none");
    setCycleCount(0);
    engine.mixer.removeLayer(source);
  };

  return <details><summary>Gesture calibration</summary>
    <p className="muted">Development-only calibration for existing GestureEngine gestures. This writes a debug animation layer and does not add automatic gesture selection.</p>

    <p className="action-label">Gesture</p>
    <div className="preset-row">{gestureNames.map((name) => <button key={name} type="button" aria-pressed={gesture === name} onClick={() => setGesture(name)}>{name}</button>)}<button type="button" onClick={reset}>Reset</button></div>
    <label className="slider-control"><span>Intensity<output>{intensity.toFixed(2)}</output></span><input aria-label="Gesture intensity" type="range" min="0" max="1" step="0.01" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} /></label>
    <label className="slider-control"><span>Hold duration<output>{holdDuration.toFixed(2)}</output></span><input aria-label="Gesture hold duration" type="range" min="0.1" max="2" step="0.05" value={holdDuration} onChange={(event) => setHoldDuration(Number(event.target.value))} /></label>
    <label className="checkbox-row"><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /> Reduced motion</label>

    <p className="action-label">Cycle stability</p>
    <div className="preset-row"><button type="button" onClick={() => setCycleCount((value) => value + 10)}>Run 10 cycles</button><button type="button" onClick={() => setCycleCount((value) => value + 20)}>Run 20 cycles</button><button type="button" onClick={() => setCycleCount(0)}>Stop cycles</button></div>

    <p className="action-label">Live diagnostics</p>
    <div className="stat-grid calibration-stats"><div><strong>{diagnostics.activeGesture}</strong><span>Active</span></div><div><strong>{diagnostics.phase}</strong><span>Phase</span></div><div><strong>{diagnostics.progress.toFixed(2)}</strong><span>Progress</span></div></div>
    <div className="inventory-item"><strong>Channels</strong><p>{Object.entries(diagnostics.channels).map(([key, value]) => `${key} ${fmt(value as number)}`).join(" · ") || "Neutral"}</p></div>
  </details>;
}
