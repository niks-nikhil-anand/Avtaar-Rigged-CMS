"use client";
import Link from "next/link";
import { Component, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useProgress } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { PerspectiveCamera } from "three";
import { modelProfile } from "@/avatar/model/modelProfile";
import type { ModelReport } from "@/avatar/types";
import Avatar, { type AvatarReady } from "./Avatar";
import AvatarDebugPanel, { type BlendDemoControls } from "./AvatarDebugPanel";

class ViewerBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() {
    if (this.state.error) return <div className="viewer-error" role="alert"><h2>Unable to open the 3D viewer</h2><p>Check that the avatar model is available and your browser supports WebGL 2 with hardware acceleration.</p><pre>{this.state.error}</pre><button onClick={() => window.location.reload()}>Retry viewer</button></div>;
    return this.props.children;
  }
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
export default function AvatarScene({ avatarOnly = false, closeUp: closeUpProp, onModelReady }: { avatarOnly?: boolean; closeUp?: boolean; onModelReady?: (model: AvatarReady | null) => void }) {
  const [model, setModel] = useState<AvatarReady | null>(null);
  const [debug, setDebug] = useState(true);
  const [closeUpState, setCloseUp] = useState(false);
  const closeUp = closeUpProp ?? closeUpState;
  const [revision, setRevision] = useState(0);
  const [demo, setDemo] = useState(false);
  const demoRef = useRef<BlendDemoControls>(null);
  const onReady = useCallback((next: AvatarReady | null) => { setModel(next); onModelReady?.(next); }, [onModelReady]);
  return <div className={avatarOnly ? "avatar-workspace avatar-only" : "avatar-workspace"}>
    {!avatarOnly && <>
    <header className="workspace-header"><div><p className="eyebrow">AVATAR STUDIO / PHASE 03</p><h1>A space for your avatar.</h1><p className="muted">Natural movement, expressive reactions, and a relaxed presence.</p></div><Link className="connect-avatar-button" href="/avtaar-connected">Connect avatar</Link></header>
    </>}
    <div className={`workspace-grid ${debug && !avatarOnly ? "" : "panel-hidden"}`}>
      <section className="viewer-section" aria-label="Interactive avatar viewer">
        {!avatarOnly && <>
        <div className="viewer-toolbar"><span className="asset-label"><span className={`status-dot ${model ? "ready" : ""}`} />{model ? `${modelProfile.url.slice(1)} · Ready` : `${modelProfile.url.slice(1)} · Loading`}</span><div><button className="demo-button" disabled={!model} aria-pressed={demo} onClick={() => demoRef.current?.toggleDemo()}>{demo ? "Stop blend demo" : "Run blend demo"}</button><button onClick={() => setCloseUp((value) => !value)}>{closeUp ? "Full body" : "Face view"}</button><button onClick={() => setRevision((value) => value + 1)}>Reset camera</button><button aria-expanded={debug} onClick={() => setDebug((value) => !value)}>{debug ? "Hide controls" : "Show controls"}</button></div></div>
        </>}
        <div className="canvas-shell"><ViewerBoundary>
          <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 1.65, 5], fov: 38, near: 0.01, far: 100 }} gl={{ antialias: true }} fallback={<div className="viewer-error" role="alert">WebGL is unavailable. Enable hardware acceleration or use a supported browser.</div>}>
            <color attach="background" args={["#e9edea"]} /><fog attach="fog" args={["#e9edea", 12, 28]} />
            <ambientLight intensity={0.7} /><hemisphereLight args={["#ffffff", "#b3bba6", 1.6]} />
            <directionalLight position={[4, 6, 5]} intensity={2.8} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={5} shadow-camera-bottom={-4} shadow-bias={-0.0003} shadow-normalBias={0.03} />
            <directionalLight position={[-4, 3, -3]} intensity={1.8} color="#dbe6ff" />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#e0e5df" roughness={1} /></mesh>
            <Suspense fallback={null}><Avatar onReady={onReady} /></Suspense>
            <CameraRig revision={revision} closeUp={closeUp} report={model?.report ?? null} />
          </Canvas>
          <LoadingOverlay ready={!!model} />
        </ViewerBoundary></div>
        {!avatarOnly && <footer className="viewer-footer"><span>Drag to orbit · Scroll or pinch to zoom</span><span>Local GLB · No audio connected</span></footer>}
      </section>
      {!avatarOnly && <div hidden={!debug}><AvatarDebugPanel model={model} demoRef={demoRef} onDemoChange={setDemo} /></div>}
    </div>
  </div>;
}
