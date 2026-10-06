import "server-only";
import { AnalyticsError } from "./types";
export function getAnalyticsConfig(env: NodeJS.ProcessEnv = process.env) {
  const url = env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SECRET_KEY?.trim();
  const siteId = env.ANALYTICS_SITE_ID?.trim();
  if (!url || !key || !siteId || siteId.length > 128)
    throw new AnalyticsError("STORAGE_UNAVAILABLE", 503);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AnalyticsError("STORAGE_UNAVAILABLE", 503);
  }
  if (
    parsed.protocol !== "https:" &&
    !(
      env.NODE_ENV !== "production" &&
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname)
    )
  )
    throw new AnalyticsError("STORAGE_UNAVAILABLE", 503);
  if (
    env.CENTRAL_USER_MANAGER_PROJECT_REF &&
    parsed.hostname !== `${env.CENTRAL_USER_MANAGER_PROJECT_REF}.supabase.co`
  )
    throw new AnalyticsError("STORAGE_UNAVAILABLE", 503);
  return { url, key, siteId };
}
