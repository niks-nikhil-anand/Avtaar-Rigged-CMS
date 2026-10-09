"use client";
import Image from "next/image";
import Link from "next/link";
import { Component, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useProgress } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { PerspectiveCamera } from "three";
import { modelProfile } from "@/avatar/model/modelProfile";
import type { ModelReport } from "@/avatar/types";
import Avatar, { type AvatarReady } from "./Avatar";
import SceneBackdrop from "./SceneBackdrop";
import { applyAvatarState, captureAvatarState, clearSavedState, loadSavedState, saveState, type AvatarState } from "@/avatar/state/avatarState";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowRightIcon, SaveIcon } from "@/components/ui/icons";
import { sceneThemes, findTheme, defaultThemeId, themeStorageKey, customStorageKey, customThemeId, parseCustomTheme, cloneTheme, type SceneTheme } from "./sceneThemes";
import AvatarDebugPanel, { type BlendDemoControls } from "./AvatarDebugPanel";
import DebugMetricsOverlay from "./DebugMetricsOverlay";
import type { PlaybackFrame } from "@/services/audio/PcmPlayer";

class ViewerBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() {
    if (this.state.error) return <div className="viewer-error" role="alert"><h2>Unable to open the 3D viewer</h2><p>Check that the avatar model is available and your browser supports WebGL 2 with hardware acceleration.</p><pre>{this.state.error}</pre><button onClick={() => window.location.reload()}>Retry viewer</button></div>;
    return this.props.children;
  }
}
function ThemePicker({ themeId, label, onChange }: { themeId: string; label: string; onChange: (id: string) => void }) {
  return <div className="theme-picker" role="group" aria-label="Scene background">
    {sceneThemes.map((item) => <button key={item.id} type="button" title={item.label} aria-label={`${item.label} background`} aria-pressed={item.id === themeId} onClick={() => onChange(item.id)} style={{ background: `linear-gradient(180deg, ${item.top}, ${item.horizon})` }} />)}
    <span>{label}</span>
  </div>;
}
function LoadingOverlay({ ready }: { ready: boolean }) {
  const { progress, errors } = useProgress();
  if (ready && errors.length === 0) return null;
  return <div className="loading-overlay" role="status"><span className="loading-dot" /><strong>{errors.length ? "Could not load the avatar model" : "Preparing your avatar"}</strong><span>{errors.length ? "Check the asset and reload the viewer." : `${Math.round(progress)}% · Loading model and materials`}</span></div>;
}
function CameraRig({ revision, closeUp, report }: { revision: number; closeUp: boolean; report: ModelReport | null }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const aspect = size.width / Math.max(size.height, 1);
    const height = modelProfile.displayHeight;
    const width = report ? report.bounds[0] * height / report.bounds[1] : height;
    const halfFov = Math.tan(camera.fov * Math.PI / 360);
    const bodyDistance = Math.max(height / (2 * halfFov), width / (2 * halfFov * aspect)) * 1.15;
    const distance = closeUp ? Math.max(1.5, 1.0 / aspect) : bodyDistance;
    const targetY = closeUp ? 2.45 : 1.45;
    camera.position.set(0, targetY + (closeUp ? 0 : 0.2), distance);
    camera.lookAt(0, targetY, 0);
    camera.updateProjectionMatrix();
    controls.current?.target.set(0, targetY, 0);
    controls.current?.update();
    invalidate();
  }, [camera, size.width, size.height, revision, closeUp, report, invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={0.85} maxDistance={12} minPolarAngle={0.45} maxPolarAngle={Math.PI / 2 + 0.1} />;
}
export default function AvatarScene({ variant = "studio", onModelReady, sidebar, playback }: { variant?: "studio" | "connected"; onModelReady?: (model: AvatarReady | null) => void; sidebar?: ReactNode; playback?: PlaybackFrame }) {
  const studio = variant === "studio";
  const [model, setModel] = useState<AvatarReady | null>(null);
  const [debug, setDebug] = useState(true);
  // This scene is client-only (ssr: false), so stored values can seed the initial state.
  const [initial] = useState<AvatarState | null>(() => loadSavedState());
  const savedRef = useRef<AvatarState | null>(initial);
  const [savedInfo, setSavedInfo] = useState<{ savedAt: string | null; error: string }>({ savedAt: initial?.savedAt ?? null, error: "" });
  const [closeUp, setCloseUp] = useState(initial?.camera.closeUp ?? false);
  const [revision, setRevision] = useState(0);
  const [demo, setDemo] = useState(false);
  // The Connected page shows only the saved look; the Studio falls back to its live choices when nothing is saved.
  const [themeId, setThemeId] = useState(() => {
    if (initial) return findTheme(initial.scene.themeId).id;
    if (!studio) return defaultThemeId;
    try { return findTheme(localStorage.getItem(themeStorageKey)).id; } catch { return defaultThemeId; }
  });
  const [custom, setCustom] = useState<SceneTheme | null>(() => {
    if (initial) return initial.scene.custom;
    if (!studio) return null;
    try { return parseCustomTheme(localStorage.getItem(customStorageKey)); } catch { return null; }
  });
  const theme = custom ?? findTheme(themeId);
  const saveCustom = (value: SceneTheme | null) => {
    setCustom(value);
    if (!studio) return;
    try { if (value) localStorage.setItem(customStorageKey, JSON.stringify(value)); else localStorage.removeItem(customStorageKey); } catch { /* optional persistence */ }
  };
  // The quick toggle picks a preset and drops any custom edits; the Lighting tab edits a copy of whatever is showing.
  const chooseTheme = (id: string) => { setThemeId(id); saveCustom(null); try { localStorage.setItem(themeStorageKey, id); } catch { /* optional persistence */ } };
  const lighting = { theme, presetId: custom ? customThemeId : themeId, choosePreset: chooseTheme, edit: (change: (draft: SceneTheme) => void) => { const draft = cloneTheme(theme); change(draft); saveCustom({ ...draft, id: customThemeId, label: "Custom" }); }, resetToPreset: () => saveCustom(null) };

  const save = () => {
    if (!model) return;
    const state = captureAvatarState(model.engine, { scene: { themeId, custom }, closeUp });
    const error = saveState(state);
    if (!error) savedRef.current = state;
    setSavedInfo((previous) => ({ savedAt: error ? previous.savedAt : state.savedAt, error: error ?? "" }));
  };
  const clearSaved = () => { clearSavedState(); savedRef.current = null; setSavedInfo({ savedAt: null, error: "" }); };
  const saveControls = { onSave: save, onClear: clearSaved, savedAt: savedInfo.savedAt, error: savedInfo.error };

  const demoRef = useRef<BlendDemoControls>(null);
  const onReady = useCallback((next: AvatarReady | null) => {
    // Apply the saved look before anything renders from the engine, so panels read the restored values.
    if (next && savedRef.current) applyAvatarState(next.engine, savedRef.current, variant);
    setModel(next); onModelReady?.(next);
  }, [onModelReady, variant]);
  const cameraControls = <><button disabled={!model} aria-pressed={closeUp} onClick={() => setCloseUp((value) => !value)}>{closeUp ? "Full body" : "Face view"}</button><button disabled={!model} onClick={() => setRevision((value) => value + 1)}>Reset camera</button></>;
  return <div className="avatar-workspace">
    <header className="workspace-header">
      <div className="brand"><Image className="brand-mark" src="/logo-mark.png" alt="" width={40} height={40} unoptimized priority /><div><h1>Avatar Studio</h1><p className="muted">{studio ? "Pose, express and preview your rigged avatar" : "Live conversation with your avatar"}</p></div></div>
      <div className="header-actions"><ThemeToggle />{studio ? <Link className="connect-avatar-button" href="/avtaar-connected">Connect avatar<ArrowRightIcon /></Link> : <Link className="back-link" href="/">Back to studio</Link>}</div>
    </header>
    <div className={`workspace-grid ${studio && !debug ? "panel-hidden" : ""}`}>
      <section className="viewer-section" aria-label="Interactive avatar viewer">
        <div className="viewer-toolbar"><span className="asset-label"><span className={`status-dot ${model ? "ready" : ""}`} />{model ? `${modelProfile.url.slice(1)} · Ready` : `${modelProfile.url.slice(1)} · Loading`}</span><div>{studio && <><button className="demo-button" disabled={!model} aria-pressed={demo} onClick={() => demoRef.current?.toggleDemo()}>{demo ? "Stop blend demo" : "Run blend demo"}</button><button className="save-button" disabled={!model} onClick={save} title="Save pose, face, behavior, lighting and camera so /avtaar-connected shows the same look"><SaveIcon />Save look</button></>}{cameraControls}{studio && <button aria-expanded={debug} onClick={() => setDebug((value) => !value)}>{debug ? "Hide panel" : "Show panel"}</button>}</div></div>
        <div className="canvas-shell" style={{ background: theme.horizon }}>{studio && <ThemePicker themeId={custom ? customThemeId : themeId} label={theme.label} onChange={chooseTheme} />}<DebugMetricsOverlay model={model} playback={playback} /><ViewerBoundary>
          <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 1.65, 5], fov: 38, near: 0.01, far: 100 }} gl={{ antialias: true }} fallback={<div className="viewer-error" role="alert">WebGL is unavailable. Enable hardware acceleration or use a supported browser.</div>}>
            <color attach="background" args={[theme.horizon]} /><fog attach="fog" args={[theme.horizon, 12, 28]} />
            <SceneBackdrop theme={theme} />
            <ambientLight intensity={theme.ambient} /><hemisphereLight args={[theme.hemi.sky, theme.hemi.ground, theme.hemi.intensity]} />
            <directionalLight position={theme.key.position} color={theme.key.color} intensity={theme.key.intensity} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={5} shadow-camera-bottom={-4} shadow-bias={-0.0003} shadow-normalBias={0.03} />
            <directionalLight position={theme.rim.position} intensity={theme.rim.intensity} color={theme.rim.color} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color={theme.floor} roughness={1} /></mesh>
            <Suspense fallback={null}><Avatar onReady={onReady} /></Suspense>
            <CameraRig revision={revision} closeUp={closeUp} report={model?.report ?? null} />
          </Canvas>
          <LoadingOverlay ready={!!model} />
        </ViewerBoundary></div>
        <footer className="viewer-footer"><span>Drag to orbit · Scroll or pinch to zoom</span><span>{studio ? "Local GLB · No audio connected" : "Local GLB"}</span></footer>
      </section>
      <div className="sidebar-slot" hidden={studio && !debug}>{studio ? <AvatarDebugPanel model={model} demoRef={demoRef} onDemoChange={setDemo} lighting={lighting} save={saveControls} /> : sidebar}</div>
    </div>
  </div>;
}
