"use client";
import { useCallback, useImperativeHandle, useState, type Ref } from "react";
import { modelProfile } from "@/avatar/model/modelProfile";
import type { AvatarReady } from "./Avatar";
import { createBlendDemo } from "@/avatar/engine/createBlendDemo";
import { animationPriorities } from "@/avatar/engine/AnimationMixer";
import AvatarBehaviorPanel from "./AvatarBehaviorPanel";

export interface BlendDemoControls { toggleDemo: () => void }

export default function AvatarDebugPanel({ model, demoRef, onDemoChange }: {
  model: AvatarReady | null;
  demoRef: Ref<BlendDemoControls>;
  onDemoChange: (running: boolean) => void;
}) {
  const [values, setValues] = useState<Record<string, number>>({});
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("");
  const [demo, setDemo] = useState(false);
  const [paused, setPaused] = useState(false);
  const [behaviorRevision, setBehaviorRevision] = useState(0);
  const toggleDemo = useCallback(() => {
    if (!model) return;
    model.engine.reset();
    model.engine.start();
    setPaused(false); setValues({}); setRotations({});
    if (!demo) createBlendDemo(model.engine);
    setDemo(!demo);
    onDemoChange(!demo);
    setBehaviorRevision((value) => value + 1);
  }, [model, demo, onDemoChange]);
  useImperativeHandle(demoRef, () => ({ toggleDemo }), [toggleDemo]);
  if (!model) return <aside className="debug-panel"><p className="muted">Controls will appear when the model is ready.</p></aside>;
  const { bindings, report, engine } = model;
  const names = [...bindings.morphs.keys()].sort();
  function reset() { engine.reset(); engine.start(); setDemo(false); onDemoChange(false); setPaused(false); setValues({}); setRotations({}); setBehaviorRevision((value) => value + 1); }
  function setMorph(name: string, value: number) { engine.setMorph(name, value); setValues((previous) => ({ ...previous, [name]: value })); }
  function preset(name: string) {
    reset();
    const weights = modelProfile.presets[name];
    engine.setExpression(weights, "debug:morph", animationPriorities.debug);
    setValues(weights);
  }
  return <aside className="debug-panel" aria-label="Model debug controls">
    <div className="panel-heading"><div><p className="eyebrow">MODEL LAB</p><h2>Explore the rig</h2></div><button onClick={reset}>Reset pose</button></div>
    <p className="muted">Expressions blend smoothly through the engine. Sliders show target weights; the blend demo supplies independent animation signals.</p>
    <div className="preset-row"><button onClick={toggleDemo}>{demo ? "Stop blend demo" : "Run blend demo"}</button><button onClick={() => {
      if (paused) engine.start(); else engine.stop();
      setPaused(!paused);
    }}>{paused ? "Resume engine" : "Pause engine"}</button><button onClick={() => {
      engine.resetExpression("debug:morph"); setValues({});
    }}>Release facial controls</button></div>
    <p className="muted" role="status">{paused ? "Engine paused · Pose held" : demo ? "Blend demo · Smile + simulated speech + blink + head motion" : "Engine running · Behavior and manual controls"}</p>
    <AvatarBehaviorPanel key={behaviorRevision} engine={engine} onActivate={() => {
      setPaused(false);
      if (demo) {
        for (const source of ["demo:idle", "demo:speech", "demo:blink"]) engine.removeSystem(source);
        engine.removeLayer("demo:emotion"); setDemo(false); onDemoChange(false);
      }
    }} onReturnToIdle={() => { reset(); engine.behavior.enable(); }} />
    <div className="preset-row">{Object.keys(modelProfile.presets).map((name) => <button key={name} onClick={() => preset(name)} disabled={Object.keys(modelProfile.presets[name]).some((morph) => !bindings.morphs.has(morph))}>{name}</button>)}</div>
    {bindings.unsupported.length > 0 && <p className="notice">Unavailable controls: {bindings.unsupported.join(", ")}</p>}
    <div className="stat-grid"><div><strong>{report.meshes.length}</strong><span>Meshes</span></div><div><strong>{report.bones.length}</strong><span>Bones</span></div><div><strong>{names.length}</strong><span>Shapes</span></div></div>
    <details open><summary>Facial morphs</summary><label className="search-label">Filter shapes<input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Try jaw, blink, smile…" /></label>
      <div className="morph-list">{names.filter((name) => name.toLowerCase().includes(filter.toLowerCase())).map((name) => {
        const value = values[name] ?? bindings.morphs.get(name)![0].initial;
        return <label className="slider-control" key={name}><span>{name}<output>{value.toFixed(2)}</output></span><input aria-label={name} type="range" min="0" max="1" step="0.01" value={value} onChange={(event) => setMorph(name, Number(event.target.value))} /></label>;
      })}</div>
    </details>
    <details><summary>Head & eye rotation</summary><p className="muted">Small offsets from the original local bone pose.</p>{modelProfile.bones.map((name) => <div key={name}>{["pitch", "yaw"].map((axis) => {
      const key = `${name}-${axis}`;
      const limit = name.includes("Eye") ? 0.18 : 0.25;
      return <label className="slider-control" key={key}><span>{name} {axis}<output>{(rotations[key] ?? 0).toFixed(2)}</output></span><input aria-label={`${name} ${axis}`} type="range" min={-limit} max={limit} step="0.01" value={rotations[key] ?? 0} disabled={!bindings.bones.has(name)} onChange={(event) => {
        const next = { ...rotations, [key]: Number(event.target.value) }; setRotations(next); engine.setBoneRotation(name, next[`${name}-pitch`] ?? 0, next[`${name}-yaw`] ?? 0);
      }} /></label>;
    })}</div>)}</details>
    <details><summary>Scene inventory</summary>{report.meshes.map((mesh, index) => <div className="inventory-item" key={index}><strong>{mesh.name}</strong><p>{mesh.morphs.length} morphs · {mesh.materials.join(", ")}</p></div>)}<p className="muted">Animation clips: {report.animations.length ? report.animations.join(", ") : "None — procedural motion planned"}</p><p className="muted">Original bounds: {report.bounds.map((value) => value.toFixed(3)).join(" × ")}</p><p className="bone-list">Bones: {report.bones.join(", ")}</p></details>
  </aside>;
}
