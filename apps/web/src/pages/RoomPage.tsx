import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Copy, Mic, MicOff, Video, VideoOff, MonitorUp, CircleDot, MessageSquare, Radio, Users, ScreenShare, ScreenShareOff } from "lucide-react";
import { apiFetch } from "../lib/api";
import { config, hasSupabaseConfig } from "../lib/config";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/auth";
import { VdoStudioClient, type VdoParticipant, type VdoStatus } from "../features/stream/vdoSdk";

type Room = { id: string; slug: string; title: string; description?: string; status: string; visibility: string; template: string };
type ChatMessage = { id: string; display_name: string; content: string; created_at: string };
type RemoteStream = { uuid: string; streamID?: string; label?: string; stream: MediaStream };

export default function RoomPage() {
  const { slug = "" } = useParams();
  const { user } = useAuthStore();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [joined, setJoined] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [password, setPassword] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [sdkStatus, setSdkStatus] = useState<VdoStatus>("idle");
  const [participants, setParticipants] = useState<VdoParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [useSdk, setUseSdk] = useState(true);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCam, setSelectedCam] = useState("");
  const [selectedMic, setSelectedMic] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const vdoRef = useRef<VdoStudioClient | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    apiFetch<{ room: Room }>(`/api/rooms/${slug}`).then((d) => setRoom(d.room)).catch((e) => setError(e.message));
  }, [slug]);

  useEffect(() => {
    const sb = supabase;
    if (!sb || !room) return;
    const channel = sb
      .channel(`room-chat-${room.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${room.id}` }, (payload) => {
        setChat((c) => [...c, payload.new as ChatMessage]);
      })
      .subscribe();
    void sb.from("chat_messages").select("*").eq("room_id", room.id).order("created_at", { ascending: true }).limit(50).then(({ data }) => {
      if (data) setChat(data as ChatMessage[]);
    });
    return () => { void sb.removeChannel(channel); };
  }, [room]);

  useEffect(() => { if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream; }, [localStream]);
  useEffect(() => () => { void vdoRef.current?.disconnect(); }, []);

  async function refreshDevices() {
    try {
      const d = await VdoStudioClient.listDevices();
      setCameras(d.cameras);
      setMics(d.microphones);
      if (!selectedCam && d.cameras[0]) setSelectedCam(d.cameras[0].deviceId);
      if (!selectedMic && d.microphones[0]) setSelectedMic(d.microphones[0].deviceId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to enumerate devices");
    }
  }

  useEffect(() => { void refreshDevices(); }, []);

  const vdoIframeUrl = useMemo(() => {
    if (!room) return "";
    const pushId = encodeURIComponent(`${room.slug}-${user?.id || guestName || "guest"}`);
    const params = new URLSearchParams({ room: room.slug, push: pushId, webaudio: "", cleanoutput: "", label: user?.email || guestName || "Guest" });
    if (!micOn) params.set("muted", "");
    if (!camOn) params.set("vd", "0");
    return `${config.vdoNinjaBaseUrl}/?${params.toString()}`;
  }, [room, user, guestName, micOn, camOn]);

  async function joinRoom() {
    setError(null); setNotice(null);
    try {
      await apiFetch(`/api/rooms/${slug}/join`, { method: "POST", body: JSON.stringify({ password: password || undefined, guestName: guestName || undefined }) });
      setJoined(true);
      if (useSdk) await startSdk();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to join room"); }
  }

  async function startSdk() {
    if (!room) return;
    try {
      setError(null);
      const client = new VdoStudioClient({
        onStatus: (s, detail) => { setSdkStatus(s); if (detail) setNotice(detail); },
        onPeerConnected: (p) => setParticipants((prev) => prev.some((x) => x.uuid === p.uuid) ? prev.map((x) => x.uuid === p.uuid ? { ...x, ...p } : x) : [...prev, p]),
        onPeerDisconnected: (p) => {
          setParticipants((prev) => prev.filter((x) => x.uuid !== p.uuid));
          setRemoteStreams((prev) => prev.filter((x) => x.uuid !== p.uuid));
        },
        onTrack: ({ uuid, streamID, track, streams }) => {
          const stream = streams[0] ?? new MediaStream([track]);
          if (!streams[0]) stream.addTrack(track);
          setRemoteStreams((prev) => {
            const existing = prev.find((x) => x.uuid === uuid);
            if (existing) {
              if (!existing.stream.getTracks().some((t) => t.id === track.id)) existing.stream.addTrack(track);
              return [...prev];
            }
            return [...prev, { uuid, streamID, stream }];
          });
        },
        onError: (e) => setError(e.message),
      });
      vdoRef.current = client;
      const stream = await client.connectAndPublish({
        room: room.slug,
        streamID: `${room.slug}-${(user?.id || guestName || "guest").replace(/[^a-zA-Z0-9_-]/g, "")}`.slice(0, 60),
        label: user?.email || guestName || "Guest",
        password: false,
        audio: micOn,
        video: camOn,
        audioDeviceId: selectedMic || undefined,
        videoDeviceId: selectedCam || undefined,
      });
      setLocalStream(stream);
      await refreshDevices();
      setNotice("Connected via official VDO.Ninja SDK. Open another browser session to verify peer media.");
    } catch (e) {
      setSdkStatus("error");
      const msg = e instanceof Error ? e.message : "SDK connection failed";
      setError(msg.includes("Permission") ? `Media permission error: ${msg}` : msg);
    }
  }

  async function toggleMic() {
    try { await vdoRef.current?.setMicEnabled(!micOn); setMicOn((v) => !v); } catch (e) { setError(e instanceof Error ? e.message : "Mic toggle failed"); }
  }
  async function toggleCam() {
    try { await vdoRef.current?.setCamEnabled(!camOn); setCamOn((v) => !v); } catch (e) { setError(e instanceof Error ? e.message : "Camera toggle failed"); }
  }

  async function changeCamera(deviceId: string) {
    setSelectedCam(deviceId);
    if (!vdoRef.current) return;
    try { const s = await vdoRef.current.replaceCamera(deviceId); setLocalStream(s); } catch (e) { setError(e instanceof Error ? e.message : "Camera switch failed"); }
  }
  async function changeMic(deviceId: string) {
    setSelectedMic(deviceId);
    if (!vdoRef.current) return;
    try { const s = await vdoRef.current.replaceMicrophone(deviceId); setLocalStream(s); } catch (e) { setError(e instanceof Error ? e.message : "Microphone switch failed"); }
  }

  async function toggleScreenShare() {
    if (!vdoRef.current) return setError("SDK not connected");
    try {
      if (screenSharing) { await vdoRef.current.stopScreenShare(selectedCam || undefined); setScreenSharing(false); setLocalStream(vdoRef.current.getLocalStream()); }
      else { await vdoRef.current.startScreenShare(); setScreenSharing(true); setLocalStream(vdoRef.current.getLocalStream()); }
    } catch (e) { setError(e instanceof Error ? e.message : "Screen share failed"); }
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !room || !chatInput.trim()) return;
    const displayName = user?.email || guestName || "Guest";
    const { error: err } = await supabase.from("chat_messages").insert({ room_id: room.id, user_id: user?.id ?? null, display_name: displayName, content: chatInput.trim(), type: "message" });
    if (err) setError(err.message); else setChatInput("");
  }

  async function toggleRecording() {
    if (recording) { mediaRecorderRef.current?.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        setRecordingUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(); mediaRecorderRef.current = recorder; setRecording(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Recording not supported or permission denied"); }
  }

  async function copyLink() { await navigator.clipboard.writeText(window.location.href); setNotice("Room link copied."); }
  async function leaveRoom() { await vdoRef.current?.disconnect(); setJoined(false); setLocalStream(null); setRemoteStreams([]); setParticipants([]); setSdkStatus("idle"); }

  if (error && !room) return <div className="p-8"><div className="card p-6 text-danger font-semibold">{error}</div></div>;

  if (!joined) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-xl card p-6">
          <h1 className="font-display text-3xl font-bold">{room?.title || "Join room"}</h1>
          <p className="mt-2 text-muted">{room?.description || "Enter the room to join the live session."}</p>
          {!user && <div className="mt-4"><label className="label">Guest name</label><input className="input" value={guestName} onChange={(e) => setGuestName(e.target.value)} /></div>}
          <div className="mt-4"><label className="label">Room password (if required)</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <label className="mt-4 flex items-center gap-2 font-semibold"><input type="checkbox" checked={useSdk} onChange={(e) => setUseSdk(e.target.checked)} /> Use official VDO.Ninja SDK (recommended)</label>
          {error && <div className="mt-4 border-2 border-danger bg-red-50 p-3 text-sm">{error}</div>}
          <button className="btn-primary mt-4 w-full" onClick={joinRoom}>Join room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-ink bg-white p-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-block border-2 border-ink bg-lime px-2 text-xs font-bold">{room?.status?.toUpperCase() || "ROOM"}</div>
            <h1 className="font-display text-2xl font-bold">{room?.title}</h1>
            <div className="text-sm text-muted">{room?.template} • {room?.visibility} • SDK: {sdkStatus}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={copyLink}><Copy size={16} /> Copy</button>
            <button className={`btn ${micOn ? "btn-secondary" : "bg-red-100"}`} onClick={toggleMic}>{micOn ? <Mic size={16} /> : <MicOff size={16} />} Mic</button>
            <button className={`btn ${camOn ? "btn-secondary" : "bg-red-100"}`} onClick={toggleCam}>{camOn ? <Video size={16} /> : <VideoOff size={16} />} Cam</button>
            <button className={`btn ${screenSharing ? "bg-lime" : "btn-secondary"}`} onClick={toggleScreenShare}>{screenSharing ? <ScreenShareOff size={16} /> : <ScreenShare size={16} />} Share</button>
            <button className={`btn ${recording ? "bg-red-500 text-white" : "btn-secondary"}`} onClick={toggleRecording}><CircleDot size={16} /> {recording ? "Stop" : "Rec"}</button>
            <button className="btn-secondary" onClick={leaveRoom}>Leave</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <div className="card p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div><label className="label">Camera</label><select className="input" value={selectedCam} onChange={(e) => void changeCamera(e.target.value)}>{cameras.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 6)}`}</option>)}</select></div>
              <div><label className="label">Microphone</label><select className="input" value={selectedMic} onChange={(e) => void changeMic(e.target.value)}>{mics.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 6)}`}</option>)}</select></div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b-2 border-ink bg-white p-3 font-semibold flex items-center gap-2"><Radio size={16} /> SDK Studio</div>
            <div className="grid gap-2 bg-black p-2 md:grid-cols-2">
              <div className="relative aspect-video border-2 border-white/20 bg-zinc-900">
                <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                <div className="absolute bottom-2 left-2 border border-white/40 bg-black/60 px-2 text-xs text-white">You (local)</div>
              </div>
              {remoteStreams.map((r) => <RemoteVideo key={r.uuid} stream={r.stream} label={r.label || r.streamID || r.uuid.slice(0, 8)} />)}
              {remoteStreams.length === 0 && <div className="flex aspect-video items-center justify-center border-2 border-dashed border-white/20 text-sm text-white/70">No remote peers yet. Open another browser session to test.</div>}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b-2 border-ink bg-white p-3 font-semibold">VDO.Ninja iframe fallback (kept until SDK verified)</div>
            {vdoIframeUrl ? <iframe src={vdoIframeUrl} title="VDO.Ninja fallback" className="h-[35vh] w-full bg-black" allow="camera;microphone;display-capture;autoplay;clipboard-read;clipboard-write;fullscreen" /> : null}
          </div>

          {recordingUrl && <div className="card p-4"><div className="font-semibold">Local recording ready</div><video src={recordingUrl} controls className="mt-3 w-full border-2 border-ink" /><a className="btn-primary mt-3" href={recordingUrl} download={`${slug}-recording.webm`}>Download recording</a></div>}
          {(error || notice) && <div className={`border-2 p-3 text-sm ${error ? "border-danger bg-red-50" : "border-ink bg-lime/20"}`}>{error || notice}</div>}
        </section>

        <aside className="space-y-4">
          <div className="card">
            <div className="border-b-2 border-ink p-3 font-semibold flex items-center gap-2"><Users size={16} /> Participants ({participants.length + 1})</div>
            <div className="space-y-2 p-3 text-sm">
              <div className="border-2 border-ink bg-lime/30 p-2 font-semibold">You • {sdkStatus}</div>
              {participants.map((p) => <div key={p.uuid} className="border-2 border-ink p-2">{p.label || p.streamID || p.uuid.slice(0, 8)} <span className="text-muted">({p.status || "connected"})</span></div>)}
              {participants.length === 0 && <div className="text-muted">No remote participants detected yet.</div>}
            </div>
          </div>

          <div className="card flex min-h-[40vh] flex-col">
            <div className="border-b-2 border-ink p-3 font-semibold flex items-center gap-2"><MessageSquare size={16} /> Live chat</div>
            <div className="flex-1 space-y-3 overflow-auto p-3">
              {!hasSupabaseConfig && <div className="text-sm text-muted">Configure Supabase to enable persistent real-time chat.</div>}
              {chat.map((m) => <div key={m.id} className="border-2 border-ink bg-background p-2"><div className="text-xs font-bold">{m.display_name}</div><div className="text-sm">{m.content}</div></div>)}
            </div>
            <form onSubmit={sendChat} className="border-t-2 border-ink p-3"><div className="flex gap-2"><input className="input" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Send a message" /><button className="btn-primary" type="submit">Send</button></div></form>
          </div>
        </aside>
      </div>
    </div>
  );
}

function RemoteVideo({ stream, label }: { stream: MediaStream; label: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return (
    <div className="relative aspect-video border-2 border-white/20 bg-zinc-900">
      <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />
      <div className="absolute bottom-2 left-2 border border-white/40 bg-black/60 px-2 text-xs text-white">{label}</div>
    </div>
  );
}
