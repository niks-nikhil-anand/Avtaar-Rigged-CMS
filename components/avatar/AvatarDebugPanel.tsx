"use client";
import { useCallback, useImperativeHandle, useState, type KeyboardEvent, type Ref } from "react";
import { modelProfile } from "@/avatar/model/modelProfile";
import type { AvatarReady } from "./Avatar";
import { createBlendDemo } from "@/avatar/engine/createBlendDemo";
import { animationPriorities } from "@/avatar/engine/AnimationMixer";
import AvatarBehaviorPanel from "./AvatarBehaviorPanel";
import AvatarPosePanel from "./AvatarPosePanel";
import LightingPanel, { type LightingControls } from "./LightingPanel";
import { ActivityIcon, FaceIcon, LayersIcon, LightIcon, PoseIcon, ResetIcon, SaveIcon } from "@/components/ui/icons";

type Tab = "poses" | "face" | "behavior" | "lighting" | "inspect";
const tabs: { id: Tab; label: string; icon: () => React.JSX.Element }[] = [
  { id: "poses", label: "Poses", icon: PoseIcon },
  { id: "face", label: "Face", icon: FaceIcon },
  { id: "behavior", label: "Behavior", icon: ActivityIcon },
  { id: "lighting", label: "Lighting", icon: LightIcon },
  { id: "inspect", label: "Inspect", icon: LayersIcon },
];
const tabKey = "avatar-sidebar-tab";
function readTab(): Tab {
  try { const value = localStorage.getItem(tabKey); return tabs.some((item) => item.id === value) ? value as Tab : "poses"; } catch { return "poses"; }
}

export interface BlendDemoControls { toggleDemo: () => void }

export default function AvatarDebugPanel({ model, demoRef, onDemoChange, lighting, save }: {
  model: AvatarReady | null;
  demoRef: Ref<BlendDemoControls>;
  onDemoChange: (running: boolean) => void;
  lighting: LightingControls;
  save: { onSave: () => void; onClear: () => void; savedAt: string | null; error: string };
}) {
  const [values, setValues] = useState<Record<string, number>>({});
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("");
  const [demo, setDemo] = useState(false);
  const [paused, setPaused] = useState(false);
  // This panel only renders client-side (the scene is loaded with ssr: false), so saved state can seed the initial value.
  const [tab, setTab] = useState<Tab>(readTab);
  const chooseTab = (next: Tab) => { setTab(next); try { localStorage.setItem(tabKey, next); } catch { /* optional persistence */ } };
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((item) => item.id === tab);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length].id;
    chooseTab(next);
    requestAnimationFrame(() => document.getElementById(`sidebar-tab-${next}`)?.focus());
  };
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
  if (!model) return <aside className="debug-panel" aria-busy="true" aria-label="Model controls loading"><div className="sidebar-head"><div className="skeleton skeleton-title" /></div><div className="sidebar-body"><div className="skeleton" /><div className="skeleton" /><div className="skeleton skeleton-short" /><p className="muted">Controls will appear when the model is ready.</p></div></aside>;
  const { bindings, report, engine } = model;
  const names = [...bindings.morphs.keys()].sort();
  // The engine is the source of truth, so sliders show a restored saved look instead of zero.
  const manual = engine.face.getExpression("debug:morph");
  function reset() { engine.reset(); engine.start(); setDemo(false); onDemoChange(false); setPaused(false); setValues({}); setRotations({}); setBehaviorRevision((value) => value + 1); }
  function setMorph(name: string, value: number) { engine.setMorph(name, value); setValues((previous) => ({ ...previous, [name]: value })); }
  function preset(name: string) {
    reset();
    const weights = modelProfile.presets[name];
    engine.setExpression(weights, "debug:morph", animationPriorities.debug);
    setValues(weights);
  }
  return <aside className="debug-panel" data-tab={tab} aria-label="Model controls">
    <div className="sidebar-head">
      <div className="panel-heading"><div><p className="eyebrow">Model lab</p><h2>Explore the rig</h2></div><div className="head-actions"><button className="save-button" onClick={save.onSave} title="Save pose, face, behavior, lighting and camera"><SaveIcon />Save look</button><button className="ghost-button" onClick={reset} title="Return to the default pose and clear all manual changes"><ResetIcon />Reset</button></div></div>
      {(save.savedAt || save.error) && <p className={`save-note ${save.error ? "is-error" : ""}`} role="status">{save.error ? save.error : <>Saved at {new Date(save.savedAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · shown on the Connected page · <button className="link-button" onClick={save.onClear}>Clear</button></>}</p>}
      <div className="tab-bar" role="tablist" aria-label="Control sections" onKeyDown={onTabKey}>{tabs.map(({ id, label, icon: Glyph }) => <button key={id} id={`sidebar-tab-${id}`} role="tab" type="button" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => chooseTab(id)}><Glyph />{label}</button>)}</div>
    </div>
    <div className="sidebar-body" role="tabpanel" aria-labelledby={`sidebar-tab-${tab}`}>
    <section className="tab-section" data-tab="behavior">
    <div className="preset-row"><button onClick={toggleDemo}>{demo ? "Stop blend demo" : "Run blend demo"}</button><button onClick={() => {
      if (paused) engine.start(); else engine.stop();
      setPaused(!paused);
    }}>{paused ? "Resume engine" : "Pause engine"}</button><button onClick={() => {
      engine.resetExpression("debug:morph"); setValues({});
    }}>Release facial controls</button></div>
    <p className="muted" role="status">{paused ? "Engine paused · Pose held" : demo ? "Blend demo · Smile + simulated speech + blink + head motion" : "Engine running · Behavior and manual controls"}</p>
    </section>
    <AvatarPosePanel key={`pose-${behaviorRevision}`} engine={engine} bindings={bindings} />
    <AvatarBehaviorPanel key={behaviorRevision} engine={engine} onActivate={() => {
      setPaused(false);
      if (demo) {
        for (const source of ["demo:idle", "demo:speech", "demo:blink"]) engine.removeSystem(source);
        engine.removeLayer("demo:emotion"); setDemo(false); onDemoChange(false);
      }
    }} onReturnToIdle={() => { reset(); engine.behavior.enable(); }} />
    <section className="tab-section" data-tab="face">
    <p className="action-label">Quick presets</p>
    <div className="preset-row">{Object.keys(modelProfile.presets).map((name) => <button key={name} onClick={() => preset(name)} disabled={Object.keys(modelProfile.presets[name]).some((morph) => !bindings.morphs.has(morph))}>{name}</button>)}</div>
    {bindings.unsupported.length > 0 && <p className="notice">Unavailable controls: {bindings.unsupported.join(", ")}</p>}
    <details open><summary>Facial morphs</summary><label className="search-label">Filter shapes<input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Try jaw, blink, smile…" /></label>
      <div className="morph-list">{names.filter((name) => name.toLowerCase().includes(filter.toLowerCase())).map((name) => {
        const value = values[name] ?? manual[name] ?? bindings.morphs.get(name)![0].initial;
        return <label className="slider-control" key={name}><span>{name}<output>{value.toFixed(2)}</output></span><input aria-label={name} type="range" min="0" max="1" step="0.01" value={value} onChange={(event) => setMorph(name, Number(event.target.value))} /></label>;
      })}</div>
    </details>
    </section>
    <LightingPanel lighting={lighting} />
    <section className="tab-section" data-tab="inspect">
    <div className="stat-grid"><div><strong>{report.meshes.length}</strong><span>Meshes</span></div><div><strong>{report.bones.length}</strong><span>Bones</span></div><div><strong>{names.length}</strong><span>Shapes</span></div></div>
    <details><summary>Head & eye rotation</summary><p className="muted">Small offsets from the original local bone pose.</p>{modelProfile.bones.map((name) => <div key={name}>{["pitch", "yaw"].map((axis) => {
      const key = `${name}-${axis}`;
      const limit = name.includes("Eye") ? 0.18 : 0.25;
      return <label className="slider-control" key={key}><span>{name} {axis}<output>{(rotations[key] ?? 0).toFixed(2)}</output></span><input aria-label={`${name} ${axis}`} type="range" min={-limit} max={limit} step="0.01" value={rotations[key] ?? 0} disabled={!bindings.bones.has(name)} onChange={(event) => {
        const next = { ...rotations, [key]: Number(event.target.value) }; setRotations(next); engine.setBoneRotation(name, next[`${name}-pitch`] ?? 0, next[`${name}-yaw`] ?? 0);
      }} /></label>;
    })}</div>)}</details>
    <details><summary>Scene inventory</summary>{report.meshes.map((mesh, index) => <div className="inventory-item" key={index}><strong>{mesh.name}</strong><p>{mesh.morphs.length} morphs · {mesh.materials.join(", ")}</p></div>)}<p className="muted">Animation clips: {report.animations.length ? report.animations.join(", ") : "None — procedural motion planned"}</p><p className="muted">Original bounds: {report.bounds.map((value) => value.toFixed(3)).join(" × ")}</p><p className="bone-list">Bones: {report.bones.join(", ")}</p></details>
    </section>
    </div>
  </aside>;
}
