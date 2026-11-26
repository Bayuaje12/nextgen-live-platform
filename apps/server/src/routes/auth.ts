import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getSupabaseAdmin, getSupabaseAnon } from "../supabase.js";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const INTERNAL_EMAIL_DOMAIN = process.env.AUTH_INTERNAL_EMAIL_DOMAIN || "users.nextgen.live";

const signupSchema = z.object({
  username: z.string().min(3).max(30).regex(USERNAME_RE, "Username can contain letters, numbers, underscore"),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(80).optional(),
});

const loginSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(8).max(128),
});

function syntheticEmail(username: string) {
  return `${username.toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/signup", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const body = signupSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request", details: body.error.flatten() });

    const username = body.data.username.trim();
    const usernameLower = username.toLowerCase();
    const email = syntheticEmail(username);

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", usernameLower)
      .maybeSingle();
    if (existing) return reply.code(409).send({ error: "username_taken", message: "Username already taken" });

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: body.data.password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: body.data.displayName || username,
      },
    });
    if (createErr || !created.user) {
      const msg = createErr?.message || "Unable to create account";
      if (msg.toLowerCase().includes("already")) return reply.code(409).send({ error: "username_taken", message: "Username already taken" });
      return reply.code(400).send({ error: "signup_failed", message: msg });
    }

    // Ensure profile row exists/updated with canonical username.
    await supabase.from("profiles").upsert({
      id: created.user.id,
      email,
      username,
      display_name: body.data.displayName || username,
      role: "user",
      is_blocked: false,
    }, { onConflict: "id" });

    return reply.code(201).send({ ok: true, user: { id: created.user.id, username, displayName: body.data.displayName || username } });
  });

  app.post("/auth/login", {
    config: { rateLimit: { max: 15, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const admin = getSupabaseAdmin();
    const anon = getSupabaseAnon();
    if (!admin || !anon) return reply.code(503).send({ error: "service_unavailable", message: "Supabase not configured" });
    const body = loginSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request", details: body.error.flatten() });

    const username = body.data.username.trim();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, username, display_name, role, is_blocked")
      .ilike("username", username)
      .maybeSingle();

    if (!profile || !profile.email) {
      return reply.code(401).send({ error: "invalid_credentials", message: "Invalid username or password" });
    }
    if (profile.is_blocked) {
      return reply.code(403).send({ error: "account_blocked", message: "Account is blocked. Contact an administrator." });
    }

    const { data, error } = await anon.auth.signInWithPassword({
      email: profile.email,
      password: body.data.password,
    });
    if (error || !data.session) {
      return reply.code(401).send({ error: "invalid_credentials", message: "Invalid username or password" });
    }

    await admin.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", profile.id);

    return reply.send({
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
      },
      user: {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        role: profile.role,
      },
    });
  });
}
