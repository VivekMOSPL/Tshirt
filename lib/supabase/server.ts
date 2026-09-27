import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_BUCKET = "tsh-logos";

let _admin: SupabaseClient | null = null;

// Lazy: importing this module must never throw at build time. The error is
// deferred to request time, where each route/page catches it, so the build
// succeeds even before the env vars exist.
export function getSupabaseAdmin(): SupabaseClient {
  if (_admin !== null) return _admin;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Supabase URL/key missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  _admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}
