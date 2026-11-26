import type { FastifyInstance } from "fastify";
import { requireAdmin, requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/overview", { preHandler: [requireAuth, requireAdmin] }, async (_request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });

    const [users, rooms, reports] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("rooms").select("id", { count: "exact", head: true }),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);

    return {
      users: users.count ?? 0,
      rooms: rooms.count ?? 0,
      openReports: reports.count ?? 0,
    };
  });

  app.get("/admin/users", { preHandler: [requireAuth, requireAdmin] }, async (_request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { users: data };
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
