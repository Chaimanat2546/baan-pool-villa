import "server-only";

import type { HomeConfigSupabaseClient } from "@/lib/admin/route-helpers";
import {
  getAdminWebStyle,
  saveAdminWebStyle,
} from "@/lib/site-web-styles/admin-route";
import {
  normalizeDesktopHeaderVariant,
  validateDesktopHeaderVariant,
} from "./validation";

async function toLegacyHeaderResponse(response: Response): Promise<Response> {
  if (!response.ok) return response;

  const payload = (await response.json()) as {
    settings?: { variant?: unknown };
    verified?: boolean;
    warnings?: string[];
  };
  return Response.json({
    settings: {
      desktopHeaderVariant: normalizeDesktopHeaderVariant(payload.settings?.variant),
    },
    ...(payload.verified === undefined ? {} : { verified: payload.verified }),
    ...(payload.warnings === undefined ? {} : { warnings: payload.warnings }),
  });
}

export async function getAdminSiteHeaderSettings(
  supabase: HomeConfigSupabaseClient,
): Promise<Response> {
  return toLegacyHeaderResponse(await getAdminWebStyle("header", supabase));
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

  const response = await saveAdminWebStyle(
    "header",
    new Request(request.url, {
      body: JSON.stringify({
        variant: normalizeDesktopHeaderVariant(body.desktopHeaderVariant),
      }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    }),
    supabase,
  );
  return toLegacyHeaderResponse(response);
}
