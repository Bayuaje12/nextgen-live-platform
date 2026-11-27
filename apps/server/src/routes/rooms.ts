import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getGuestSessionFromRequest, requireGuestSession } from "../guestSession.js";
import { getSupabaseAdmin } from "../supabase.js";

const createRoomSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  displayName: z.string().max(80).optional(),
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
  "id,slug,room_code,title,description,host_id,owner_guest_session_id,visibility,status,template,password_protected,waiting_room_enabled,locked,max_participants,scheduled_for,created_at,updated_at";

function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "room"
  );
}

function makeRoomCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function makeHostCredential() {
  return crypto.randomBytes(24).toString("base64url");
}

function hashCredential(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function getRoomBySlug(slug: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { supabase: null, room: null, error: "service_unavailable" as const };
  const { data, error } = await supabase.from("rooms").select(`${SAFE_ROOM_COLUMNS},password_hash`).eq("slug", slug).single();
  if (error || !data) return { supabase, room: null, error: "not_found" as const };
  return { supabase, room: data, error: null };
}

async function getJoinedMember(supabase: any, roomId: string, guestSessionId: string) {
  const { data } = await supabase
    .from("room_members")
    .select("id,role,status,can_chat,guest_session_id")
    .eq("room_id", roomId)
    .eq("guest_session_id", guestSessionId)
    .in("status", ["joined", "approved", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function hasHostCapability(supabase: any, room: any, guestSessionId: string, hostCredential?: string) {
  if (room.owner_guest_session_id && room.owner_guest_session_id === guestSessionId) return true;
  if (!hostCredential) return false;
  const credHash = hashCredential(hostCredential);
  const { data: cred } = await supabase
    .from("room_credentials")
    .select("id,role,revoked_at,expires_at")
    .eq("room_id", room.id)
    .eq("token_hash", credHash)
    .maybeSingle();
  if (!cred || cred.revoked_at) return false;
  if (cred.expires_at && new Date(cred.expires_at).getTime() < Date.now()) return false;
  return cred.role === "host" || cred.role === "cohost" || cred.role === "moderator";
}

export async function roomRoutes(app: FastifyInstance) {
  app.get("/rooms", async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const query = z.object({ mine: z.coerce.boolean().optional() }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_request", details: query.error.flatten() });

    const guest = await getGuestSessionFromRequest(request);
    let q = supabase.from("rooms").select(SAFE_ROOM_COLUMNS).order("created_at", { ascending: false }).limit(50);
    if (query.data.mine) {
      if (!guest) return reply.code(401).send({ error: "unauthorized", message: "Guest session required" });
      q = q.eq("owner_guest_session_id", guest.id);
    } else {
      q = q.eq("visibility", "public");
    }
    const { data, error } = await q;
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { rooms: data };
  });

  app.post("/rooms", {
    preHandler: requireGuestSession,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const body = createRoomSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request", details: body.error.flatten() });

    const guest = request.guestSession!;
    const slug = `${slugify(body.data.title)}-${Math.random().toString(36).slice(2, 8)}`;
    const roomCode = makeRoomCode();
    const { password, displayName, ...rest } = body.data;
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const hostCredential = makeHostCredential();

    const { data, error } = await supabase
      .from("rooms")
      .insert({
        ...rest,
        slug,
        room_code: roomCode,
        host_id: null,
        owner_guest_session_id: guest.id,
        password_protected: Boolean(password),
        password_hash: passwordHash,
        status: "live",
        locked: false,
      })
      .select(SAFE_ROOM_COLUMNS)
      .single();
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });

    await supabase.from("room_members").insert({
      room_id: data.id,
      user_id: null,
      guest_session_id: guest.id,
      guest_name: displayName || guest.displayName || "Host",
      display_name: displayName || guest.displayName || "Host",
      role: "host",
      status: "joined",
      can_publish: true,
      can_chat: true,
    });

    await supabase.from("room_credentials").insert({
      room_id: data.id,
      guest_session_id: guest.id,
      role: "host",
      token_hash: hashCredential(hostCredential),
    }).then(() => undefined, () => undefined);

    return reply.code(201).send({ room: data, hostCredential, roomCode });
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

  app.post("/rooms/:slug/join", {
    preHandler: requireGuestSession,
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1) }).safeParse(request.params);
    const body = z.object({
      password: z.string().max(128).optional(),
      guestName: z.string().min(1).max(80).optional(),
      hostCredential: z.string().max(256).optional(),
      roomCode: z.string().max(32).optional(),
    }).safeParse(request.body ?? {});
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });

    const guest = request.guestSession!;
    const { room, error } = await getRoomBySlug(params.data.slug);
    if (error === "service_unavailable" || !supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    if (!room) return reply.code(404).send({ error: "not_found", message: "Room not found" });
    if (room.locked) return reply.code(403).send({ error: "room_locked", message: "Room is locked" });
    if (room.status === "ended") return reply.code(410).send({ error: "room_ended", message: "Room has ended" });

    const isOwner = room.owner_guest_session_id && room.owner_guest_session_id === guest.id;
    let role: "host" | "guest" = isOwner ? "host" : "guest";
    if (!isOwner && body.data.hostCredential) {
      const credHash = hashCredential(body.data.hostCredential);
      const { data: cred } = await supabase.from("room_credentials").select("id,role,revoked_at,expires_at").eq("room_id", room.id).eq("token_hash", credHash).maybeSingle();
      if (cred && !cred.revoked_at && (!cred.expires_at || new Date(cred.expires_at).getTime() > Date.now()) && cred.role === "host") role = "host";
    }

    // Private rooms require password, host capability, or matching room code.
    if (room.visibility === "private" && role !== "host") {
      const codeOk = body.data.roomCode && String(room.room_code || "").toUpperCase() === body.data.roomCode.toUpperCase();
      let passOk = false;
      if (room.password_protected) {
        const stored = String(room.password_hash ?? "");
        passOk = stored ? await bcrypt.compare(body.data.password ?? "", stored) : false;
      }
      if (!codeOk && !passOk) return reply.code(403).send({ error: "forbidden", message: "Private room requires valid room code or password" });
    } else if (room.password_protected && role !== "host") {
      const stored = String(room.password_hash ?? "");
      const ok = stored ? await bcrypt.compare(body.data.password ?? "", stored) : false;
      if (!ok) return reply.code(403).send({ error: "invalid_password", message: "Incorrect room password" });
    }

    const displayName = body.data.guestName || guest.displayName || "Guest";
    const status = room.waiting_room_enabled && role !== "host" ? "pending" : "joined";
    const { data: member, error: memberErr } = await supabase
      .from("room_members")
      .insert({
        room_id: room.id,
        user_id: null,
        guest_session_id: guest.id,
        guest_name: displayName,
        display_name: displayName,
        role,
        status,
        can_publish: status === "joined",
        can_chat: status === "joined",
      })
      .select("id,room_id,user_id,guest_session_id,guest_name,display_name,role,status,can_publish,can_chat,created_at")
      .single();
    if (memberErr) return reply.code(500).send({ error: "db_error", message: memberErr.message });
    return { member, status };
  });

  app.post("/rooms/:slug/lock", {
    preHandler: requireGuestSession,
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1) }).safeParse(request.params);
    const body = z.object({ locked: z.boolean(), hostCredential: z.string().optional() }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const guest = request.guestSession!;
    const { room } = await getRoomBySlug(params.data.slug);
    if (!room) return reply.code(404).send({ error: "not_found" });
    const allowed = await hasHostCapability(supabase, room, guest.id, body.data.hostCredential);
    if (!allowed) return reply.code(403).send({ error: "forbidden", message: "Host capability required" });
    const { error } = await supabase.from("rooms").update({ locked: body.data.locked }).eq("id", room.id);
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { ok: true, locked: body.data.locked };
  });

  app.get("/rooms/:slug/members", { preHandler: requireGuestSession }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    const guest = request.guestSession!;
    const { room } = await getRoomBySlug(params.data.slug);
    if (!room) return reply.code(404).send({ error: "not_found" });
    const host = await hasHostCapability(supabase, room, guest.id, undefined);
    const self = await getJoinedMember(supabase, room.id, guest.id);
    if (!host && !self) return reply.code(403).send({ error: "forbidden" });
    const { data, error } = await supabase
      .from("room_members")
      .select("id,room_id,user_id,guest_session_id,guest_name,display_name,role,status,can_publish,can_chat,created_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true });
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { members: data || [] };
  });

  app.post("/rooms/:slug/members/:id/review", {
    preHandler: requireGuestSession,
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1), id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ action: z.enum(["approve", "reject"]), hostCredential: z.string().optional() }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const guest = request.guestSession!;
    const { room } = await getRoomBySlug(params.data.slug);
    if (!room) return reply.code(404).send({ error: "not_found" });
    const allowed = await hasHostCapability(supabase, room, guest.id, body.data.hostCredential);
    if (!allowed) return reply.code(403).send({ error: "forbidden", message: "Host capability required" });
    const status = body.data.action === "approve" ? "joined" : "rejected";
    const { error } = await supabase
      .from("room_members")
      .update({ status, can_publish: status === "joined", can_chat: status === "joined" })
      .eq("id", params.data.id)
      .eq("room_id", room.id);
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { ok: true, status };
  });

  app.post("/rooms/:slug/members/:id/remove", {
    preHandler: requireGuestSession,
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1), id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ hostCredential: z.string().optional() }).safeParse(request.body ?? {});
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const guest = request.guestSession!;
    const { room } = await getRoomBySlug(params.data.slug);
    if (!room) return reply.code(404).send({ error: "not_found" });
    const allowed = await hasHostCapability(supabase, room, guest.id, body.data.hostCredential);
    if (!allowed) return reply.code(403).send({ error: "forbidden", message: "Host capability required" });
    const { data: target } = await supabase.from("room_members").select("id,role").eq("id", params.data.id).eq("room_id", room.id).maybeSingle();
    if (!target) return reply.code(404).send({ error: "not_found", message: "Member not found" });
    if (target.role === "host") return reply.code(403).send({ error: "forbidden", message: "Cannot remove host" });
    const { error } = await supabase.from("room_members").update({ status: "removed", can_publish: false, can_chat: false }).eq("id", params.data.id).eq("room_id", room.id);
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { ok: true };
  });

  app.post("/rooms/:slug/end", { preHandler: requireGuestSession }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1) }).safeParse(request.params);
    const body = z.object({ hostCredential: z.string().optional() }).safeParse(request.body ?? {});
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const guest = request.guestSession!;
    const { room } = await getRoomBySlug(params.data.slug);
    if (!room) return reply.code(404).send({ error: "not_found" });
    const allowed = await hasHostCapability(supabase, room, guest.id, body.data.hostCredential);
    if (!allowed) return reply.code(403).send({ error: "forbidden", message: "Only room host can end room" });
    const { error } = await supabase.from("rooms").update({ status: "ended", locked: true }).eq("id", room.id);
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { ok: true };
  });

  app.get("/rooms/:slug/chat", { preHandler: requireGuestSession }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    const guest = request.guestSession!;
    const { room } = await getRoomBySlug(params.data.slug);
    if (!room) return reply.code(404).send({ error: "not_found" });
    const member = await getJoinedMember(supabase, room.id, guest.id);
    const host = await hasHostCapability(supabase, room, guest.id, undefined);
    if (!host && (!member || member.status !== "joined")) return reply.code(403).send({ error: "forbidden", message: "Joined room membership required" });
    const { data, error } = await supabase.from("chat_messages").select("id,display_name,content,created_at").eq("room_id", room.id).is("deleted_at", null).order("created_at", { ascending: true }).limit(100);
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { messages: data || [] };
  });

  app.post("/rooms/:slug/chat", {
    preHandler: requireGuestSession,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const params = z.object({ slug: z.string().min(1) }).safeParse(request.params);
    const body = z.object({ content: z.string().min(1).max(1000), displayName: z.string().max(80).optional() }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const guest = request.guestSession!;
    const { room } = await getRoomBySlug(params.data.slug);
    if (!room) return reply.code(404).send({ error: "not_found" });
    if (room.status === "ended") return reply.code(410).send({ error: "room_ended" });
    const member = await getJoinedMember(supabase, room.id, guest.id);
    const host = await hasHostCapability(supabase, room, guest.id, undefined);
    if (!host && (!member || member.status !== "joined" || member.can_chat === false)) {
      return reply.code(403).send({ error: "forbidden", message: "Joined participant required" });
    }
    const { error } = await supabase.from("chat_messages").insert({
      room_id: room.id,
      user_id: null,
      guest_session_id: guest.id,
      display_name: body.data.displayName || guest.displayName || "Guest",
      content: body.data.content,
      type: "message",
    });
    if (error) return reply.code(500).send({ error: "db_error", message: error.message });
    return { ok: true };
  });
}
