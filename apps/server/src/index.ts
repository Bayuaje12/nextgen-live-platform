import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { env } from "./env.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { obsRoutes } from "./routes/obs.js";
import { roomRoutes } from "./routes/rooms.js";

async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  });
  await app.register(helmet);
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });
  await app.register(sensible);

  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api" });
  await app.register(roomRoutes, { prefix: "/api" });
  await app.register(obsRoutes, { prefix: "/api" });
  await app.register(adminRoutes, { prefix: "/api" });

  app.setErrorHandler((error, _request, reply) => {
    const err = error as { statusCode?: number; message?: string };
    app.log.error(error);
    reply.code(err.statusCode ?? 500).send({
      error: "internal_error",
      message: err.message || "Unexpected server error",
    });
  });

  return app;
}

buildServer()
  .then((app) => app.listen({ port: env.PORT, host: "0.0.0.0" }))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
