import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export default function AdminPage() {
  const [overview, setOverview] = useState<{ users: number; rooms: number; openReports: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ users: number; rooms: number; openReports: number }>("/api/admin/overview")
      .then(setOverview)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl font-bold">Admin</h1>
      <p className="text-muted">Role-protected admin overview. Backend and Supabase RLS must enforce permissions.</p>
      {error && <div className="border-2 border-danger bg-red-50 p-3 text-sm">{error}</div>}
      <div className="grid gap-4 md:grid-cols-3">
        {[["Users", overview?.users ?? "—"], ["Rooms", overview?.rooms ?? "—"], ["Open reports", overview?.openReports ?? "—"]].map(([k,v]) => (
          <div key={String(k)} className="card p-5"><div className="text-sm text-muted">{k}</div><div className="font-display text-3xl font-bold">{v}</div></div>
        ))}
      </div>
      <div className="card p-6">
        <h2 className="font-display text-2xl font-bold">Security controls</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
          <li>Role checks on server endpoints.</li>
          <li>Supabase RLS policies in migrations.</li>
          <li>Rate limiting via Fastify rate-limit.</li>
          <li>Audit logs/report tables included in schema.</li>
          <li>No service-role keys exposed to frontend.</li>
        </ul>
      </div>
    </div>
  );
}
