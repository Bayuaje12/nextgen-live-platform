import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useGuestStore } from "../store/guest";

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const { ensureSession } = useGuestStore();
  const [form, setForm] = useState({
    title: "", description: "", displayName: "", visibility: "private", template: "live", password: "", waitingRoomEnabled: true, maxParticipants: 12,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm((f) => ({ ...f, [key]: value })); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await ensureSession(form.displayName || undefined);
      const payload = { ...form, password: form.password || undefined, displayName: form.displayName || undefined };
      const res = await apiFetch<{ room: { slug: string }; hostCredential?: string; roomCode?: string }>("/api/rooms", { method: "POST", body: JSON.stringify(payload) });
      if (res.hostCredential) sessionStorage.setItem(`hostcred:${res.room.slug}`, res.hostCredential);
      navigate(`/room/${res.room.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-4xl font-bold">Create room</h1>
      <p className="mt-2 text-muted">Go live instantly — no account required.</p>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6">
        <div><label className="label">Your display name (optional)</label><input className="input" value={form.displayName} onChange={(e) => set("displayName", e.target.value)} /></div>
        <div><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} required /></div>
        <div><label className="label">Description</label><textarea className="input min-h-24" value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label">Visibility</label><select className="input" value={form.visibility} onChange={(e) => set("visibility", e.target.value)}><option value="private">Private</option><option value="public">Public</option></select></div>
          <div><label className="label">Template</label><select className="input" value={form.template} onChange={(e) => set("template", e.target.value)}>{["live","conference","podcast","gaming","webinar","classroom","interview","event"].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label">Room password (optional)</label><input className="input" value={form.password} onChange={(e) => set("password", e.target.value)} /></div>
          <div><label className="label">Max participants</label><input className="input" type="number" min={2} max={50} value={form.maxParticipants} onChange={(e) => set("maxParticipants", Number(e.target.value))} /></div>
        </div>
        <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={form.waitingRoomEnabled} onChange={(e) => set("waitingRoomEnabled", e.target.checked)} /> Enable waiting room</label>
        {error && <div className="border-2 border-danger bg-red-50 p-3 text-sm">{error}</div>}
        <button className="btn-primary" disabled={loading}>{loading ? "Creating..." : "Create room"}</button>
      </form>
    </div>
  );
}
