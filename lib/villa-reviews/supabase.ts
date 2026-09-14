import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createVillaReviewsClient() {
  const url = process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new Error("Villa review storage is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
