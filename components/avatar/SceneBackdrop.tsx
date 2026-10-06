"use client";
import { useEffect, useMemo } from "react";
import { AdditiveBlending, BackSide, BufferAttribute, CanvasTexture, Color, ShaderMaterial, SRGBColorSpace } from "three";
import type { SceneTheme } from "./sceneThemes";

const vertex = "varying float vY; void main() { vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const fragment = `
uniform vec3 top;
uniform vec3 horizon;
varying float vY;
void main() {
  float t = smoothstep(-0.05, 0.75, vY);
  gl_FragColor = vec4(mix(horizon, top, t), 1.0);
  #include <colorspace_fragment>
}`;

function moonTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ece7d2"; context.fillRect(0, 0, 256, 256);
  let seed = 7;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 70; i++) {
    const x = random() * 256, y = random() * 256, r = 4 + random() * 22;
    const gradient = context.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, `rgba(120,115,100,${0.1 + random() * 0.18})`); gradient.addColorStop(1, "rgba(120,115,100,0)");
    context.fillStyle = gradient; context.beginPath(); context.arc(x, y, r, 0, Math.PI * 2); context.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function starPositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  let seed = 12345;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < count; i++) {
    // Upper hemisphere only, so stars never appear below the horizon.
    const theta = random() * Math.PI * 2, y = 0.04 + random() * 0.96, radius = Math.sqrt(1 - y * y) * 60;
    positions.set([Math.cos(theta) * radius, y * 60, Math.sin(theta) * radius], i * 3);
  }
  return positions;
}

function glowTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)"); gradient.addColorStop(0.25, "rgba(255,255,255,0.45)"); gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  return new CanvasTexture(canvas);
}

/** Sky gradient, stars, and a moon or sun disc. Everything ignores fog and depth so it always sits behind the avatar. */
export default function SceneBackdrop({ theme }: { theme: SceneTheme }) {
  const material = useMemo(() => new ShaderMaterial({
    uniforms: { top: { value: new Color() }, horizon: { value: new Color() } },
    vertexShader: vertex, fragmentShader: fragment, side: BackSide, depthWrite: false, fog: false,
  }), []);
  const glow = useMemo(() => glowTexture(), []);
  const moon = useMemo(() => moonTexture(), []);
  const stars = useMemo(() => (theme.stars ? new BufferAttribute(starPositions(theme.stars), 3) : null), [theme.stars]);
  useEffect(() => { material.uniforms.top.value.set(theme.top); material.uniforms.horizon.value.set(theme.horizon); }, [material, theme.top, theme.horizon]);
  useEffect(() => () => { material.dispose(); glow.dispose(); moon.dispose(); }, [material, glow, moon]);
  const body = theme.body;
  return <>
    <mesh renderOrder={-3} material={material}><sphereGeometry args={[70, 32, 16]} /></mesh>
    {stars && <points renderOrder={-2} frustumCulled={false}><bufferGeometry><primitive object={stars} attach="attributes-position" /></bufferGeometry><pointsMaterial color="#ffffff" size={2.2} sizeAttenuation={false} transparent opacity={0.9} fog={false} depthWrite={false} toneMapped={false} /></points>}
    {body && <group position={body.position}>
      <sprite scale={[body.glowSize, body.glowSize, 1]} renderOrder={-2}><spriteMaterial map={glow} color={body.glow} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} fog={false} /></sprite>
      <mesh renderOrder={-1}><sphereGeometry args={[body.size, 48, 24]} /><meshBasicMaterial color={body.color} map={body.craters ? moon : null} fog={false} depthWrite={false} toneMapped={false} /></mesh>
    </group>}
  </>;
}
