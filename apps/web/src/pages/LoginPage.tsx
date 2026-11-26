import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { config } from "../lib/config";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/dashboard";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) return setError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) return setError(err.message);
    navigate(from, { replace: true });
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-md card p-6">
        <Link to="/" className="font-display text-2xl font-bold"><span className="bg-lime px-2">{config.appName}</span></Link>
        <h1 className="mt-6 font-display text-3xl font-bold">Log in</h1>
        <p className="mt-2 text-muted">Access your dashboard, rooms, and production tools.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label className="label">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
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
