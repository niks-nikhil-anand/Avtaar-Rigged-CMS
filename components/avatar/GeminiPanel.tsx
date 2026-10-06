"use client";
import type { useAvatarConversation } from "@/hooks/useAvatarConversation";

type Conversation = ReturnType<typeof useAvatarConversation>;
const status: Record<Conversation["connection"], { label: string; detail: string; tone: "idle" | "busy" | "ok" | "error" }> = {
  disconnected: { label: "Disconnected", detail: "Not connected to Gemini Live", tone: "idle" },
  connecting: { label: "Connecting…", detail: "Requesting a session", tone: "busy" },
  connected: { label: "Connected", detail: "Gemini Live session is open", tone: "ok" },
  reconnecting: { label: "Reconnecting…", detail: "The session dropped; trying again", tone: "busy" },
  error: { label: "Connection error", detail: "The session could not be opened", tone: "error" },
};
const activity = (state: string) => state[0].toUpperCase() + state.slice(1);

/** Gemini connection state and the few controls a conversation needs. */
export default function GeminiPanel({ conversation }: { conversation: Conversation }) {
  const { ready, connection, behaviorState, micOn, micPending, muted, error, text, setText, transcripts, busy, connected, connect, disconnect, toggleMicrophone, sendText, stopAudio, setSpeakerMuted } = conversation;
  const info = status[connection];
  const open = connected || busy;
  return <aside className="debug-panel gemini-panel" aria-label="Gemini connection">
    <div className="sidebar-head"><div className="panel-heading"><div><p className="eyebrow">Gemini Live</p><h2>Conversation</h2></div></div></div>
    <div className="sidebar-body">
      <section className={`gemini-status tone-${info.tone}`} role="status" aria-live="polite">
        <span className="gemini-dot" aria-hidden="true" />
        <div><strong>{info.label}</strong><span>{connected ? `Avatar ${activity(behaviorState).toLowerCase()}${micOn ? " · microphone on" : ""}` : info.detail}</span></div>
      </section>
      {error && <p role="alert" className="conversation-error">{error}</p>}
      {!ready && <p className="muted">Loading the avatar before you can connect…</p>}

      <div className="gemini-actions">
        {open
          ? <button className="wide-button" onClick={disconnect}>Disconnect</button>
          : <button className="connect-avatar-button wide-button" disabled={!ready || micPending} onClick={() => void connect()}>{connection === "error" ? "Reconnect to Gemini" : "Connect to Gemini"}</button>}
        <div className="gemini-row">
          <button disabled={!connected || micPending} aria-pressed={micOn} onClick={() => void toggleMicrophone()}>{micPending ? "Opening microphone…" : micOn ? "Mute microphone" : "Start microphone"}</button>
          <button aria-pressed={muted} onClick={() => setSpeakerMuted(!muted)}>{muted ? "Unmute speaker" : "Mute speaker"}</button>
          <button onClick={stopAudio}>Stop audio</button>
        </div>
      </div>

      <form className="conversation-input" onSubmit={(event) => { event.preventDefault(); void sendText(); }}>
        <input aria-label="Message to Gemini" placeholder={connected ? "Type a message to your avatar…" : "Connect to send a message"} maxLength={4000} value={text} disabled={!connected} onChange={(event) => setText(event.target.value)} />
        <button disabled={!connected || !text.trim()} type="submit">Send</button>
      </form>

      <p className="action-label">Transcript</p>
      <div className="conversation-transcript" aria-label="Conversation transcript" aria-live="polite">
        {transcripts.length
          ? transcripts.map((item, index) => <p key={index} className={`chat-bubble ${item.speaker === "user" ? "is-user" : "is-avatar"}`}><strong>{item.speaker === "user" ? "You" : "Avatar"}</strong>{item.text}</p>)
          : <p className="muted">Your conversation will appear here.</p>}
      </div>
      <p className="muted privacy-note">Microphone audio is sent to Google Gemini only while connected and the microphone is on.</p>
    </div>
  </aside>;
}
