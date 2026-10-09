"use client";

import { useEffect, useMemo, useState } from "react";
import type { AvatarEngine } from "@/avatar/engine/AvatarEngine";
import { animationPriorities } from "@/avatar/engine/AnimationMixer";
import {
  defaultHeadMotionConfig,
  HeadMotionEngine,
  type HeadMotionDiagnostics,
  type HeadMotionConfig,
  type HeadSign,
  type HeadTarget,
} from "@/avatar/engine/HeadMotionEngine";

const source = "debug:head-calibration";

const targetButtons: { label: string; target: HeadTarget }[] = [
  { label: "Center", target: { yaw: 0, pitch: 0, roll: 0 } },
  { label: "Left", target: { yaw: -1, pitch: 0, roll: 0 } },
  { label: "Right", target: { yaw: 1, pitch: 0, roll: 0 } },
  { label: "Up", target: { yaw: 0, pitch: 1, roll: 0 } },
  { label: "Down", target: { yaw: 0, pitch: -1, roll: 0 } },
  { label: "Roll left", target: { yaw: 0, pitch: 0, roll: -1 } },
  { label: "Roll right", target: { yaw: 0, pitch: 0, roll: 1 } },
  { label: "Left + up", target: { yaw: -0.7, pitch: 0.7, roll: 0 } },
  { label: "Right + roll", target: { yaw: 0.7, pitch: 0, roll: 0.6 } },
];

const fmt = (value: number) => value.toFixed(3);

export default function HeadCalibrationPanel({ engine }: { engine: AvatarEngine }) {
  const [target, setTarget] = useState<HeadTarget>({ yaw: 0, pitch: 0, roll: 0 });
  const [yawLimit, setYawLimit] = useState(defaultHeadMotionConfig.rig.limits.yaw);
  const [pitchLimit, setPitchLimit] = useState(defaultHeadMotionConfig.rig.limits.pitch);
  const [rollLimit, setRollLimit] = useState(defaultHeadMotionConfig.rig.limits.roll);
  const [yawSign, setYawSign] = useState<HeadSign>(defaultHeadMotionConfig.rig.axisMapping.yawSign);
  const [pitchSign, setPitchSign] = useState<HeadSign>(defaultHeadMotionConfig.rig.axisMapping.pitchSign);
  const [rollSign, setRollSign] = useState<HeadSign>(defaultHeadMotionConfig.rig.axisMapping.rollSign);
  const [smoothing, setSmoothing] = useState(defaultHeadMotionConfig.smoothing);
  const [energy, setEnergy] = useState(0);
  const [emphasis, setEmphasis] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [diagnostics, setDiagnostics] = useState<HeadMotionDiagnostics>(() => new HeadMotionEngine(defaultHeadMotionConfig).getDiagnostics());

  const config = useMemo<HeadMotionConfig>(() => ({
    ...defaultHeadMotionConfig,
    rig: {
      ...defaultHeadMotionConfig.rig,
      axisMapping: {
        ...defaultHeadMotionConfig.rig.axisMapping,
        yawSign,
        pitchSign,
        rollSign,
      },
      limits: {
        yaw: Math.abs(yawLimit),
        pitch: Math.abs(pitchLimit),
        roll: Math.abs(rollLimit),
      },
    },
    smoothing,
  }), [pitchLimit, pitchSign, rollLimit, rollSign, smoothing, yawLimit, yawSign]);

  useEffect(() => {
    const controller = new HeadMotionEngine(config);
    let frame = 0;
    let last = performance.now();
    let lastSample = 0;
    const tick = (now: number) => {
      const delta = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const output = controller.update({
        deltaTime: delta || 1 / 60,
        target,
        prosody: { energy, emphasis, speaking },
        reducedMotion,
      });
      engine.setLayer(source, { priority: animationPriorities.debug, channels: output.channels });
      if (now - lastSample > 150) {
        lastSample = now;
        setDiagnostics(controller.getDiagnostics());
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      engine.mixer.removeLayer(source);
    };
  }, [config, emphasis, energy, engine, reducedMotion, speaking, target]);

  const reset = () => {
    setTarget({ yaw: 0, pitch: 0, roll: 0 });
    setEnergy(0);
    setEmphasis(0);
    setSpeaking(false);
    engine.mixer.removeLayer(source);
  };

  return <details><summary>Head calibration</summary>
    <p className="muted">Development-only calibration for semantic HeadMotionEngine targets. This writes a debug animation layer and does not add behavior intelligence.</p>
    <p className="action-label">Target</p>
    <div className="preset-row">{targetButtons.map(({ label, target }) => <button key={label} type="button" onClick={() => setTarget(target)}>{label}</button>)}<button type="button" onClick={reset}>Reset</button></div>
    <label className="slider-control"><span>Yaw target<output>{target.yaw.toFixed(2)}</output></span><input aria-label="Head target yaw" type="range" min="-1" max="1" step="0.01" value={target.yaw} onChange={(event) => setTarget((current) => ({ ...current, yaw: Number(event.target.value) }))} /></label>
    <label className="slider-control"><span>Pitch target<output>{target.pitch.toFixed(2)}</output></span><input aria-label="Head target pitch" type="range" min="-1" max="1" step="0.01" value={target.pitch} onChange={(event) => setTarget((current) => ({ ...current, pitch: Number(event.target.value) }))} /></label>
    <label className="slider-control"><span>Roll target<output>{target.roll.toFixed(2)}</output></span><input aria-label="Head target roll" type="range" min="-1" max="1" step="0.01" value={target.roll} onChange={(event) => setTarget((current) => ({ ...current, roll: Number(event.target.value) }))} /></label>

    <p className="action-label">Calibration</p>
    <label className="slider-control"><span>Yaw limit<output>{yawLimit.toFixed(2)}</output></span><input aria-label="Head yaw limit" type="range" min="0" max="0.3" step="0.005" value={yawLimit} onChange={(event) => setYawLimit(Number(event.target.value))} /></label>
    <label className="slider-control"><span>Pitch limit<output>{pitchLimit.toFixed(2)}</output></span><input aria-label="Head pitch limit" type="range" min="0" max="0.2" step="0.005" value={pitchLimit} onChange={(event) => setPitchLimit(Number(event.target.value))} /></label>
    <label className="slider-control"><span>Roll limit<output>{rollLimit.toFixed(2)}</output></span><input aria-label="Head roll limit" type="range" min="0" max="0.2" step="0.005" value={rollLimit} onChange={(event) => setRollLimit(Number(event.target.value))} /></label>
    <label className="slider-control"><span>Smoothing<output>{smoothing.toFixed(1)}</output></span><input aria-label="Head smoothing" type="range" min="0" max="30" step="0.5" value={smoothing} onChange={(event) => setSmoothing(Number(event.target.value))} /></label>
    <div className="preset-row"><button type="button" aria-pressed={yawSign === 1} onClick={() => setYawSign(1)}>Yaw +1</button><button type="button" aria-pressed={yawSign === -1} onClick={() => setYawSign(-1)}>Yaw -1</button><button type="button" aria-pressed={pitchSign === 1} onClick={() => setPitchSign(1)}>Pitch +1</button><button type="button" aria-pressed={pitchSign === -1} onClick={() => setPitchSign(-1)}>Pitch -1</button><button type="button" aria-pressed={rollSign === 1} onClick={() => setRollSign(1)}>Roll +1</button><button type="button" aria-pressed={rollSign === -1} onClick={() => setRollSign(-1)}>Roll -1</button></div>

    <p className="action-label">Prosody sample</p>
    <div className="preset-row"><button type="button" aria-pressed={speaking} onClick={() => setSpeaking((value) => !value)}>{speaking ? "Speaking on" : "Speaking off"}</button><button type="button" onClick={() => { setSpeaking(true); setEnergy(0.5); setEmphasis(0.2); }}>Normal speech</button><button type="button" onClick={() => { setSpeaking(true); setEnergy(1); setEmphasis(1); }}>High emphasis</button><button type="button" onClick={() => { setSpeaking(false); setEnergy(0); setEmphasis(0); }}>Pause</button></div>
    <label className="slider-control"><span>Energy<output>{energy.toFixed(2)}</output></span><input aria-label="Head prosody energy" type="range" min="0" max="1" step="0.01" value={energy} onChange={(event) => setEnergy(Number(event.target.value))} /></label>
    <label className="slider-control"><span>Emphasis<output>{emphasis.toFixed(2)}</output></span><input aria-label="Head prosody emphasis" type="range" min="0" max="1" step="0.01" value={emphasis} onChange={(event) => setEmphasis(Number(event.target.value))} /></label>
    <label className="checkbox-row"><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /> Reduced motion</label>

    <p className="action-label">Live diagnostics</p>
    <div className="stat-grid calibration-stats"><div><strong>{fmt(diagnostics.output.yaw)}</strong><span>Yaw</span></div><div><strong>{fmt(diagnostics.output.pitch)}</strong><span>Pitch</span></div><div><strong>{fmt(diagnostics.output.roll)}</strong><span>Roll</span></div></div>
    <div className="inventory-item"><strong>Channels</strong><p>{Object.entries(diagnostics.channels).map(([key, value]) => `${key} ${fmt(value as number)}`).join(" · ") || "Neutral"}</p></div>
    <div className="inventory-item"><strong>Settings</strong><p>Yaw {fmt(yawLimit)} · Pitch {fmt(pitchLimit)} · Roll {fmt(rollLimit)} · Smoothing {smoothing.toFixed(1)}</p></div>
  </details>;
}
