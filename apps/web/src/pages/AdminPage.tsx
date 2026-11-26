import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  is_blocked: boolean;
  blocked_reason?: string | null;
  last_login_at?: string | null;
  created_at: string;
};

type AuditLog = { id: string; action: string; target_type: string; target_id: string; created_at: string; metadata?: any };

export default function AdminPage() {
  const [overview, setOverview] = useState<{ users: number; rooms: number; openReports: number; blockedUsers: number } | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadAll(q = "") {
    setError(null);
    try {
      const [o, u, a] = await Promise.all([
        apiFetch<any>("/api/admin/overview"),
        apiFetch<{ users: UserRow[] }>(`/api/admin/users${q ? `?search=${encodeURIComponent(q)}` : ""}`),
        apiFetch<{ logs: AuditLog[] }>("/api/admin/audit-logs"),
      ]);
      setOverview(o);
      setUsers(u.users || []);
      setLogs(a.logs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load admin data");
    }
  }

  useEffect(() => { void loadAll(); }, []);

  async function updateUser(id: string, payload: any) {
    setBusyId(id); setError(null); setNotice(null);
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setNotice("User updated.");
      await loadAll(search);
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed"); }
    finally { setBusyId(null); }
  }

  async function resetPassword(id: string) {
    const newPassword = window.prompt("Enter new password (min 8 chars):");
    if (!newPassword) return;
    if (newPassword.length < 8) return setError("Password must be at least 8 characters.");
    setBusyId(id); setError(null); setNotice(null);
    try {
      await apiFetch(`/api/admin/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) });
      setNotice("Password reset.");
    } catch (e) { setError(e instanceof Error ? e.message : "Reset failed"); }
    finally { setBusyId(null); }
  }

  async function renameUser(u: UserRow) {
    const username = window.prompt("New username:", u.username);
    if (!username || username === u.username) return;
    await updateUser(u.id, { username });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-bold">Account Management</h1>
        <p className="text-muted">Admin-only user management. All sensitive actions are enforced server-side and logged.</p>
      </div>

      {error && <div className="border-2 border-danger bg-red-50 p-3 text-sm">{error}</div>}
      {notice && <div className="border-2 border-green-700 bg-green-50 p-3 text-sm">{notice}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        {[ ["Users", overview?.users ?? "—"], ["Blocked", overview?.blockedUsers ?? "—"], ["Rooms", overview?.rooms ?? "—"], ["Open reports", overview?.openReports ?? "—"] ].map(([k,v]) => (
          <div key={String(k)} className="card p-4"><div className="text-sm text-muted">{k}</div><div className="font-display text-3xl font-bold">{v}</div></div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="label">Search by username</label>
            <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="username" />
          </div>
          <button className="btn-secondary" onClick={() => void loadAll(search)}>Search</button>
          <button className="btn-secondary" onClick={() => { setSearch(""); void loadAll(""); }}>Clear</button>
        </div>
      </div>

      <div className="card overflow-x-auto p-4">
        <h2 className="font-display text-2xl font-bold">Users</h2>
        <table className="mt-4 w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-left">
              <th className="p-2">Username</th><th className="p-2">Role</th><th className="p-2">Status</th><th className="p-2">Registered</th><th className="p-2">Last login</th><th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-ink/20 align-top">
                <td className="p-2 font-semibold">{u.username}<div className="text-xs text-muted">{u.display_name}</div></td>
                <td className="p-2">{u.role}</td>
                <td className="p-2">
                  <span className={`inline-block border border-ink px-2 py-0.5 font-semibold ${u.is_blocked ? "bg-red-100" : "bg-lime/30"}`}>{u.is_blocked ? "Blocked" : "Active"}</span>
                  {u.blocked_reason && <div className="text-xs text-muted">{u.blocked_reason}</div>}
                </td>
                <td className="p-2">{new Date(u.created_at).toLocaleString()}</td>
                <td className="p-2">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "—"}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary px-2 py-1 text-xs" disabled={busyId===u.id} onClick={() => void renameUser(u)}>Rename</button>
                    <button className="btn-secondary px-2 py-1 text-xs" disabled={busyId===u.id} onClick={() => void resetPassword(u.id)}>Reset PW</button>
                    {u.is_blocked ? (
                      <button className="btn-secondary px-2 py-1 text-xs" disabled={busyId===u.id} onClick={() => void updateUser(u.id, { isBlocked: false })}>Unblock</button>
                    ) : (
                      <button className="btn-secondary px-2 py-1 text-xs" disabled={busyId===u.id} onClick={() => { if (window.confirm(`Block ${u.username}?`)) void updateUser(u.id, { isBlocked: true, blockedReason: "Blocked by admin" }); }}>Block</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td className="p-3 text-muted" colSpan={6}>No users found.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-2xl font-bold">Audit logs</h2>
        <div className="mt-3 space-y-2 text-sm">
          {logs.slice(0, 30).map((l) => (
            <div key={l.id} className="border-2 border-ink p-2">
              <div className="font-semibold">{l.action}</div>
              <div className="text-muted">{l.target_type}:{l.target_id} • {new Date(l.created_at).toLocaleString()}</div>
            </div>
          ))}
          {logs.length === 0 && <div className="text-muted">No audit logs.</div>}
        </div>
      </div>
    </div>
  );
}
