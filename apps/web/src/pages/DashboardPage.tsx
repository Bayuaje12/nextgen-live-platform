import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useGuestStore } from "../store/guest";
import { config } from "../lib/config";

type Room = { id: string; slug: string; title: string; status: string; visibility: string; template: string; created_at: string };

export default function DashboardPage() {
  const { session, ensureSession } = useGuestStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      await ensureSession();
      try {
        const d = await apiFetch<{ rooms: Room[] }>("/api/rooms?mine=true");
        setRooms(d.rooms || []);
      } catch (e) { setError(e instanceof Error ? e.message : "Failed to load rooms"); }
    })();
  }, [ensureSession]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold">Welcome{session?.displayName ? `, ${session.displayName}` : ""}</h1>
          <p className="text-muted">Create rooms, manage sessions, and go live instantly — no account required.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/rooms/new" className="btn-primary">Create live room</Link>
          <a href={config.whatsappCommunityUrl} target="_blank" rel="noreferrer" className="btn-secondary">Community</a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[["Your rooms", rooms.length], ["Scheduled", rooms.filter(r=>r.status==='scheduled').length], ["Live now", rooms.filter(r=>r.status==='live').length], ["Mode", "Accountless"]].map(([k,v]) => (
          <div key={String(k)} className="card p-4"><div className="text-sm text-muted">{k}</div><div className="mt-2 font-display text-2xl font-bold">{v}</div></div>
        ))}
      </div>

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Your rooms</h2><Link to="/rooms/new" className="underline font-semibold">New room</Link></div>
        {error && <div className="mb-4 border-2 border-danger bg-red-50 p-3 text-sm">{error}</div>}
        <div className="space-y-3">
          {rooms.length === 0 && <div className="border-2 border-dashed border-ink p-6 text-muted">No rooms yet. Create your first live room.</div>}
          {rooms.map((room) => (
            <div key={room.id} className="flex flex-col gap-3 border-2 border-ink p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-bold">{room.title}</div>
                <div className="text-sm text-muted">{room.template} • {room.visibility} • {room.status}</div>
              </div>
              <div className="flex gap-2">
                <Link className="btn-secondary" to={`/room/${room.slug}`}>Open</Link>
                <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/room/${room.slug}`)}>Copy link</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
