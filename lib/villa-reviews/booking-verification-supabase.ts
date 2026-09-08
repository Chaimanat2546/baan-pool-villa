import "server-only";

import { createClient } from "@supabase/supabase-js";

const DEVILLEGROUPS_SUPABASE_URL = "https://rqizfiayvcbozlzuvbok.supabase.co";

export function createBookingVerificationClient() {
  const key = process.env.DEVILLE_SUPABASE_SECRET_KEY?.trim();
  if (!key) throw new Error("Booking verification is not configured.");
  return createClient(DEVILLEGROUPS_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
