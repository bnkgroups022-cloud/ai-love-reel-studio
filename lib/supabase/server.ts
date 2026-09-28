import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, ConfigError } from "@/lib/env";

let cached: SupabaseClient | null = null;

/** Server-only Supabase client using the service-role key. Never import in client components. */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const { supabaseUrl, supabaseServiceKey } = env();
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new ConfigError(
      "The database is not connected: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }
  cached = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
