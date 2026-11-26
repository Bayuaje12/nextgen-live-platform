import type { FastifyReply, FastifyRequest } from "fastify";
import { getSupabaseAdmin } from "./supabase.js";

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return reply.code(401).send({ error: "unauthorized", message: "Missing bearer token" });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return reply.code(503).send({
      error: "service_unavailable",
      message: "Supabase is not configured on the server",
    });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return reply.code(401).send({ error: "unauthorized", message: "Invalid session" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_blocked")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.is_blocked) {
    return reply.code(403).send({ error: "account_blocked", message: "Account is blocked" });
  }

  request.authUser = {
    id: data.user.id,
    email: data.user.email,
    role: profile?.role || (data.user.app_metadata?.role as string | undefined) || "user",
  };
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.authUser) {
    return reply.code(401).send({ error: "unauthorized", message: "Authentication required" });
  }
  if (request.authUser.role !== "admin") {
    return reply.code(403).send({ error: "forbidden", message: "Admin role required" });
  }
}
