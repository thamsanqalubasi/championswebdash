/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_API_URL?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_ROUTE_GUARD_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
