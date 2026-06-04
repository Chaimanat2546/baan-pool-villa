import { assertHomeConfigAdmin, getBearerToken, jsonError } from "@/lib/admin/home-config-auth";
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
import type { AnyDetailLayoutConfig } from "@/lib/detail-layout/types";

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

function buildDefaultSettingsInsertPayload(detailLayout: AnyDetailLayoutConfig) {
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
    bank_account_name: DEFAULT_SITE_SETTINGS.bank.accountName,
    bank_name: DEFAULT_SITE_SETTINGS.bank.bankName,
    bank_account_number: DEFAULT_SITE_SETTINGS.bank.accountNumber,
    phone_contacts: DEFAULT_SITE_SETTINGS.contact.phoneContacts,
    messenger_url: DEFAULT_SITE_SETTINGS.contact.messengerUrl,
    line_id: DEFAULT_SITE_SETTINGS.contact.lineId,
    line_url: DEFAULT_SITE_SETTINGS.contact.lineUrl,
    seo_title: DEFAULT_SITE_SETTINGS.seo.title,
    seo_description: DEFAULT_SITE_SETTINGS.seo.description,
    seo_og_image_url: DEFAULT_SITE_SETTINGS.seo.ogImage.url,
    seo_og_image_alt: DEFAULT_SITE_SETTINGS.seo.ogImage.alt,
    seo_business_name: DEFAULT_SITE_SETTINGS.seo.businessName,
    seo_same_as_urls: DEFAULT_SITE_SETTINGS.seo.sameAsUrls,
    detail_layout: detailLayout,
  };
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
    layout: normalizeAnyDetailLayout(row?.detail_layout),
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
    return supabaseErrorResponse(error, "Unable to save detail layout.");
  }

  if (!data) {
    const { data: insertedData, error: insertError } = await admin.supabase
      .from("site_settings")
      .insert(buildDefaultSettingsInsertPayload(validation.layout))
      .select(DETAIL_LAYOUT_SELECT)
      .single();

    if (insertError) {
      return supabaseErrorResponse(insertError, "Unable to create detail layout settings.");
    }

    revalidateDetailLayoutCache();

    return Response.json({
      layout: normalizeAnyDetailLayout((insertedData as SiteSettingsRow).detail_layout),
    });
  }

  const row = data as SiteSettingsRow;

  revalidateDetailLayoutCache();

  return Response.json({
    layout: normalizeAnyDetailLayout(row.detail_layout),
  });
}
