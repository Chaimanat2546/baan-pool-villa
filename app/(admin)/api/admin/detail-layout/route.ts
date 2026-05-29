import { assertHomeConfigAdmin, getBearerToken, jsonError } from "@/lib/admin/home-config-auth";
import { SITE_SETTINGS_ID } from "@/lib/site-settings/defaults";
import type { SiteSettingsRow } from "@/lib/site-settings/types";
import {
  normalizeDetailLayout,
  validateDetailLayout,
} from "@/lib/detail-layout/validation";

const DETAIL_LAYOUT_SELECT = "id,detail_layout";

interface SupabaseLikeError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

type AdminCheck = Awaited<ReturnType<typeof assertHomeConfigAdmin>>;
type HomeConfigSupabaseClient = Extract<AdminCheck, { ok: true }>["supabase"];

function supabaseErrorResponse(
  error: SupabaseLikeError | null | undefined,
  fallbackMessage: string,
) {
  return jsonError(error?.message ?? fallbackMessage, 403, {
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
}

async function requireAdmin(request: Request): Promise<
  | {
      ok: true;
      supabase: HomeConfigSupabaseClient;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  const token = getBearerToken(request);

  if (!token) {
    return { ok: false, response: jsonError("Missing bearer token.", 401) };
  }

  const adminCheck = await assertHomeConfigAdmin(token);

  if (!adminCheck.ok) {
    return {
      ok: false,
      response: jsonError(adminCheck.message, adminCheck.status),
    };
  }

  return { ok: true, supabase: adminCheck.supabase };
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const { data, error } = await admin.supabase
    .from("site_settings")
    .select(DETAIL_LAYOUT_SELECT)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (error) {
    return supabaseErrorResponse(error, "Unable to load detail layout.");
  }

  const row = (data as SiteSettingsRow | null) ?? null;

  return Response.json({
    layout: normalizeDetailLayout(row?.detail_layout),
  });
}

export async function PUT(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ errors: ["Request body must be JSON."] }, { status: 400 });
  }

  const layout =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as { layout?: unknown }).layout
      : undefined;
  const validation = validateDetailLayout(layout);

  if (!validation.ok) {
    return Response.json({ errors: validation.errors }, { status: 400 });
  }

  const { data, error } = await admin.supabase
    .from("site_settings")
    .update({ detail_layout: validation.layout })
    .eq("id", SITE_SETTINGS_ID)
    .select(DETAIL_LAYOUT_SELECT)
    .single();

  if (error) {
    return supabaseErrorResponse(error, "Unable to save detail layout.");
  }

  const row = data as SiteSettingsRow;

  return Response.json({
    layout: normalizeDetailLayout(row.detail_layout),
  });
}
