import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env.js";

export async function obsRoutes(app: FastifyInstance) {
  app.get("/obs/config", async () => ({
    localBridgeEnabled: env.OBS_BRIDGE_ALLOWED_ORIGINS.length > 0,
    defaultPort: env.OBS_BRIDGE_DEFAULT_PORT,
    security: {
      warning:
        "Never expose an unauthenticated OBS WebSocket endpoint to the public internet. Use localhost or a secure tunnel and explicit user configuration.",
    },
    supportedFeatures: [
      "connection-status",
      "scene-list",
      "scene-switch",
      "recording-start-stop",
      "stream-status",
      "source-visibility-where-supported",
    ],
  }));

  app.post("/obs/validate-connection", async (request, reply) => {
    const body = z
      .object({
        host: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        secure: z.boolean().default(false),
      })
      .safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", details: body.error.flatten() });
    }
    const { host } = body.data;
    const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    if (!allowedHosts.has(host)) {
      return reply.code(400).send({
        error: "unsafe_host",
        message: "For safety, only localhost OBS WebSocket targets are accepted by default.",
      });
    }
    return { ok: true, message: "Host validated. Connect from the browser to your local OBS WebSocket." };
  });
}
