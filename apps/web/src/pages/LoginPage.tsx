import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { config } from "../lib/config";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/dashboard";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Login failed");
      if (supabase && body.session) {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: body.session.access_token,
          refresh_token: body.session.refresh_token,
        });
        if (sessionErr) throw sessionErr;
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-md card p-6">
        <Link to="/" className="font-display text-2xl font-bold"><span className="bg-lime px-2">{config.appName}</span></Link>
        <h1 className="mt-6 font-display text-3xl font-bold">Log in</h1>
        <p className="mt-2 text-muted">Sign in with your username and password.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div><label className="label">Username</label><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></div>
          <div><label className="label">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></div>
          {error && <div className="border-2 border-danger bg-red-50 p-3 text-sm font-medium">{error}</div>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        </form>
        <div className="mt-4 flex flex-col gap-2 text-sm font-semibold">
          <Link to="/forgot-password" className="underline">Forgot password?</Link>
          <Link to="/signup" className="underline">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
