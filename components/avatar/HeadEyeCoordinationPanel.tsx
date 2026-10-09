"use client";

import { useEffect, useState } from "react";
import type { AvatarEngine } from "@/avatar/engine/AvatarEngine";

const targets = [
  { label: "Center", x: 0, y: 0 },
  { label: "Slight left", x: -0.25, y: 0 },
  { label: "Left", x: -0.65, y: 0 },
  { label: "Far left", x: -1, y: 0 },
  { label: "Slight right", x: 0.25, y: 0 },
  { label: "Right", x: 0.65, y: 0 },
  { label: "Far right", x: 1, y: 0 },
  { label: "Up", x: 0, y: 1 },
  { label: "Down", x: 0, y: -1 },
  { label: "Upper left", x: -0.75, y: 0.75 },
  { label: "Upper right", x: 0.75, y: 0.75 },
  { label: "Lower left", x: -0.75, y: -0.75 },
  { label: "Lower right", x: 0.75, y: -0.75 },
];

export default function HeadEyeCoordinationPanel({ engine }: { engine: AvatarEngine }) {
  const [target, setTarget] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [diagnostics, setDiagnostics] = useState(engine.behavior.getDiagnostics());

  useEffect(() => {
    engine.behavior.enable();
    engine.behavior.setReducedMotion(reducedMotion);
    engine.behavior.setLookAt(target.x, target.y);
    let frame = 0;
    let lastSample = 0;
    const tick = (now: number) => {
      if (now - lastSample > 150) {
        lastSample = now;
        setDiagnostics(engine.behavior.getDiagnostics());
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [engine, reducedMotion, target]);

  const reset = () => {
    setTarget({ x: 0, y: 0 });
    setReducedMotion(false);
    engine.behavior.releaseLookAt();
    engine.behavior.setReducedMotion(false);
  };

  return <details><summary>Head + eye coordination</summary>
    <p className="muted">Development-only validation for semantic gaze coordination. This drives BehaviorController look targets and never writes bones directly.</p>
    <p className="action-label">Target</p>
    <div className="preset-row">{targets.map((item) => <button key={item.label} type="button" aria-pressed={target.x === item.x && target.y === item.y} onClick={() => setTarget({ x: item.x, y: item.y })}>{item.label}</button>)}<button type="button" onClick={reset}>Reset</button></div>
    <label className="slider-control"><span>Target X<output>{target.x.toFixed(2)}</output></span><input aria-label="Coordination target X" type="range" min="-1" max="1" step="0.01" value={target.x} onChange={(event) => setTarget((current) => ({ ...current, x: Number(event.target.value) }))} /></label>
    <label className="slider-control"><span>Target Y<output>{target.y.toFixed(2)}</output></span><input aria-label="Coordination target Y" type="range" min="-1" max="1" step="0.01" value={target.y} onChange={(event) => setTarget((current) => ({ ...current, y: Number(event.target.value) }))} /></label>
    <label className="checkbox-row"><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /> Reduced motion</label>
    <p className="action-label">Live diagnostics</p>
    <div className="stat-grid calibration-stats"><div><strong>{diagnostics?.headEye.eyeTarget.x.toFixed(2) ?? "0.00"}</strong><span>Eye X</span></div><div><strong>{diagnostics?.headEye.eyeTarget.y.toFixed(2) ?? "0.00"}</strong><span>Eye Y</span></div><div><strong>{diagnostics?.headEye.contribution.toFixed(2) ?? "0.00"}</strong><span>Head share</span></div></div>
    <div className="inventory-item"><strong>Head target</strong><p>Yaw {(diagnostics?.headEye.headTarget.yaw ?? 0).toFixed(3)} · Pitch {(diagnostics?.headEye.headTarget.pitch ?? 0).toFixed(3)} · Roll {(diagnostics?.headEye.headTarget.roll ?? 0).toFixed(3)}</p></div>
  </details>;
}
