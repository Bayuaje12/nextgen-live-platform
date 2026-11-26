import { Link } from "react-router-dom";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-md card p-6">
        <h1 className="font-display text-3xl font-bold">Password recovery</h1>
        <p className="mt-4 text-muted">
          Username-based accounts do not require email verification. If you forgot your password, contact an administrator to reset it.
        </p>
        <p className="mt-3 text-sm text-muted">
          Legacy email-based accounts may still use Supabase email recovery if configured in the Supabase dashboard.
        </p>
        <Link to="/login" className="btn-primary mt-6 inline-flex">Back to login</Link>
      </div>
    </div>
  );
}
