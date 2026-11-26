import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { config } from "../lib/config";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setMessage(null);
    if (!supabase) return setError("Supabase is not configured.");
    setLoading(true);
    const emailRedirectTo = `${window.location.origin}/auth/callback`;
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: username },
        emailRedirectTo,
      },
    });
    setLoading(false);
    if (err) return setError(err.message);
    setMessage("Account created. Check your email for verification if enabled in Supabase.");
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-md card p-6">
        <Link to="/" className="font-display text-2xl font-bold"><span className="bg-lime px-2">{config.appName}</span></Link>
        <h1 className="mt-6 font-display text-3xl font-bold">Create account</h1>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div><label className="label">Username</label><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label className="label">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></div>
          {error && <div className="border-2 border-danger bg-red-50 p-3 text-sm font-medium">{error}</div>}
          {message && <div className="border-2 border-green-700 bg-green-50 p-3 text-sm font-medium">{message}</div>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? "Creating..." : "Create account"}</button>
        </form>
        <div className="mt-4 text-sm font-semibold"><Link to="/login" className="underline">Already have an account?</Link></div>
      </div>
    </div>
  );
}
