import {
  adminSupabaseErrorResponse,
  requireHomeConfigAdmin,
} from "@/lib/admin/route-helpers";
import { revalidateDetailLayoutCache } from "@/lib/cache-revalidation";
import { SITE_SETTINGS_ID } from "@/lib/site-settings/defaults";
import type { SiteSettingsRow } from "@/lib/site-settings/types";
import {
  normalizeAnyDetailLayout,
  validateAnyDetailLayout,
} from "@/lib/detail-layout/compat";
import {
  buildDefaultSettingsInsertPayload,
  DETAIL_LAYOUT_SELECT,
  readDetailLayoutPayload,
  readJsonPayload,
} from "@/lib/detail-layout/admin-route";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const { data, error } = await admin.supabase
    .from("site_settings")
    .select(DETAIL_LAYOUT_SELECT)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to load detail layout.");
  }

  const row = (data as SiteSettingsRow | null) ?? null;

  return Response.json({
    layout: normalizeAnyDetailLayout(row?.detail_layout),
  });
}

export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const jsonPayload = await readJsonPayload(request);

  if (!jsonPayload.ok) {
    return jsonPayload.response;
  }

  const layout = readDetailLayoutPayload(jsonPayload.payload);
  const validation = validateAnyDetailLayout(layout);

  if (!validation.ok) {
    return Response.json({ errors: validation.errors }, { status: 400 });
  }

  const { data, error } = await admin.supabase
    .from("site_settings")
    .update({ detail_layout: validation.layout })
    .eq("id", SITE_SETTINGS_ID)
    .select(DETAIL_LAYOUT_SELECT)
    .maybeSingle();

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to save detail layout.");
  }

  if (!data) {
    const { data: insertedData, error: insertError } = await admin.supabase
      .from("site_settings")
      .insert(buildDefaultSettingsInsertPayload(validation.layout))
      .select(DETAIL_LAYOUT_SELECT)
      .single();

    if (insertError) {
      return adminSupabaseErrorResponse(insertError, "Unable to create detail layout settings.");
    }

    await revalidateDetailLayoutCache();

    return Response.json({
      layout: normalizeAnyDetailLayout((insertedData as SiteSettingsRow).detail_layout),
    });
  }

  const row = data as SiteSettingsRow;

  await revalidateDetailLayoutCache();

  return Response.json({
    layout: normalizeAnyDetailLayout(row.detail_layout),
  });
}
