import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createGuestSession, getGuestSessionFromRequest, revokeGuestSession } from "../guestSession.js";

export async function guestRoutes(app: FastifyInstance) {
  app.post("/guest/session", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = z.object({ displayName: z.string().max(80).optional().nullable() }).safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: "invalid_request", details: body.error.flatten() });
    try {
      const { token, session } = await createGuestSession(body.data.displayName);
      return reply.code(201).send({ token, session });
    } catch (err) {
      return reply.code(503).send({ error: "session_create_failed", message: err instanceof Error ? err.message : "Failed" });
    }
  });

  app.get("/guest/session", async (request, reply) => {
    const session = await getGuestSessionFromRequest(request);
    if (!session) return reply.code(401).send({ error: "unauthorized", message: "No valid guest session" });
    return { session };
  });

  app.post("/guest/session/revoke", async (request, reply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    if (token) await revokeGuestSession(token).catch(() => {});
    return { ok: true };
  });
}
