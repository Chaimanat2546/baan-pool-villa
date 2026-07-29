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

export type AdminSessionState =
  | "active"
  | "forced"
  | "inactive"
  | "invalid"
  | "version_mismatch"
  | "verification_failed";

export async function readAdminSessionState(
  accessToken?: string,
): Promise<AdminSessionState> {
  const token = accessToken ?? (await readAdminAccessToken());
  if (!token) {
    return "invalid";
  }

  try {
    const response = await fetch("/api/admin/session", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await response.json()) as { state?: unknown };
    return [
      "active",
      "forced",
      "inactive",
      "invalid",
      "version_mismatch",
      "verification_failed",
    ].includes(body.state as string)
      ? (body.state as AdminSessionState)
      : "invalid";
  } catch {
    return "verification_failed";
  }
}
