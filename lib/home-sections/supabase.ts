import { createClient } from "@supabase/supabase-js";

const HOME_CONFIG_SUPABASE_ENV_ERROR =
  "Home config Supabase environment is missing";

type HomeConfigSupabaseClient = ReturnType<typeof createClient>;

let browserHomeConfigClient: HomeConfigSupabaseClient | null = null;
let browserHomeConfigClientKey = "";

export function getHomeConfigSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(HOME_CONFIG_SUPABASE_ENV_ERROR);
  }

  return { supabaseUrl, supabaseKey };
}

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
