import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

async function logAudit(actorId: string, action: string, targetType: string, targetId: string, metadata: Record<string, unknown> = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from("audit_logs").insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, metadata });
}

export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/overview", { preHandler: [requireAuth, requireAdmin] }, async (_request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const [users, rooms, reports, blocked] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("rooms").select("id", { count: "exact", head: true }),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_blocked", true),
    ]);
    return { users: users.count ?? 0, rooms: rooms.count ?? 0, openReports: reports.count ?? 0, blockedUsers: blocked.count ?? 0 };
  });

  app.get("/admin/users", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const query = z.object({ search: z.string().optional() }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_request" });
    let q = supabase.from("profiles").select("id,email,username,display_name,role,is_blocked,blocked_at,blocked_reason,last_login_at,created_at,updated_at").order("created_at", { ascending: false }).limit(100);
    if (query.data.search) q = q.ilike("username", `%${query.data.search}%`);
    const { data, error } = await q;
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { users: data };
  });

  app.patch("/admin/users/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
      isBlocked: z.boolean().optional(),
      blockedReason: z.string().max(300).optional(),
    }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });

    const { data: target } = await supabase.from("profiles").select("id,username,role,is_blocked").eq("id", params.data.id).maybeSingle();
    if (!target) return reply.code(404).send({ error: "not_found" });
    if (target.id === request.authUser!.id && body.data.isBlocked === true) {
      return reply.code(400).send({ error: "invalid_action", message: "You cannot block your own account" });
    }
    if (target.role === "admin" && target.id !== request.authUser!.id && body.data.isBlocked === true) {
      return reply.code(400).send({ error: "invalid_action", message: "Blocking another admin is not allowed via this endpoint" });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.data.username && body.data.username !== target.username) {
      const { data: existing } = await supabase.from("profiles").select("id").ilike("username", body.data.username).neq("id", target.id).maybeSingle();
      if (existing) return reply.code(409).send({ error: "username_taken", message: "Username already taken" });
      updates.username = body.data.username;
      updates.display_name = body.data.username;
    }
    if (typeof body.data.isBlocked === "boolean") {
      updates.is_blocked = body.data.isBlocked;
      updates.blocked_at = body.data.isBlocked ? new Date().toISOString() : null;
      updates.blocked_reason = body.data.isBlocked ? (body.data.blockedReason || "Blocked by admin") : null;
    }

    const { data, error } = await supabase.from("profiles").update(updates).eq("id", target.id).select("id,username,display_name,role,is_blocked,blocked_at,blocked_reason,created_at").single();
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    await logAudit(request.authUser!.id, "admin.update_user", "profile", target.id, { updates: body.data });
    return { user: data };
  });

  app.post("/admin/users/:id/reset-password", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ newPassword: z.string().min(8).max(128) }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });

    const { error } = await supabase.auth.admin.updateUserById(params.data.id, { password: body.data.newPassword });
    if (error) return reply.code(500).send({ error: "auth_error", message: error.message });
    await logAudit(request.authUser!.id, "admin.reset_password", "profile", params.data.id, {});
    return { ok: true };
  });

  app.get("/admin/audit-logs", { preHandler: [requireAuth, requireAdmin] }, async (_request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { logs: data };
  });

  app.get("/admin/rooms", { preHandler: [requireAuth, requireAdmin] }, async (_request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const { data, error } = await supabase
      .from("rooms")
      .select("id,slug,title,description,host_id,visibility,status,template,password_protected,waiting_room_enabled,locked,max_participants,scheduled_for,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { rooms: data };
  });
}
