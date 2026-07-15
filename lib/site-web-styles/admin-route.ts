import "server-only";

import {
  adminSupabaseErrorResponse,
  type HomeConfigSupabaseClient,
} from "@/lib/admin/route-helpers";
import { revalidateSiteWebStylesCache } from "@/lib/cache-revalidation";
import type { WebStyleType } from "./types";
import {
  getResolvedWebStyle,
  normalizeWebStyleDraft,
  validateWebStyleDraft,
} from "./validation";

export async function getAdminWebStyle(
  type: WebStyleType,
  supabase: HomeConfigSupabaseClient,
): Promise<Response> {
  const { data, error } = await supabase
    .from("site_web_styles")
    .select("style_type,style_variant,options")
    .eq("style_type", type)
    .maybeSingle();

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to load web style.");
  }

  return Response.json({ settings: getResolvedWebStyle(type, data) });
}

export async function saveAdminWebStyle(
  type: WebStyleType,
  request: Request,
  supabase: HomeConfigSupabaseClient,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ errors: ["Invalid JSON request body."] }, { status: 400 });
  }

  const errors = validateWebStyleDraft(type, body);
  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const row = normalizeWebStyleDraft(type, body as Record<string, unknown>);
  const { data, error } = await supabase
    .from("site_web_styles")
    .upsert(row)
    .select("style_type,style_variant,options")
    .maybeSingle();

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to save web style.");
  }

  const warnings: string[] = [];
  try {
    await revalidateSiteWebStylesCache();
  } catch {
    warnings.push("Web style was saved but cache refresh failed.");
  }

  return Response.json({
    settings: getResolvedWebStyle(type, data ?? row),
    verified: Boolean(data),
    warnings,
  });
}
