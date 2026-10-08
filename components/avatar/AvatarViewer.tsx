"use client";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import type { AvatarReady } from "./Avatar";
import type { PlaybackFrame } from "@/services/audio/PcmPlayer";
const AvatarScene = dynamic(() => import("./AvatarScene"), { ssr: false, loading: () => <div className="boot-message" role="status">Opening avatar studio…</div> });
export default function AvatarViewer({ variant = "studio", onModelReady, sidebar, playback }: { variant?: "studio" | "connected"; onModelReady?: (model: AvatarReady | null) => void; sidebar?: ReactNode; playback?: PlaybackFrame }) { return <AvatarScene variant={variant} onModelReady={onModelReady} sidebar={sidebar} playback={playback} />; }
