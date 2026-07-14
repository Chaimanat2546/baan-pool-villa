import "server-only";

import {
  adminSupabaseErrorResponse,
  type HomeConfigSupabaseClient,
} from "@/lib/admin/route-helpers";
import { revalidateSiteHeaderSettingsCache } from "@/lib/cache-revalidation";
import { DEFAULT_SITE_HEADER_SETTINGS } from "./defaults";
import type { SiteHeaderSettings } from "./types";
import {
  normalizeDesktopHeaderVariant,
  validateDesktopHeaderVariant,
} from "./validation";

function toSettings(row: unknown): SiteHeaderSettings {
  return {
    desktopHeaderVariant: normalizeDesktopHeaderVariant(
      (row as { desktop_header_variant?: unknown } | null)
        ?.desktop_header_variant,
    ),
  };
}

export async function getAdminSiteHeaderSettings(
  supabase: HomeConfigSupabaseClient,
): Promise<Response> {
  const { data, error } = await supabase
    .from("site_header_settings")
    .select("desktop_header_variant")
    .eq("singleton_id", true)
    .maybeSingle();

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to load header settings.");
  }

  return Response.json({ settings: data ? toSettings(data) : DEFAULT_SITE_HEADER_SETTINGS });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function saveAdminSiteHeaderSettings(
  request: Request,
  supabase: HomeConfigSupabaseClient,
): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ errors: ["Invalid JSON request body."] }, { status: 400 });
  }

  if (!isRecord(body) || Object.keys(body).some((key) => key !== "desktopHeaderVariant")) {
    return Response.json({ errors: ["Invalid header settings fields."] }, { status: 400 });
  }

  const errors = validateDesktopHeaderVariant(body.desktopHeaderVariant);
  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const desktopHeaderVariant = normalizeDesktopHeaderVariant(body.desktopHeaderVariant);
  const { data, error } = await supabase
    .from("site_header_settings")
    .upsert({ singleton_id: true, desktop_header_variant: desktopHeaderVariant })
    .select("desktop_header_variant")
    .maybeSingle();

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to save header settings.");
  }

  const warnings: string[] = [];
  try {
    await revalidateSiteHeaderSettingsCache();
  } catch {
    warnings.push("Header settings were saved but cache refresh failed.");
  }

  return Response.json({
    settings: data ? toSettings(data) : { desktopHeaderVariant },
    verified: Boolean(data),
    warnings,
  });
}
