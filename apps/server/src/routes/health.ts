import type { FastifyInstance } from "fastify";
import { hasSupabaseAdminConfig, hasSupabasePublicConfig } from "../env.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    service: "nextgen-server",
    timestamp: new Date().toISOString(),
    supabasePublicConfigured: hasSupabasePublicConfig(),
    supabaseAdminConfigured: hasSupabaseAdminConfig(),
  }));
}
