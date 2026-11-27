import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getSupabaseAdmin } from "./supabase.js";

export interface GuestSession {
  id: string;
  guestId: string;
  displayName: string | null;
  expiresAt: string;
}

declare module "fastify" {
  interface FastifyRequest {
    guestSession?: GuestSession;
  }
}

const TOKEN_BYTES = 32;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateGuestId() {
  return `g_${crypto.randomBytes(12).toString("base64url")}`;
}

export async function createGuestSession(displayName?: string | null) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase not configured");
  const token = generateToken();
  const tokenHash = hashToken(token);
  const guestId = generateGuestId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("guest_sessions")
    .insert({
      guest_id: guestId,
      display_name: displayName?.trim() || null,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id, guest_id, display_name, expires_at")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create guest session");
  return {
    token,
    session: { id: data.id, guestId: data.guest_id, displayName: data.display_name, expiresAt: data.expires_at } as GuestSession,
  };
}

export async function getGuestSessionFromRequest(request: FastifyRequest) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const tokenHash = hashToken(token);
  const { data } = await supabase
    .from("guest_sessions")
    .select("id, guest_id, display_name, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  await supabase.from("guest_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
  return { id: data.id, guestId: data.guest_id, displayName: data.display_name, expiresAt: data.expires_at } as GuestSession;
}

export async function requireGuestSession(request: FastifyRequest, reply: FastifyReply) {
  const session = await getGuestSessionFromRequest(request);
  if (!session) {
    return reply.code(401).send({ error: "unauthorized", message: "Valid guest session required" });
  }
  request.guestSession = session;
}

export async function revokeGuestSession(token: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase not configured");
  const tokenHash = hashToken(token);
  await supabase.from("guest_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", tokenHash);
}
