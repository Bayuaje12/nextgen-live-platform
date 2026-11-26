import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { config } from "../lib/config";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, displayName: displayName || username }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Signup failed");
      setMessage("Account created. You can now log in.");
      setTimeout(() => navigate("/login"), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-md card p-6">
        <Link to="/" className="font-display text-2xl font-bold"><span className="bg-lime px-2">{config.appName}</span></Link>
        <h1 className="mt-6 font-display text-3xl font-bold">Create account</h1>
        <p className="mt-2 text-muted">Register with a username and password. No email verification required.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div><label className="label">Username</label><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={30} autoComplete="username" required /></div>
          <div><label className="label">Display name (optional)</label><input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} /></div>
          <div><label className="label">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required /></div>
          {error && <div className="border-2 border-danger bg-red-50 p-3 text-sm font-medium">{error}</div>}
          {message && <div className="border-2 border-green-700 bg-green-50 p-3 text-sm font-medium">{message}</div>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? "Creating..." : "Create account"}</button>
        </form>
        <div className="mt-4 text-sm font-semibold"><Link to="/login" className="underline">Already have an account?</Link></div>
      </div>
    </div>
  );
}
