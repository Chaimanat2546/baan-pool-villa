import { createClient } from "@supabase/supabase-js";
import { getHomeConfigSupabaseEnv } from "./environment";

export { getHomeConfigSupabaseEnv } from "./environment";

type HomeConfigSupabaseClient = ReturnType<typeof createClient>;

let browserHomeConfigClient: HomeConfigSupabaseClient | null = null;
let browserHomeConfigClientKey = "";

/** Creates a server-safe Supabase client for the home config project. */
export function createHomeConfigClient(accessToken?: string) {
  const { supabaseUrl, supabaseKey } = getHomeConfigSupabaseEnv();

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}

/**
 * Reuses a browser Supabase client for the home-section config project so the
 * client bundle does not recreate it on every call.
 *
 * @returns A memoized browser Supabase client for public home config access.
 * @throws {Error} When the required public environment variables are missing.
 */
export function createBrowserHomeConfigClient() {
  const { supabaseUrl, supabaseKey } = getHomeConfigSupabaseEnv();

  const clientKey = `${supabaseUrl}\n${supabaseKey}`;

  if (browserHomeConfigClient && browserHomeConfigClientKey === clientKey) {
    return browserHomeConfigClient;
  }

  browserHomeConfigClient = createClient(supabaseUrl, supabaseKey);
  browserHomeConfigClientKey = clientKey;

  return browserHomeConfigClient;
}
