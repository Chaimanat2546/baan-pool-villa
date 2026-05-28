import { createHomeConfigClient } from "@/lib/home-sections/supabase";

type HomeConfigSupabaseClient = ReturnType<typeof createHomeConfigClient>;

type AdminCheckResult =
  | {
      ok: true;
      supabase: HomeConfigSupabaseClient;
    }
  | {
      ok: false;
      message: string;
      status: 401 | 403;
    };

export function jsonError(
  message: string,
  status: number,
  extra?: Record<string, string | null | undefined>,
) {
  return Response.json({ error: message, ...extra }, { status });
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");

  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();

  return token ? token : null;
}

export async function assertHomeConfigAdmin(
  token: string,
): Promise<AdminCheckResult> {
  const supabase = createHomeConfigClient(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData.user;

  if (userError || !user) {
    return {
      ok: false,
      message: "Invalid or expired Supabase session. Please sign in again.",
      status: 401,
    };
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);

  if (error) {
    return {
      ok: false,
      message: `Unable to verify admin access: ${error.message}`,
      status: 403,
    };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return {
      ok: false,
      message: "Signed-in user is not listed as an active home config admin.",
      status: 403,
    };
  }

  return { ok: true, supabase };
}
