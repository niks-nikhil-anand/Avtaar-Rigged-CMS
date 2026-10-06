"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Box3, Mesh, Vector3, type Group } from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { inspectModel } from "@/avatar/model/inspectModel";
import { resolveBindings } from "@/avatar/model/resolveBindings";
import { modelProfile } from "@/avatar/model/modelProfile";
import type { ModelBindings, ModelReport } from "@/avatar/types";
import { AvatarEngine } from "@/avatar/engine/AvatarEngine";

export interface AvatarReady { bindings: ModelBindings; report: ModelReport; engine: AvatarEngine }

export default function Avatar({ onReady }: { onReady: (model: AvatarReady | null) => void }) {
  const gltf = useGLTF(modelProfile.url);
  const engineRef = useRef<AvatarEngine | null>(null);
  const groupRef = useRef<Group>(null);
  const model = useMemo(() => {
    const root = clone(gltf.scene);
    root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(root);
    const size = bounds.getSize(new Vector3());
    if (!Number.isFinite(size.y) || size.y <= 0) throw new Error("The model has invalid bounds.");
    const center = bounds.getCenter(new Vector3());
    const scale = modelProfile.displayHeight / size.y;
    root.traverse((node) => {
      if (node instanceof Mesh) {
        // Culling bounds stay at the bind pose, so a lowered or posed body would be culled while still on screen.
        node.frustumCulled = false;
        node.castShadow = true;
        node.receiveShadow = true;
        // This export has no alpha on the eye-occlusion and tear-line shells, so they render as opaque white over the eyes.
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          if (/^Std_(Eye_Occlusion|Tearline)_[LR]$/.test(material.name)) material.visible = false;
        }
      }
    });
    return { root, scale, offset: [-center.x * scale, -bounds.min.y * scale, -center.z * scale] as [number, number, number], bindings: resolveBindings(root), report: inspectModel(root, gltf.animations) };
  }, [gltf]);
  useEffect(() => {
    // Create a fresh lifecycle instance on effect setup, including Strict Mode remounts.
    const engine = new AvatarEngine(model.bindings);
    engineRef.current = engine;
    engine.start();
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => { engine.behavior.setReducedMotion(motionPreference.matches); };
    syncMotion();
    motionPreference.addEventListener("change", syncMotion);
    engine.behavior.enable();
    onReady({ bindings: model.bindings, report: model.report, engine });
    return () => { motionPreference.removeEventListener("change", syncMotion); engine.dispose(); engineRef.current = null; onReady(null); };
  }, [model, onReady]);
  useFrame((_, delta) => {
    const engine = engineRef.current;
    engine?.update(delta);
    // The pose shifts the body (squat, weight shift) so feet stay planted; root units are model metres.
    if (engine && groupRef.current) {
      groupRef.current.position.set(model.offset[0] + engine.pose.rootOffset.x * model.scale, model.offset[1] + engine.pose.rootOffset.y * model.scale, model.offset[2]);
    }
  });
  // Geometry/materials are shared with the loader cache; preserve them on clone teardown.
  return <group ref={groupRef} position={model.offset} scale={model.scale}><primitive object={model.root} dispose={null} /></group>;
}
