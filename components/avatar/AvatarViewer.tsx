"use client";
import dynamic from "next/dynamic";
import type { AvatarReady } from "./Avatar";
const AvatarScene = dynamic(() => import("./AvatarScene"), { ssr: false, loading: () => <div className="boot-message" role="status">Opening avatar studio…</div> });
export default function AvatarViewer({ avatarOnly = false, closeUp, onModelReady }: { avatarOnly?: boolean; closeUp?: boolean; onModelReady?: (model: AvatarReady | null) => void }) { return <AvatarScene avatarOnly={avatarOnly} closeUp={closeUp} onModelReady={onModelReady} />; }
