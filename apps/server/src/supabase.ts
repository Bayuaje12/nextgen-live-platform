import { createClient } from "@supabase/supabase-js";
import { env, hasSupabaseAdminConfig, hasSupabasePublicConfig } from "./env.js";

export function getSupabaseAdmin() {
  if (!hasSupabaseAdminConfig()) return null;
  return createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getSupabaseAnon() {
  if (!hasSupabasePublicConfig()) return null;
  return createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
