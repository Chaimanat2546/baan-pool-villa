import { createClient } from "@supabase/supabase-js";

const HOME_CONFIG_SUPABASE_ENV_ERROR =
  "Home config Supabase environment is missing";

type HomeConfigSupabaseClient = ReturnType<typeof createClient>;

let browserHomeConfigClient: HomeConfigSupabaseClient | null = null;
let browserHomeConfigClientKey = "";

/**
 * Reads the public Supabase environment required for home-section config
 * access.
 *
 * @returns The trimmed Supabase URL and publishable key for the home config
 * project.
 * @throws {Error} When the required public environment variables are missing.
 */
export function getHomeConfigSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(HOME_CONFIG_SUPABASE_ENV_ERROR);
  }

  return { supabaseUrl, supabaseKey };
}

/**
 * Creates a server-safe Supabase client for the home-section config project.
 *
 * @param accessToken - An optional bearer token used for authenticated admin
 * requests.
 * @returns A Supabase client configured for non-persistent server use.
 */
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
  const supabaseUrl = process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(HOME_CONFIG_SUPABASE_ENV_ERROR);
  }

  const clientKey = `${supabaseUrl}\n${supabaseKey}`;

  if (browserHomeConfigClient && browserHomeConfigClientKey === clientKey) {
    return browserHomeConfigClient;
  }

  browserHomeConfigClient = createClient(supabaseUrl, supabaseKey);
  browserHomeConfigClientKey = clientKey;

  return browserHomeConfigClient;
}
