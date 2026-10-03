"use client";
import { useState } from "react";
import type { AvatarEngine } from "@/avatar/engine/AvatarEngine";
import { behaviorStates, emotions, visemes, type BehaviorState, type Emotion, type Viseme } from "@/avatar/engine/behaviorConfig";

export default function AvatarBehaviorPanel({ engine, onReturnToIdle, onActivate }: { engine: AvatarEngine; onReturnToIdle: () => void; onActivate: () => void }) {
  const behavior = engine.behavior;
  const [enabled, setEnabled] = useState(behavior.enabled);
  const [state, setState] = useState<BehaviorState>(behavior.state);
  const [emotion, setEmotion] = useState<Emotion>(behavior.emotion.emotion);
  const [intensity, setIntensity] = useState(behavior.emotion.intensity);
  const [amplitude, setAmplitude] = useState(0);
  const [viseme, setViseme] = useState<Viseme | "">("");
  const [reduced, setReduced] = useState(behavior.reducedMotion);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const activate = () => {
    onActivate(); engine.start(); behavior.enable(); setEnabled(true);
    engine.resetExpression("debug:morph");
    for (const bone of ["Head", "Neck", "LeftEye", "RightEye"]) engine.removeLayer(`debug:bone:${bone}`);
  };
  const chooseState = (next: BehaviorState) => {
    activate(); behavior.setState(next); setState(next);
    behavior.lips.clearVisemes(); setViseme("");
    const level = next === "speaking" ? 0.65 : 0;
    behavior.lips.setAmplitude(level); setAmplitude(level);
  };
  const chooseViseme = (next: Viseme | "") => {
    activate(); behavior.setState("speaking"); setState("speaking");
    behavior.lips.setAmplitude(0); setAmplitude(0);
    behavior.lips.clearVisemes(); setViseme(next);
    if (next) behavior.lips.setViseme(next, 0.85);
  };
  return <details open className="behavior-panel"><summary>Behavior action buttons</summary>
    <div className="preset-row behavior-actions"><button aria-pressed={enabled} onClick={() => {
      if (enabled) { behavior.disable(); setAmplitude(0); setViseme(""); } else { behavior.enable(); engine.start(); onActivate(); }
      setEnabled(!enabled);
    }}>{enabled ? "Disable natural behavior" : "Enable natural behavior"}</button><button onClick={onReturnToIdle}>Return to idle</button></div>
    <p className="muted" role="status">{enabled ? `${state} · ${emotion}` : "Natural behavior off"}. Click an action to preview it. Mouth previews are silent.</p>
    <p className="action-label">Movement & attention</p>
    <div className="preset-row">{behaviorStates.map((name) => <button key={name} aria-pressed={state === name && enabled} onClick={() => {
      chooseState(name);
    }}>{name[0].toUpperCase() + name.slice(1)}</button>)}</div>
    <p className="action-label">Expressions</p>
    <div className="preset-row">{emotions.map((name) => <button key={name} aria-pressed={emotion === name && enabled} onClick={() => {
      activate(); setEmotion(name); behavior.setEmotion(name, intensity);
    }}>{name === "thinking" ? "Thinking expression" : name[0].toUpperCase() + name.slice(1)}</button>)}</div>
    <label className="slider-control"><span>Emotion intensity<output>{intensity.toFixed(2)}</output></span><input aria-label="Emotion intensity" type="range" min="0" max="1" step="0.01" value={intensity} onChange={(event) => {
      const next = Number(event.target.value); setIntensity(next); behavior.setEmotion(emotion, next);
    }} /></label>
    <p className="action-label">Mouth opening</p>
    <div className="preset-row">{[{ label: "Close mouth", value: 0 }, { label: "Small opening", value: 0.3 }, { label: "Medium opening", value: 0.65 }, { label: "Wide opening", value: 1 }].map(({ label, value }) => <button key={label} aria-pressed={enabled && state === "speaking" && viseme === "" && amplitude === value} onClick={() => {
      chooseState("speaking"); behavior.lips.setAmplitude(value); setAmplitude(value);
    }}>{label}</button>)}</div>
    <label className="slider-control"><span>Synthetic speech amplitude<output>{amplitude.toFixed(2)}</output></span><input aria-label="Synthetic speech amplitude" disabled={!enabled || state !== "speaking"} type="range" min="0" max="1" step="0.01" value={amplitude} onChange={(event) => {
      const next = Number(event.target.value); setAmplitude(next); behavior.lips.setAmplitude(next);
    }} /></label>
    <p className="action-label">Speech shapes (visemes)</p>
    <div className="preset-row viseme-actions">{visemes.map((name) => <button key={name} aria-label={`Viseme ${name}`} aria-pressed={enabled && viseme === name} onClick={() => chooseViseme(name)}>{name}</button>)}<button onClick={() => chooseViseme("")}>Clear speech shape</button></div>
    <label className="motion-control"><input type="checkbox" checked={reduced} onChange={(event) => { setReduced(event.target.checked); behavior.setReducedMotion(event.target.checked); }} /> Reduced motion</label>
    <p className="action-label">Eye direction</p>
    <div className="preset-row">{[{ label: "Look left", x: -1, y: 0 }, { label: "Look right", x: 1, y: 0 }, { label: "Look up", x: 0, y: 1 }, { label: "Look down", x: 0, y: -1 }, { label: "Look center", x: 0, y: 0 }].map(({ label, x, y }) => <button key={label} onClick={() => {
      activate(); setGaze({ x, y }); behavior.setLookAt(x, y);
    }}>{label}</button>)}<button onClick={() => { behavior.releaseLookAt(); setGaze({ x: 0, y: 0 }); }}>Release gaze</button></div>
    <details><summary>Fine gaze adjustment</summary>{(["x", "y"] as const).map((axis) => <label className="slider-control" key={axis}><span>Gaze {axis}<output>{gaze[axis].toFixed(2)}</output></span><input aria-label={`Gaze ${axis}`} type="range" min="-1" max="1" step="0.01" value={gaze[axis]} onChange={(event) => {
      const next = { ...gaze, [axis]: Number(event.target.value) }; setGaze(next); behavior.setLookAt(next.x, next.y);
    }} /></label>)}</details>
  </details>;
}
