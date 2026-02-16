import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://elgocjdpvzpcrvvvjyaw.supabase.co";

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsZ29jamRwdnpwY3J2dnZqeWF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDY2ODcsImV4cCI6MjA4NjYyMjY4N30.dveEzInl0hT41GGwQK-bUPYvoKTPAJskaWNAHcV3O0M";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
