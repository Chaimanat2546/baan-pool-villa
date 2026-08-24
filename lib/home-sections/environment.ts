const HOME_CONFIG_SUPABASE_ENV_ERROR =
  "Home config Supabase environment is missing";

/**
 * Reads the public Supabase environment required for home-section config
 * access.
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
 * Returns the tenant-specific owner used to isolate persistent CMS caches.
 */
export function getHomeConfigCacheNamespace() {
  const supabaseUrl = process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL?.trim();

  if (!supabaseUrl) {
    return "home-config:unconfigured";
  }

  let hostname: string;

  try {
    hostname = new URL(supabaseUrl).hostname.toLowerCase();
  } catch {
    return "home-config:invalid";
  }

  return `home-config:${hostname}`;
}
