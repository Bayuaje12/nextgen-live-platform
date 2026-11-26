import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { config } from "../lib/config";

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your account...");

  useEffect(() => {
    async function run() {
      if (!supabase) {
        setStatus("error");
        setMessage("Supabase is not configured.");
        return;
      }

      const errorDescription = searchParams.get("error_description") || searchParams.get("error");
      if (errorDescription) {
        setStatus("error");
        setMessage(errorDescription);
        return;
      }

      const code = searchParams.get("code");
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // Also support hash-based sessions (implicit flow / email confirm tokens)
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const type = searchParams.get("type");
        const isRecovery = type === "recovery" || window.location.hash.includes("type=recovery");
        if (data.session) {
          setStatus("success");
          setMessage(isRecovery ? "Account verified. Redirecting to settings to update your password..." : "Email verified successfully. Redirecting...");
          setTimeout(() => navigate(isRecovery ? "/settings" : "/dashboard", { replace: true }), 1200);
          return;
        }

        setStatus("success");
        setMessage("Email confirmed. You can now log in.");
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed. The link may be expired or invalid.");
      }
    }
    void run();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-md card p-6">
        <Link to="/" className="font-display text-2xl font-bold"><span className="bg-lime px-2">{config.appName}</span></Link>
        <h1 className="mt-6 font-display text-3xl font-bold">Email verification</h1>
        <div className={`mt-4 border-2 p-4 text-sm font-medium ${status === "error" ? "border-danger bg-red-50" : "border-ink bg-lime/20"}`}>
          {message}
        </div>
        <div className="mt-6 flex gap-2">
          <Link to="/login" className="btn-primary">Go to login</Link>
          <Link to="/" className="btn-secondary">Home</Link>
        </div>
      </div>
    </div>
  );
}
