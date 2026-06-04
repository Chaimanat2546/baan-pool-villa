import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";

/**
 * Reads the current browser Supabase access token for admin API calls.
 *
 * Missing public Supabase config or session bootstrap errors mean the browser
 * cannot prove an admin session, so callers should treat the result as signed
 * out and route the user to the admin login page.
 */
export async function readAdminAccessToken(): Promise<string | null> {
  try {
    const supabase = createBrowserHomeConfigClient();
    const { data, error } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    return error || !token ? null : token;
  } catch {
    return null;
  }
}
