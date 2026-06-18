import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  buildAdminTikTokSettingsResponse,
  saveAdminTikTokSettings,
} from "@/lib/site-settings/admin-tiktok-route";

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

  return buildAdminTikTokSettingsResponse(admin.supabase);
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

  return saveAdminTikTokSettings(request, admin.supabase);
}
