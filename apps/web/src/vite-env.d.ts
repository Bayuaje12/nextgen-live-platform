/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_URL: string;
  readonly VITE_API_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_VDO_NINJA_BASE_URL: string;
  readonly VITE_WHATSAPP_COMMUNITY_URL: string;
  readonly VITE_ENABLE_OBS_LOCAL_BRIDGE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
