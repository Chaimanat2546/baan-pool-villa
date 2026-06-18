import {
  adminSupabaseErrorResponse,
  requireHomeConfigAdmin,
} from "@/lib/admin/route-helpers";
import { revalidateSiteSettingsCache } from "@/lib/cache-revalidation";
import type { SiteSettingsRow } from "@/lib/site-settings/types";
import {
  isNoRowsError,
  loadAdminTikTokSettings,
  parseTikTokPayload,
  TIKTOK_SELECT,
  toTikTokInsertPayload,
  toTikTokUpdatePayload,
} from "@/lib/site-settings/admin-tiktok-route";
import { SITE_SETTINGS_ID } from "@/lib/site-settings/defaults";
import { normalizeSiteSettingsRow } from "@/lib/site-settings/validation";

/**
 * Serve the admin GET endpoint that returns the TikTok settings and which data source was used.
 *
 * @returns A Response whose JSON has:
 *  - `settings`: the normalized TikTok settings object (may be empty when using fallback)
 *  - `source`: `"config"` if settings were loaded from the `site_settings` row, `"fallback"` if a fallback row was used
 */
export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const { data, error, source } = await loadAdminTikTokSettings(admin.supabase);

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to load TikTok settings.");
  }

  return Response.json({
    settings: normalizeSiteSettingsRow((data as SiteSettingsRow | null) ?? null).tiktok,
    source,
  });
}

/**
 * Handles authenticated updates to TikTok settings submitted as multipart/form-data.
 *
 * @returns A `Response` whose JSON body varies by outcome:
 * - Success: `{ settings: <tiktok-settings> }` with the saved TikTok settings.
 * - Validation error: status `400` and `{ errors: string[] }` for malformed input.
 * - Authentication/authorization failure: the JSON error response produced by the auth helper.
 * - Supabase failure: a JSON error response describing the persistence error.
 */
export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { errors: ["Request body must be multipart/form-data."] },
      { status: 400 },
    );
  }

  const { draft, errors } = parseTikTokPayload(formData);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const payload = toTikTokUpdatePayload(draft);

  let saveResult = await admin.supabase
    .from("site_settings")
    .update(payload)
    .eq("id", SITE_SETTINGS_ID)
    .select(TIKTOK_SELECT)
    .single();

  if (isNoRowsError(saveResult.error)) {
    saveResult = await admin.supabase
      .from("site_settings")
      .insert(toTikTokInsertPayload(payload))
      .select(TIKTOK_SELECT)
      .single();
  }

  const { data, error } = saveResult;

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to save TikTok settings.");
  }

  await revalidateSiteSettingsCache();

  return Response.json({
    settings: normalizeSiteSettingsRow((data as SiteSettingsRow | null) ?? null).tiktok,
    source: data ? "config" : "none",
  });
}
