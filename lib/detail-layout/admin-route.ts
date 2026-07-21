import {
  adminSupabaseErrorResponse,
  type HomeConfigSupabaseClient,
} from "@/lib/admin/route-helpers";
import { revalidateDetailLayoutCache } from "@/lib/cache-revalidation";
import {
  DEFAULT_SITE_SETTINGS,
  SITE_SETTINGS_ID,
} from "@/lib/site-settings/defaults";
import type { SiteSettingsRow } from "@/lib/site-settings/types";
import {
  normalizeAnyDetailLayout,
  validateAnyDetailLayout,
} from "@/lib/detail-layout/compat";
import type { AnyDetailLayoutConfig } from "./types";

export const DETAIL_LAYOUT_SELECT = "id,detail_layout";

export function buildDefaultSettingsInsertPayload(
  detailLayout: AnyDetailLayoutConfig,
) {
  return {
    id: SITE_SETTINGS_ID,
    site_name: DEFAULT_SITE_SETTINGS.siteName,
    primary_color: DEFAULT_SITE_SETTINGS.primaryColor,
    accent_color: DEFAULT_SITE_SETTINGS.accentColor,
    logo_image_path: DEFAULT_SITE_SETTINGS.logoImage.path,
    logo_image_url: DEFAULT_SITE_SETTINGS.logoImage.url,
    hero_image_path: DEFAULT_SITE_SETTINGS.heroImage.path,
    hero_image_url: DEFAULT_SITE_SETTINGS.heroImage.url,
    hero_image_alt: DEFAULT_SITE_SETTINGS.heroImage.alt,
    detail_layout: detailLayout,
  };
}

export async function readJsonPayload(request: Request): Promise<
  | {
      ok: true;
      payload: unknown;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  try {
    return { ok: true, payload: await request.json() };
  } catch {
    return {
      ok: false,
      response: Response.json(
        { errors: ["Request body must be JSON."] },
        { status: 400 },
      ),
    };
  }
}

export function readDetailLayoutPayload(payload: unknown): unknown {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as { layout?: unknown }).layout
    : undefined;
}

export async function buildAdminDetailLayoutResponse(
  supabase: HomeConfigSupabaseClient,
) {
  const { data, error } = await supabase
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

export async function saveAdminDetailLayout(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
  const jsonPayload = await readJsonPayload(request);

  if (!jsonPayload.ok) {
    return jsonPayload.response;
  }

  const layout = readDetailLayoutPayload(jsonPayload.payload);
  const validation = validateAnyDetailLayout(layout);

  if (!validation.ok) {
    return Response.json({ errors: validation.errors }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("site_settings")
    .update({ detail_layout: validation.layout })
    .eq("id", SITE_SETTINGS_ID)
    .select(DETAIL_LAYOUT_SELECT)
    .maybeSingle();

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to save detail layout.");
  }

  if (!data) {
    const { data: insertedData, error: insertError } = await supabase
      .from("site_settings")
      .insert(buildDefaultSettingsInsertPayload(validation.layout))
      .select(DETAIL_LAYOUT_SELECT)
      .single();

    if (insertError) {
      return adminSupabaseErrorResponse(
        insertError,
        "Unable to create detail layout settings.",
      );
    }

    await revalidateDetailLayoutCache();

    return Response.json({
      layout: normalizeAnyDetailLayout(
        (insertedData as SiteSettingsRow).detail_layout,
      ),
    });
  }

  const row = data as SiteSettingsRow;

  await revalidateDetailLayoutCache();

  return Response.json({
    layout: normalizeAnyDetailLayout(row.detail_layout),
  });
}
