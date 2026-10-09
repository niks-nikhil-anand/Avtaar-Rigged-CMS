"use client";

import { useEffect, useState } from "react";
import type { AvatarEngine } from "@/avatar/engine/AvatarEngine";

export default function ProsodyCalibrationPanel({ engine }: { engine: AvatarEngine }) {
  const [energy, setEnergy] = useState(0.5);
  const [pitch, setPitch] = useState(0.5);
  const [speaking, setSpeaking] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [diagnostics, setDiagnostics] = useState(engine.behavior.getDiagnostics());

  useEffect(() => {
    engine.behavior.enable();
    engine.behavior.setState(speaking ? "speaking" : "idle");
    engine.behavior.setReducedMotion(reducedMotion);
    engine.behavior.setProsodyInput(speaking ? { energy, pitch, speaking } : null);
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
  }, [energy, engine, pitch, reducedMotion, speaking]);

  const setPreset = (nextEnergy: number, nextPitch: number, nextSpeaking = true) => {
    setEnergy(nextEnergy);
    setPitch(nextPitch);
    setSpeaking(nextSpeaking);
  };

  const reset = () => {
    setEnergy(0.5);
    setPitch(0.5);
    setSpeaking(false);
    setReducedMotion(false);
    engine.behavior.setProsodyInput(null);
    engine.behavior.setState("idle");
    engine.behavior.setReducedMotion(false);
  };

  return <details><summary>Prosody calibration</summary>
    <p className="muted">Development-only speech feature testing. This feeds BehaviorController prosody input and does not write bones directly.</p>
    <p className="action-label">Speech samples</p>
    <div className="preset-row">
      <button type="button" onClick={() => setPreset(0, 0.5, false)}>Silent</button>
      <button type="button" onClick={() => setPreset(0.04, 0.5)}>Pause</button>
      <button type="button" onClick={() => setPreset(0.25, 0.45)}>Low</button>
      <button type="button" onClick={() => setPreset(0.5, 0.5)}>Normal</button>
      <button type="button" onClick={() => setPreset(0.8, 0.75)}>High</button>
      <button type="button" onClick={() => setPreset(1, 1)}>Emphasis</button>
      <button type="button" onClick={reset}>Reset</button>
    </div>
    <label className="slider-control"><span>Energy<output>{energy.toFixed(2)}</output></span><input aria-label="Prosody energy" type="range" min="0" max="1" step="0.01" value={energy} onChange={(event) => setEnergy(Number(event.target.value))} /></label>
    <label className="slider-control"><span>Pitch<output>{pitch.toFixed(2)}</output></span><input aria-label="Prosody pitch" type="range" min="0" max="1" step="0.01" value={pitch} onChange={(event) => setPitch(Number(event.target.value))} /></label>
    <label className="checkbox-row"><input type="checkbox" checked={speaking} onChange={(event) => setSpeaking(event.target.checked)} /> Speaking</label>
    <label className="checkbox-row"><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /> Reduced motion</label>

    <p className="action-label">Live diagnostics</p>
    <div className="stat-grid calibration-stats"><div><strong>{diagnostics?.prosody.energy.toFixed(2) ?? "0.00"}</strong><span>Energy</span></div><div><strong>{diagnostics?.prosody.pitch.toFixed(2) ?? "0.50"}</strong><span>Pitch</span></div><div><strong>{diagnostics?.prosody.emphasis.toFixed(2) ?? "0.00"}</strong><span>Emphasis</span></div></div>
    <div className="inventory-item"><strong>Prosody flags</strong><p>Speaking {String(diagnostics?.prosody.speaking ?? false)} · Pause {String(diagnostics?.prosody.pause ?? false)} · Reduced {String(diagnostics?.reducedMotion ?? false)}</p></div>
    <div className="inventory-item"><strong>Head prosody offset</strong><p>Yaw {(diagnostics?.head.prosodyOffset.yaw ?? 0).toFixed(3)} · Pitch {(diagnostics?.head.prosodyOffset.pitch ?? 0).toFixed(3)} · Roll {(diagnostics?.head.prosodyOffset.roll ?? 0).toFixed(3)}</p></div>
  </details>;
}
