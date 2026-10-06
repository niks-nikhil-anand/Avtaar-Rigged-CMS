"use client";
import { useState } from "react";
import type { AvatarEngine } from "@/avatar/engine/AvatarEngine";
import type { ModelBindings } from "@/avatar/types";
import { customPoseId, type PoseAxis } from "@/avatar/pose/PoseController";
import { poses, type Euler3 } from "@/avatar/pose/poses";

const storageKey = "avatar-custom-poses";
interface SavedPose { bones: Record<string, Euler3>; root: { x: number; y: number } }

const axes: { axis: PoseAxis; label: string }[] = [{ axis: "pitch", label: "Bend" }, { axis: "yaw", label: "Twist" }, { axis: "roll", label: "Side" }];
const groups: { title: string; bones: string[] }[] = [
  { title: "Head & neck", bones: ["Head", "Neck"] },
  { title: "Spine", bones: ["Waist", "Spine1", "Spine2"] },
  { title: "Left arm", bones: ["LeftClavicle", "LeftUpperarm", "LeftForearm", "LeftHand"] },
  { title: "Right arm", bones: ["RightClavicle", "RightUpperarm", "RightForearm", "RightHand"] },
  { title: "Left leg", bones: ["LeftThigh", "LeftCalf", "LeftFoot"] },
  { title: "Right leg", bones: ["RightThigh", "RightCalf", "RightFoot"] },
];

function readSaved(): Record<string, SavedPose> {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, SavedPose>; } catch { return {}; }
}
function writeSaved(value: Record<string, SavedPose>): void {
  try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* storage unavailable: saved poses just won't persist */ }
}
const mirrorOf = (bone: string) => bone.startsWith("Left") ? `Right${bone.slice(4)}` : bone.startsWith("Right") ? `Left${bone.slice(5)}` : null;

export default function AvatarPosePanel({ engine, bindings }: { engine: AvatarEngine; bindings: ModelBindings }) {
  const pose = engine.pose;
  const [, setTick] = useState(0);
  const refresh = () => setTick((value) => value + 1);
  const [mirror, setMirror] = useState(true);
  const [saved, setSaved] = useState<Record<string, SavedPose>>(readSaved);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const available = (bone: string) => bindings.bones.has(bone);

  const choose = (id: string) => { engine.start(); pose.setPose(id); setNote(""); refresh(); };
  const setValue = (bone: string, axis: PoseAxis, value: number) => {
    // Edits start from the pose on screen, so switching to custom never jumps.
    if (pose.id !== customPoseId) { const current = pose.snapshot(); pose.load(current.bones, current.root); }
    pose.setCustom(bone, axis, value);
    const other = mirror ? mirrorOf(bone) : null;
    if (other && available(other)) pose.setCustom(other, axis, axis === "pitch" ? value : -value);
    refresh();
  };
  const setRoot = (axis: "x" | "y", value: number) => {
    if (pose.id !== customPoseId) { const current = pose.snapshot(); pose.load(current.bones, current.root); }
    pose.setRoot(axis, value); refresh();
  };
  const save = () => {
    const key = name.trim();
    if (!key) { setNote("Enter a name first."); return; }
    const next = { ...saved, [key]: pose.snapshot() };
    setSaved(next); writeSaved(next); setNote(`Saved "${key}".`);
  };
  const load = (key: string) => {
    const item = saved[key];
    if (!item) return;
    engine.start(); pose.load(item.bones, item.root); setName(key); setNote(`Loaded "${key}".`); refresh();
  };
  const remove = (key: string) => {
    const rest = Object.fromEntries(Object.entries(saved).filter(([saveKey]) => saveKey !== key));
    setSaved(rest); writeSaved(rest); setNote(`Deleted "${key}".`);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(pose.snapshot(), null, 2)); setNote("Pose JSON copied."); }
    catch { setNote("Copy is not available in this browser."); }
  };
  const root = pose.getRoot();
  const activeLabel = pose.id === customPoseId ? "Custom" : poses.find((item) => item.id === pose.id)?.label ?? pose.id;

  return <section className="tab-section pose-panel" data-tab="poses">
    <p className="muted" role="status">Current pose: {activeLabel}</p>
    <div className="preset-row pose-grid">{poses.map((item) => <button key={item.id} title={item.tests} aria-label={item.label} aria-pressed={pose.id === item.id} onClick={() => choose(item.id)}>{item.label}</button>)}</div>
    <details className="pose-custom"><summary>Custom pose</summary>
      <label className="motion-control"><input type="checkbox" checked={mirror} onChange={(event) => setMirror(event.target.checked)} /> Mirror left and right</label>
      {groups.map((group) => <details key={group.title}><summary>{group.title}</summary>
        {group.bones.filter(available).map((bone) => <div key={bone} className="pose-bone"><strong>{bone}</strong>
          {axes.map(({ axis, label }) => { const value = pose.getTarget(bone, axis); return <label className="slider-control" key={axis}><span>{label}<output>{value.toFixed(2)}</output></span><input aria-label={`${bone} ${label}`} type="range" min="-3.14" max="3.14" step="0.01" value={value} onChange={(event) => setValue(bone, axis, Number(event.target.value))} /></label>; })}
        </div>)}
      </details>)}
      <details><summary>Body position</summary>
        <label className="slider-control"><span>Height<output>{root.y.toFixed(2)}</output></span><input aria-label="Body height" type="range" min="-0.9" max="0.3" step="0.01" value={root.y} onChange={(event) => setRoot("y", Number(event.target.value))} /></label>
        <label className="slider-control"><span>Shift sideways<output>{root.x.toFixed(2)}</output></span><input aria-label="Body shift" type="range" min="-0.5" max="0.5" step="0.01" value={root.x} onChange={(event) => setRoot("x", Number(event.target.value))} /></label>
      </details>
      <div className="preset-row"><input aria-label="Custom pose name" className="pose-name" placeholder="Name this pose" maxLength={40} value={name} onChange={(event) => setName(event.target.value)} /><button onClick={save}>Save</button><button onClick={() => void copy()}>Copy JSON</button></div>
      {Object.keys(saved).length > 0 && <div className="pose-saved">{Object.keys(saved).map((key) => <span key={key} className="pose-saved-item"><button onClick={() => load(key)}>{key}</button><button aria-label={`Delete ${key}`} onClick={() => remove(key)}>×</button></span>)}</div>}
      {note && <p className="muted" role="status">{note}</p>}
    </details>
  </section>;
}
