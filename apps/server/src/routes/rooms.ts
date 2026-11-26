import type { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

const createRoomSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  visibility: z.enum(["public", "private"]).default("private"),
  template: z
    .enum(["live", "conference", "podcast", "gaming", "webinar", "classroom", "interview", "event"])
    .default("live"),
  password: z.string().min(4).max(128).optional(),
  waitingRoomEnabled: z.boolean().default(true),
  maxParticipants: z.number().int().min(2).max(50).default(12),
  scheduledFor: z.string().datetime().optional(),
});

export const SAFE_ROOM_COLUMNS =
  "id,slug,title,description,host_id,visibility,status,template,password_protected,waiting_room_enabled,locked,max_participants,scheduled_for,created_at,updated_at";

function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "room"
  );
}

export async function roomRoutes(app: FastifyInstance) {
  app.get("/rooms", async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const query = z.object({ mine: z.coerce.boolean().optional() }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_request", details: query.error.flatten() });

    let userId: string | undefined;
    const auth = request.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      const { data } = await supabase.auth.getUser(auth.slice(7));
      userId = data.user?.id;
    }

    let q = supabase.from("rooms").select(SAFE_ROOM_COLUMNS).order("created_at", { ascending: false }).limit(50);
    if (query.data.mine) {
      if (!userId) return reply.code(401).send({ error: "unauthorized", message: "Login required" });
      q = q.eq("host_id", userId);
    } else {
      q = q.eq("visibility", "public");
    }
    const { data, error } = await q;
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { rooms: data };
  });

  app.post("/rooms", { preHandler: requireAuth }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const body = createRoomSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request", details: body.error.flatten() });

    const slug = `${slugify(body.data.title)}-${Math.random().toString(36).slice(2, 8)}`;
    const { password, ...rest } = body.data;
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        ...rest,
        slug,
        host_id: request.authUser!.id,
        password_protected: Boolean(password),
        password_hash: passwordHash,
        status: "scheduled",
        locked: false,
      })
      .select(SAFE_ROOM_COLUMNS)
      .single();
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });

    await supabase.from("room_members").insert({
      room_id: data.id,
      user_id: request.authUser!.id,
      role: "host",
      status: "joined",
      can_publish: true,
      can_chat: true,
    });

    return reply.code(201).send({ room: data });
  });

  app.get("/rooms/:slug", async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    const { data, error } = await supabase.from("rooms").select(SAFE_ROOM_COLUMNS).eq("slug", params.data.slug).single();
    if (error || !data) return reply.code(404).send({ error: "not_found", message: "Room not found" });
    return { room: data };
  });

  app.post("/rooms/:slug/join", async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1) }).safeParse(request.params);
    const body = z.object({ password: z.string().optional(), guestName: z.string().min(1).max(80).optional() }).safeParse(request.body ?? {});
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });

    const { data: room, error } = await supabase.from("rooms").select(`${SAFE_ROOM_COLUMNS},password_hash`).eq("slug", params.data.slug).single();
    if (error || !room) return reply.code(404).send({ error: "not_found", message: "Room not found" });
    if (room.locked) return reply.code(403).send({ error: "room_locked", message: "Room is locked" });
    if (room.password_protected) {
      const stored = String(room.password_hash ?? "");
      const ok = stored ? await bcrypt.compare(body.data.password ?? "", stored) : false;
      if (!ok) return reply.code(403).send({ error: "invalid_password", message: "Incorrect room password" });
    }

    let userId: string | null = null;
    const auth = request.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      const { data } = await supabase.auth.getUser(auth.slice(7));
      userId = data.user?.id ?? null;
    }
    if (!userId && !body.data.guestName) {
      return reply.code(400).send({ error: "guest_name_required", message: "Guest name required" });
    }

    const status = room.waiting_room_enabled && room.host_id !== userId ? "pending" : "joined";
    const { data: member, error: memberErr } = await supabase
      .from("room_members")
      .insert({
        room_id: room.id,
        user_id: userId,
        guest_name: body.data.guestName,
        role: room.host_id === userId ? "host" : "guest",
        status,
        can_publish: status === "joined",
        can_chat: status === "joined",
      })
      .select("*")
      .single();
    if (memberErr) return reply.code(500).send({ error: "db_error", message: memberErr.message });
    return { member, status };
  });

  app.post("/rooms/:slug/end", { preHandler: requireAuth }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    const { data: room } = await supabase.from("rooms").select("id,host_id").eq("slug", params.data.slug).single();
    if (!room) return reply.code(404).send({ error: "not_found" });
    if (room.host_id !== request.authUser!.id && request.authUser!.role !== "admin") {
      return reply.code(403).send({ error: "forbidden", message: "Only host or admin can end room" });
    }
    const { error } = await supabase.from("rooms").update({ status: "ended", locked: true }).eq("id", room.id);
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { ok: true };
  });

  app.post("/rooms/:slug/lock", { preHandler: requireAuth }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1) }).safeParse(request.params);
    const body = z.object({ locked: z.boolean() }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const { data: room } = await supabase.from("rooms").select("id,host_id").eq("slug", params.data.slug).single();
    if (!room) return reply.code(404).send({ error: "not_found" });
    if (room.host_id !== request.authUser!.id && request.authUser!.role !== "admin") return reply.code(403).send({ error: "forbidden" });
    const { error } = await supabase.from("rooms").update({ locked: body.data.locked }).eq("id", room.id);
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { ok: true, locked: body.data.locked };
  });

  app.get("/rooms/:slug/members", { preHandler: requireAuth }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    const { data: room } = await supabase.from("rooms").select("id,host_id,visibility").eq("slug", params.data.slug).single();
    if (!room) return reply.code(404).send({ error: "not_found" });
    const { data: members, error } = await supabase.from("room_members").select("id,room_id,user_id,guest_name,role,status,can_publish,can_chat,created_at").eq("room_id", room.id).order("created_at", { ascending: true });
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    const isHost = room.host_id === request.authUser!.id;
    const isMember = (members || []).some((m: any) => m.user_id === request.authUser!.id);
    if (!isHost && !isMember && request.authUser!.role !== "admin" && room.visibility !== "public") return reply.code(403).send({ error: "forbidden" });
    return { members };
  });

  app.post("/rooms/:slug/members/:memberId/review", { preHandler: requireAuth }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1), memberId: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ action: z.enum(["approve", "reject"]) }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const { data: room } = await supabase.from("rooms").select("id,host_id").eq("slug", params.data.slug).single();
    if (!room) return reply.code(404).send({ error: "not_found" });
    if (room.host_id !== request.authUser!.id && request.authUser!.role !== "admin") return reply.code(403).send({ error: "forbidden" });
    const status = body.data.action === "approve" ? "approved" : "rejected";
    const { error } = await supabase.from("room_members").update({ status, can_publish: status === "approved", can_chat: status === "approved" }).eq("id", params.data.memberId).eq("room_id", room.id);
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { ok: true, status };
  });

  app.post("/rooms/:slug/members/:memberId/remove", { preHandler: requireAuth }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1), memberId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    const { data: room } = await supabase.from("rooms").select("id,host_id").eq("slug", params.data.slug).single();
    if (!room) return reply.code(404).send({ error: "not_found" });
    if (room.host_id !== request.authUser!.id && request.authUser!.role !== "admin") return reply.code(403).send({ error: "forbidden" });
    const { error } = await supabase.from("room_members").update({ status: "removed", can_publish: false, can_chat: false }).eq("id", params.data.memberId).eq("room_id", room.id);
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { ok: true };
  });
}
