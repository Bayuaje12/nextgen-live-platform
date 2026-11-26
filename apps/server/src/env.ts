import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().default("http://localhost:5173"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  OBS_BRIDGE_ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  OBS_BRIDGE_DEFAULT_PORT: z.coerce.number().default(4455),
});

export const env = envSchema.parse(process.env);

export function hasSupabaseAdminConfig() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasSupabasePublicConfig() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}
