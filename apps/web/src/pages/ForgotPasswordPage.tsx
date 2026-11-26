import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setError(null);
    if (!supabase) return setError("Supabase is not configured.");
    const redirectTo = `${window.location.origin}/auth/callback?type=recovery`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (err) return setError(err.message);
    setMsg("If the account exists, a password reset email has been sent.");
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-md card p-6">
        <h1 className="font-display text-3xl font-bold">Reset password</h1>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          {error && <div className="border-2 border-danger bg-red-50 p-3 text-sm">{error}</div>}
          {msg && <div className="border-2 border-green-700 bg-green-50 p-3 text-sm">{msg}</div>}
          <button className="btn-primary w-full">Send reset email</button>
        </form>
        <Link to="/login" className="mt-4 inline-block text-sm font-semibold underline">Back to login</Link>
      </div>
    </div>
  );
}
