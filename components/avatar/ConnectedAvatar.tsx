"use client";
import Link from "next/link";
import { useAvatarConversation } from "@/hooks/useAvatarConversation";
import { emotions } from "@/avatar/engine/behaviorConfig";
import AvatarViewer from "./AvatarViewer";

export default function ConnectedAvatar() {
  const { ready, connection, behaviorState, emotion, micOn, micPending, muted, error, text, setText, transcripts, playback, recording, hasRecording, devices, device, setDevice, busy, connected, onModelReady, connect, disconnect, toggleMicrophone, sendText, stopAudio, setSpeakerMuted, setEmotion, testSpeaker, recordTest, playRecording } = useAvatarConversation();
  return <div className="connected-avatar">
    <AvatarViewer avatarOnly onModelReady={onModelReady} />
    <section className="conversation-dock" aria-label="Avatar conversation">
      <div className="conversation-heading"><Link href="/">Back to studio</Link><span role="status">{connection} · {recording ? "Recording locally" : behaviorState[0].toUpperCase() + behaviorState.slice(1)}{micOn ? " · Microphone on" : ""}</span></div>
      <div className="conversation-buttons">
        <button className="connect-avatar-button" disabled={!ready || busy || connected || recording || micPending} onClick={() => void connect()}>{connection === "error" ? "Reconnect" : "Connect to Gemini"}</button>
        <button disabled={!connected || micPending} onClick={() => void toggleMicrophone()}>{micPending ? "Opening microphone…" : micOn ? "Mute microphone" : "Start microphone"}</button>
        <button aria-pressed={muted} onClick={() => setSpeakerMuted(!muted)}>{muted ? "Unmute speaker" : "Mute speaker"}</button>
        <button onClick={stopAudio}>Stop audio</button>
        <button disabled={connection === "disconnected" && !playback.playing && !recording && !micPending} onClick={disconnect}>Disconnect</button>
      </div>
      <form className="conversation-input" onSubmit={(event) => { event.preventDefault(); void sendText(); }}><input aria-label="Message to Gemini" placeholder="Type a message to your avatar…" maxLength={4000} value={text} onChange={(event) => setText(event.target.value)} /><button disabled={!connected || !text.trim()} type="submit">Send</button></form>
      {error && <p role="alert" className="conversation-error">{error}</p>}
      <details className="conversation-details"><summary>Avatar emotion</summary><div className="conversation-buttons behavior-actions">{emotions.map((name) => <button key={name} aria-pressed={emotion === name} onClick={() => setEmotion(name)}>{name[0].toUpperCase() + name.slice(1)}</button>)}</div></details>
      <details className="conversation-details"><summary>Transcript & audio checks</summary>
        <p className="muted">Microphone audio is sent to Google Gemini only while connected and the microphone is on. Local recordings stay in this page’s memory.</p>
        <label className="search-label">Microphone device<select aria-label="Microphone device" disabled={micOn || recording || micPending} value={device} onChange={(event) => setDevice(event.target.value)}><option value="">System default</option>{devices.filter((item) => item.deviceId && item.deviceId !== "default").map((item, i) => <option key={item.deviceId} value={item.deviceId}>{item.label || `Microphone ${i + 1}`}</option>)}</select></label>
        <div className="conversation-buttons"><button disabled={connected || busy || recording || micPending} onClick={() => void testSpeaker()}>Test streamed speaker</button><button disabled={connected || busy || micPending} onClick={() => void recordTest()}>{recording ? "Stop local recording" : "Record microphone test"}</button><button disabled={!hasRecording || recording || connected || busy} onClick={() => void playRecording()}>Play local recording</button></div>
        <p className="muted">Local recording stops after 10 seconds. Playback queue: {playback.queuedSeconds.toFixed(1)}s · Mouth amplitude: {playback.amplitude.toFixed(2)}</p>
        <div className="conversation-transcript" aria-label="Conversation transcript">{transcripts.length ? transcripts.map((item, index) => <p key={index}><strong>{item.speaker === "user" ? "You" : "Avatar"}: </strong>{item.text}</p>) : <p className="muted">Your conversation transcript will appear here.</p>}</div>
      </details>
    </section>
  </div>;
}
