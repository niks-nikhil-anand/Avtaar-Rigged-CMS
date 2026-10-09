"use client";

import { useEffect, useMemo, useState } from "react";
import type { AvatarEngine } from "@/avatar/engine/AvatarEngine";
import { defaultEyeRigConfig, EyeController, eyeCalibrationTargets, type EyeDiagnostics, type EyeRigConfig, type EyeSign, type EyeTarget } from "@/avatar/engine/EyeController";

const targetButtons: { label: string; target: EyeTarget }[] = [
  { label: "Left", target: { x: -1, y: 0 } },
  { label: "Center", target: { x: 0, y: 0 } },
  { label: "Right", target: { x: 1, y: 0 } },
  { label: "Up", target: { x: 0, y: 1 } },
  { label: "Down", target: { x: 0, y: -1 } },
];

const fmt = (value: number) => value.toFixed(3);

export default function EyeCalibrationPanel({ engine }: { engine: AvatarEngine }) {
  const [target, setTarget] = useState<EyeTarget>({ x: 0, y: 0 });
  const [horizontal, setHorizontal] = useState(defaultEyeRigConfig.horizontalLimit.max);
  const [vertical, setVertical] = useState(defaultEyeRigConfig.verticalLimit.max);
  const [yawSign, setYawSign] = useState<EyeSign>(defaultEyeRigConfig.axisMapping.yawSign);
  const [pitchSign, setPitchSign] = useState<EyeSign>(defaultEyeRigConfig.axisMapping.pitchSign);
  const [smoothing, setSmoothing] = useState(defaultEyeRigConfig.smoothing);
  const [diagnostics, setDiagnostics] = useState<EyeDiagnostics>(() => new EyeController(defaultEyeRigConfig).getDiagnostics());

  const config = useMemo<EyeRigConfig>(() => ({
    ...defaultEyeRigConfig,
    horizontalLimit: { min: -Math.abs(horizontal), max: Math.abs(horizontal) },
    verticalLimit: { min: -Math.abs(vertical), max: Math.abs(vertical) },
    axisMapping: { ...defaultEyeRigConfig.axisMapping, yawSign, pitchSign },
    smoothing,
  }), [horizontal, vertical, pitchSign, yawSign, smoothing]);

  useEffect(() => {
    const controller = new EyeController(config);
    let frame = 0;
    let last = performance.now();
    let lastSample = 0;
    const tick = (now: number) => {
      const delta = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      controller.setTarget(target);
      const output = controller.update(delta || 1 / 60);
      engine.setBoneRotation(config.leftEye, output.left.pitch, output.left.yaw);
      engine.setBoneRotation(config.rightEye, output.right.pitch, output.right.yaw);
      if (now - lastSample > 150) {
        lastSample = now;
        setDiagnostics(controller.getDiagnostics());
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      engine.removeLayer(`debug:bone:${config.leftEye}`);
      engine.removeLayer(`debug:bone:${config.rightEye}`);
    };
  }, [config, engine, target]);

  const reset = () => {
    setTarget({ x: 0, y: 0 });
    engine.removeLayer(`debug:bone:${config.leftEye}`);
    engine.removeLayer(`debug:bone:${config.rightEye}`);
  };

  return <details><summary>Eye calibration</summary>
    <p className="muted">Development-only calibration for semantic EyeTarget values. This uses EyeController and debug bone layers; it does not add saccades or behavior intelligence.</p>
    <p className="action-label">Target</p>
    <div className="preset-row">{targetButtons.map(({ label, target }) => <button key={label} type="button" onClick={() => setTarget(target)}>{label}</button>)}<button type="button" onClick={reset}>Reset</button></div>
    <label className="slider-control"><span>Horizontal target<output>{target.x.toFixed(2)}</output></span><input aria-label="Eye target X" type="range" min="-1" max="1" step="0.01" value={target.x} onChange={(event) => setTarget((current) => ({ ...current, x: Number(event.target.value) }))} /></label>
    <label className="slider-control"><span>Vertical target<output>{target.y.toFixed(2)}</output></span><input aria-label="Eye target Y" type="range" min="-1" max="1" step="0.01" value={target.y} onChange={(event) => setTarget((current) => ({ ...current, y: Number(event.target.value) }))} /></label>

    <p className="action-label">Calibration</p>
    <label className="slider-control"><span>Horizontal limit<output>{horizontal.toFixed(2)}</output></span><input aria-label="Eye horizontal limit" type="range" min="0" max="0.35" step="0.005" value={horizontal} onChange={(event) => setHorizontal(Number(event.target.value))} /></label>
    <label className="slider-control"><span>Vertical limit<output>{vertical.toFixed(2)}</output></span><input aria-label="Eye vertical limit" type="range" min="0" max="0.25" step="0.005" value={vertical} onChange={(event) => setVertical(Number(event.target.value))} /></label>
    <label className="slider-control"><span>Smoothing<output>{smoothing.toFixed(1)}</output></span><input aria-label="Eye smoothing" type="range" min="0" max="30" step="0.5" value={smoothing} onChange={(event) => setSmoothing(Number(event.target.value))} /></label>
    <div className="preset-row"><button type="button" aria-pressed={yawSign === 1} onClick={() => setYawSign(1)}>Yaw +1</button><button type="button" aria-pressed={yawSign === -1} onClick={() => setYawSign(-1)}>Yaw -1</button><button type="button" aria-pressed={pitchSign === 1} onClick={() => setPitchSign(1)}>Pitch +1</button><button type="button" aria-pressed={pitchSign === -1} onClick={() => setPitchSign(-1)}>Pitch -1</button></div>

    <p className="action-label">Regression targets</p>
    <div className="preset-row">{eyeCalibrationTargets.map((item) => <button key={`${item.x}:${item.y}`} type="button" aria-pressed={target.x === item.x && target.y === item.y} onClick={() => setTarget(item)}>{item.x}, {item.y}</button>)}</div>

    <p className="action-label">Live diagnostics</p>
    <div className="stat-grid calibration-stats"><div><strong>{diagnostics.clampedTarget.x.toFixed(2)}</strong><span>Target X</span></div><div><strong>{diagnostics.clampedTarget.y.toFixed(2)}</strong><span>Target Y</span></div><div><strong>{yawSign}</strong><span>Yaw sign</span></div></div>
    <div className="inventory-item"><strong>Left eye rotation</strong><p>Pitch {fmt(diagnostics.output.left.pitch)} · Yaw {fmt(diagnostics.output.left.yaw)} · Roll {fmt(diagnostics.output.left.roll)}</p></div>
    <div className="inventory-item"><strong>Right eye rotation</strong><p>Pitch {fmt(diagnostics.output.right.pitch)} · Yaw {fmt(diagnostics.output.right.yaw)} · Roll {fmt(diagnostics.output.right.roll)}</p></div>
    <div className="inventory-item"><strong>Limits</strong><p>Horizontal {fmt(diagnostics.limits.horizontalLimit.min)} to {fmt(diagnostics.limits.horizontalLimit.max)} · Vertical {fmt(diagnostics.limits.verticalLimit.min)} to {fmt(diagnostics.limits.verticalLimit.max)}</p></div>
  </details>;
}
