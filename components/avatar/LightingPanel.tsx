"use client";
import type { ReactNode } from "react";
import { sceneThemes, toAngles, fromAngles, customThemeId, defaultBody, type SceneTheme } from "./sceneThemes";

export interface LightingControls {
  theme: SceneTheme;
  presetId: string;
  choosePreset: (id: string) => void;
  edit: (change: (draft: SceneTheme) => void) => void;
  resetToPreset: () => void;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="color-field"><span>{label}</span><span className="color-value"><output>{value}</output><input type="color" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} /></span></label>;
}
function Range({ label, value, min, max, step = 0.05, unit = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  return <label className="slider-control"><span>{label}<output>{step >= 1 ? Math.round(value) : value.toFixed(2)}{unit}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
function Group({ title, open = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  return <details open={open}><summary>{title}</summary>{children}</details>;
}

type LightKey = "key" | "rim";

export default function LightingPanel({ lighting }: { lighting: LightingControls }) {
  const { theme, presetId, choosePreset, edit, resetToPreset } = lighting;
  const isCustom = presetId === customThemeId;
  const light = (name: LightKey, title: string) => {
    const value = theme[name];
    const angles = toAngles(value.position);
    const move = (azimuth: number, elevation: number) => edit((draft) => { draft[name].position = fromAngles(azimuth, elevation, angles.distance); });
    return <Group title={title}>
      <ColorField label={`${title} color`} value={value.color} onChange={(color) => edit((draft) => { draft[name].color = color; })} />
      <Range label={`${title} intensity`} value={value.intensity} min={0} max={6} onChange={(intensity) => edit((draft) => { draft[name].intensity = intensity; })} />
      <Range label={`${title} direction`} value={angles.azimuth} min={-180} max={180} step={1} unit="°" onChange={(azimuth) => move(azimuth, angles.elevation)} />
      <Range label={`${title} height`} value={angles.elevation} min={-10} max={85} step={1} unit="°" onChange={(elevation) => move(angles.azimuth, elevation)} />
    </Group>;
  };
  const body = theme.body;
  return <section className="tab-section lighting-panel" data-tab="lighting">
    <p className="muted" role="status">Current setup: <strong>{theme.label}</strong>{isCustom ? " (edited)" : ""}. Pick a preset, then adjust anything below.</p>
    <div className="preset-row">{sceneThemes.map((item) => <button key={item.id} aria-pressed={presetId === item.id} onClick={() => choosePreset(item.id)}><span className="swatch" style={{ background: `linear-gradient(180deg, ${item.top}, ${item.horizon})` }} />{item.label}</button>)}</div>
    {isCustom && <div className="preset-row"><button onClick={resetToPreset} title="Discard custom edits and go back to the last preset">Reset custom lighting</button></div>}

    <Group title="Background" open>
      <ColorField label="Sky top" value={theme.top} onChange={(top) => edit((draft) => { draft.top = top; })} />
      <ColorField label="Horizon and fog" value={theme.horizon} onChange={(horizon) => edit((draft) => { draft.horizon = horizon; })} />
      <ColorField label="Floor" value={theme.floor} onChange={(floor) => edit((draft) => { draft.floor = floor; })} />
      <Range label="Stars" value={theme.stars ?? 0} min={0} max={4000} step={50} onChange={(stars) => edit((draft) => { draft.stars = stars || undefined; })} />
      <label className="motion-control"><input type="checkbox" checked={!!body} onChange={(event) => edit((draft) => { draft.body = event.target.checked ? { ...defaultBody } : undefined; })} /> Moon or sun</label>
      {body && <>
        <ColorField label="Disc color" value={body.color} onChange={(color) => edit((draft) => { if (draft.body) draft.body.color = color; })} />
        <ColorField label="Glow color" value={body.glow} onChange={(glow) => edit((draft) => { if (draft.body) draft.body.glow = glow; })} />
        <Range label="Disc size" value={body.size} min={1} max={9} onChange={(size) => edit((draft) => { if (draft.body) { draft.body.size = size; draft.body.glowSize = size * 8; } })} />
        <Range label="Disc side" value={body.position[0]} min={-30} max={30} step={0.5} onChange={(x) => edit((draft) => { if (draft.body) draft.body.position[0] = x; })} />
        <Range label="Disc height" value={body.position[1]} min={-2} max={25} step={0.5} onChange={(y) => edit((draft) => { if (draft.body) draft.body.position[1] = y; })} />
      </>}
    </Group>

    {light("key", "Key light")}
    {light("rim", "Rim light")}

    <Group title="Ambient and sky bounce">
      <Range label="Ambient light" value={theme.ambient} min={0} max={2} onChange={(ambient) => edit((draft) => { draft.ambient = ambient; })} />
      <Range label="Sky bounce intensity" value={theme.hemi.intensity} min={0} max={3} onChange={(intensity) => edit((draft) => { draft.hemi.intensity = intensity; })} />
      <ColorField label="Sky bounce color" value={theme.hemi.sky} onChange={(sky) => edit((draft) => { draft.hemi.sky = sky; })} />
      <ColorField label="Ground bounce color" value={theme.hemi.ground} onChange={(ground) => edit((draft) => { draft.hemi.ground = ground; })} />
    </Group>
  </section>;
}
