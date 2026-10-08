"use client";
import { useCallback } from "react";
import { useAvatarConversation } from "@/hooks/useAvatarConversation";
import { loadSavedState } from "@/avatar/state/avatarState";
import AvatarViewer from "./AvatarViewer";
import GeminiPanel from "./GeminiPanel";
import type { AvatarReady } from "./Avatar";

/** The conversation page: shows the avatar exactly as saved in the Studio, with the Gemini connection in the sidebar. */
export default function ConnectedAvatar() {
  const conversation = useAvatarConversation();
  const { onModelReady, setBaselineEmotion } = conversation;
  // Must stay referentially stable: the avatar rebuilds its engine whenever this callback changes.
  const handleModelReady = useCallback((model: AvatarReady | null) => {
    onModelReady(model);
    const saved = model ? loadSavedState() : null;
    // The saved expression is what the avatar returns to between and after conversations.
    if (saved) setBaselineEmotion(saved.face.emotion, saved.face.intensity);
  }, [onModelReady, setBaselineEmotion]);
  return <AvatarViewer variant="connected" onModelReady={handleModelReady} playback={conversation.playback} sidebar={<GeminiPanel conversation={conversation} />} />;
}
