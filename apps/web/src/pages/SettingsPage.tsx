import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/auth";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName((user?.user_metadata?.display_name as string) || "");
    setUsername((user?.user_metadata?.username as string) || "");
  }, [user]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setMessage(null);
    if (!supabase) return setError("Supabase is not configured.");
    const { error: err } = await supabase.auth.updateUser({ data: { display_name: displayName, username } });
    if (err) return setError(err.message);
    setMessage("Profile updated.");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-4xl font-bold">Settings</h1>
      <form onSubmit={saveProfile} className="card space-y-4 p-6">
        <h2 className="font-display text-2xl font-bold">Profile</h2>
        <div><label className="label">Email</label><input className="input" value={user?.email || ""} disabled /></div>
        <div><label className="label">Display name</label><input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
        <div><label className="label">Username</label><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
        {error && <div className="border-2 border-danger bg-red-50 p-3 text-sm">{error}</div>}
        {message && <div className="border-2 border-green-700 bg-green-50 p-3 text-sm">{message}</div>}
        <button className="btn-primary">Save profile</button>
      </form>
      <div className="card p-6">
        <h2 className="font-display text-2xl font-bold">Device & privacy notes</h2>
        <p className="mt-2 text-muted">Camera/microphone permissions are requested by the browser when entering a room. Screen sharing support varies by browser/device. OBS local WebSocket should only be exposed on localhost or secure trusted networks.</p>
      </div>
    </div>
  );
}
