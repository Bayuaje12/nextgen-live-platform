export const config = {
  appName: import.meta.env.VITE_APP_NAME || "NextGen Live",
  appUrl: import.meta.env.VITE_APP_URL || "http://localhost:5173",
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:4000",
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  vdoNinjaBaseUrl: import.meta.env.VITE_VDO_NINJA_BASE_URL || "https://vdo.ninja",
  whatsappCommunityUrl:
    import.meta.env.VITE_WHATSAPP_COMMUNITY_URL ||
    "https://whatsapp.com/channel/0029Vb8XyJkGehERjMvj1R1k",
};

export const hasSupabaseConfig = Boolean(config.supabaseUrl && config.supabaseAnonKey);
