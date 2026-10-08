"use client";
import { ConversationCoordinator } from "@/avatar/conversation/ConversationCoordinator";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Emotion } from "@/avatar/engine/behaviorConfig";
import type { BehaviorState } from "@/avatar/engine/behaviorConfig";
import { MicrophoneCapture } from "@/services/audio/MicrophoneCapture";
import { PcmPlayer, type PlaybackFrame } from "@/services/audio/PcmPlayer";
import { encodePcm16, OUTPUT_SAMPLE_RATE } from "@/services/audio/pcm";
import { GeminiLiveClient, type ConnectionState } from "@/services/gemini/GeminiLiveClient";

import type { AvatarReady } from "@/components/avatar/Avatar";

interface Transcript { speaker: "user" | "avatar"; text: string; finished: boolean }
interface Resources {
  player: PcmPlayer; mic: MicrophoneCapture; live: GeminiLiveClient;
  connection: ConnectionState;
  active: boolean; operation: number;
  recording: boolean; recordingBytes: Uint8Array[];
  timer: ReturnType<typeof setInterval> | null;
  recordTimer: ReturnType<typeof setTimeout> | null;
}

export function useAvatarConversation() {
  const resources = useRef<Resources | null>(null);
  const [coordinator] = useState(() => new ConversationCoordinator());
  const [behaviorState, setBehaviorState] = useState<BehaviorState>("idle");
  const [emotion, setEmotionState] = useState<Emotion>("neutral");
  const [ready, setReady] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("disconnected");
  const [micOn, setMicOn] = useState(false);
  const [micPending, setMicPending] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [playback, setPlayback] = useState<PlaybackFrame>({ playing: false, amplitude: 0, queuedSeconds: 0 });
  const [recording, setRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [device, setDevice] = useState("");
  const [syncOffsetMs, setSyncOffsetState] = useState(0);

  const syncAvatar = useCallback(() => { setBehaviorState(coordinator.state); }, [coordinator]);
  const onModelReady = useCallback((model: AvatarReady | null) => { coordinator.attach(model?.engine ?? null); setReady(!!model); syncAvatar(); }, [coordinator, syncAvatar]);

  useEffect(() => {
    let active = true;
    let lastFrame = 0;
    const mic = new MicrophoneCapture();
    const player = new PcmPlayer((frame) => {
      if (!active) return;
      coordinator.updatePlayback(frame); syncAvatar();
      if (!frame.playing || performance.now() - lastFrame > 100) { lastFrame = performance.now(); setPlayback(frame); }
    });
    const live = new GeminiLiveClient({
      onState: (next) => {
        if (!active || !resources.current) return;
        resources.current.connection = next; coordinator.setConnection(next); setConnection(next); setEmotionState(coordinator.emotion);
        if (next === "error" || next === "disconnected") { mic.stop(); setMicOn(false); }
        syncAvatar();
      },
      onError: (message) => { if (active) setError(message); },
      onAudio: (bytes, rate) => { if (active) player.enqueue(bytes, rate); },
      onInterrupted: () => { if (!active) return; coordinator.interrupt(); player.stop(); syncAvatar(); },
      onTurnComplete: () => { if (!active) return; coordinator.completeTurn(); syncAvatar(); },
      onUserActivity: (speaking) => { if (!active) return; coordinator.userActivity(speaking); syncAvatar(); },
      onTranscript: (speaker, message, finished) => {
        if (!active) return;
        if (speaker === "user" && finished) { coordinator.beginTurn(); syncAvatar(); }
        setTranscripts((current) => {
          const last = current.at(-1);
          if (last?.speaker === speaker && !last.finished) return [...current.slice(0, -1), { speaker, text: (last.text + message).slice(-8000), finished }];
          return [...current.slice(-19), { speaker, text: message.slice(-8000), finished }];
        });
      },
    });
    resources.current = { player, mic, live, connection: "disconnected", active: true, operation: 0, recording: false, recordingBytes: [], timer: null, recordTimer: null };
    const refreshDevices = () => { void navigator.mediaDevices?.enumerateDevices().then((items) => { if (active) setDevices(items.filter((item) => item.kind === "audioinput")); }).catch(() => {}); };
    refreshDevices(); navigator.mediaDevices?.addEventListener("devicechange", refreshDevices);
    return () => {
      active = false;
      const current = resources.current;
      if (current) { current.active = false; current.operation++; }
      if (current?.timer) clearInterval(current.timer);
      if (current?.recordTimer) clearTimeout(current.recordTimer);
      live.disconnect(); mic.stop(); coordinator.dispose(); void player.dispose().catch(() => {}); resources.current = null;
      navigator.mediaDevices?.removeEventListener("devicechange", refreshDevices);
    };
  }, [coordinator, syncAvatar]);

  const isCurrent = (value: Resources, operation = value.operation) => resources.current === value && value.active && value.operation === operation;
  const stopSample = () => { const value = resources.current; if (value?.timer) clearInterval(value.timer); if (value) value.timer = null; };
  const stopRecording = () => {
    const value = resources.current; if (!value) return;
    if (value.recordTimer) clearTimeout(value.recordTimer); value.recordTimer = null;
    value.recording = false; value.mic.stop(); setRecording(false); setMicOn(false); setMicPending(false);
    setHasRecording(value.recordingBytes.length > 0);
  };
  const disconnect = () => {
    const value = resources.current; if (!value) return;
    value.operation++;
    stopSample(); stopRecording(); value.live.disconnect(); void value.player.dispose().catch(() => {}); setMicPending(false);
  };
  const connect = async () => {
    const value = resources.current; if (!value) return;
    const operation = value.operation;
    setError(""); stopSample(); value.player.stop();
    try { await value.player.activate(); if (isCurrent(value, operation)) await value.live.connect(); }
    catch (cause) { if (isCurrent(value, operation)) setError(cause instanceof Error ? cause.message : "Unable to activate browser audio."); }
  };
  const toggleMicrophone = async () => {
    const value = resources.current; if (!value) return;
    const operation = value.operation;
    if (value.mic.active) { value.mic.stop(); value.live.endAudio(); setMicOn(false); return; }
    setError(""); setMicPending(true);
    try {
      await value.player.activate();
      if (!isCurrent(value, operation)) return;
      const started = await value.mic.start(value.player.audioContext, (bytes) => { if (value.live.connected) value.live.sendAudio(bytes); }, (message) => { setError(message); setMicOn(false); value.live.endAudio(); }, device || undefined);
      if (started && isCurrent(value, operation) && value.live.connected) { setMicOn(true); const items = await navigator.mediaDevices.enumerateDevices(); if (isCurrent(value, operation)) setDevices(items.filter((item) => item.kind === "audioinput")); }
      else value.mic.stop();
    } catch (cause) { if (isCurrent(value, operation)) setError(cause instanceof Error ? cause.message : "Could not start the microphone."); }
    finally { if (isCurrent(value, operation)) setMicPending(false); }
  };
  const sendText = async () => {
    const value = resources.current; if (!value || !text.trim()) return;
    const operation = value.operation;
    setError("");
    try {
      await value.player.activate(); if (!isCurrent(value, operation)) return; value.live.sendText(text);
      coordinator.beginTurn(); syncAvatar();
      setTranscripts((items) => [...items.slice(-19), { speaker: "user", text: text.trim(), finished: true }]); setText("");
    } catch (cause) { if (isCurrent(value, operation)) setError(cause instanceof Error ? cause.message : "Message could not be sent."); }
  };
  const testSpeaker = async () => {
    const value = resources.current; if (!value) return;
    const operation = value.operation;
    setError(""); stopSample(); value.player.stop();
    try {
      await value.player.activate();
      if (!isCurrent(value, operation)) return;
      let chunk = 0;
      const enqueue = () => {
        if (!isCurrent(value, operation)) return;
        const samples = Float32Array.from({ length: 2400 }, (_, i) => {
          const time = (chunk * 2400 + i) / OUTPUT_SAMPLE_RATE;
          const envelope = Math.min(1, time / 0.03, (2 - time) / 0.03);
          return Math.sin(time * 2 * Math.PI * 220) * 0.12 * Math.max(0, envelope);
        });
        value.player.enqueue(encodePcm16(samples));
        if (++chunk >= 20) stopSample();
      };
      enqueue(); value.timer = setInterval(enqueue, 70);
    } catch (cause) { if (isCurrent(value, operation)) { stopSample(); setError(cause instanceof Error ? cause.message : "Speaker test failed."); } }
  };
  const recordTest = async () => {
    const value = resources.current; if (!value) return;
    const operation = value.operation;
    if (value.recording) { stopRecording(); return; }
    setError(""); setMicPending(true); value.recordingBytes = []; setHasRecording(false);
    try {
      await value.player.activate();
      if (!isCurrent(value, operation)) return;
      const started = await value.mic.start(value.player.audioContext, (bytes) => { if (value.recording) value.recordingBytes.push(bytes); }, (message) => { setError(message); stopRecording(); }, device || undefined);
      if (started && isCurrent(value, operation)) { value.recording = true; setRecording(true); value.recordTimer = setTimeout(stopRecording, 10_000); const items = await navigator.mediaDevices.enumerateDevices(); if (isCurrent(value, operation)) setDevices(items.filter((item) => item.kind === "audioinput")); }
      else value.mic.stop();
    } catch (cause) { if (isCurrent(value, operation)) setError(cause instanceof Error ? cause.message : "Recording test failed."); }
    finally { if (isCurrent(value, operation)) setMicPending(false); }
  };
  const playRecording = async () => {
    const value = resources.current; if (!value) return;
    const operation = value.operation;
    setError(""); stopSample(); value.player.stop();
    try { await value.player.activate(); if (isCurrent(value, operation)) for (const bytes of value.recordingBytes) value.player.enqueue(bytes, 16_000); }
    catch (cause) { if (isCurrent(value, operation)) setError(cause instanceof Error ? cause.message : "Recording playback failed."); }
  };
  const busy = connection === "connecting" || connection === "reconnecting";
  const connected = connection === "connected";
  const stopAudio = () => { const value = resources.current; if (value) { value.operation++; if (micPending) value.mic.stop(); } setMicPending(false); stopSample(); value?.live.stopResponse(); coordinator.interrupt(); syncAvatar(); };
  const setSpeakerMuted = (next: boolean) => { setMuted(next); resources.current?.player.setMuted(next); };
  const setSyncOffset = (value: number) => { const safe = Math.max(0, Math.min(200, Number.isFinite(value) ? value : 0)); setSyncOffsetState(safe); resources.current?.player.setSyncOffsetMs(safe); };
  const setEmotion = (name: string, intensity = 0.7) => { setEmotionState(coordinator.setEmotion(name, intensity)); };
  /** Sets the expression the avatar returns to between and after sessions (the saved look). */
  const setBaselineEmotion = useCallback((name: string, intensity = 0.7) => { setEmotionState(coordinator.setBaseline(name, intensity)); }, [coordinator]);
  return { ready, connection, behaviorState, emotion, micOn, micPending, muted, error, text, setText, transcripts, playback, syncOffsetMs, setSyncOffset, recording, hasRecording, devices, device, setDevice, busy, connected, onModelReady, connect, disconnect, toggleMicrophone, sendText, stopAudio, setSpeakerMuted, setEmotion, setBaselineEmotion, testSpeaker, recordTest, playRecording };
}
