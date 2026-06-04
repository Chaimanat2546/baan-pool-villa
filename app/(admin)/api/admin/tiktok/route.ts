import { assertHomeConfigAdmin, getBearerToken, jsonError } from "@/lib/admin/home-config-auth";
import { revalidateSiteSettingsCache } from "@/lib/cache-revalidation";
import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID } from "@/lib/site-settings/defaults";
import type { SiteSettingsRow } from "@/lib/site-settings/types";
import {
  normalizeSiteSettingsRow,
  normalizeTikTokSettingsDraft,
  validateTikTokSettingsDraft,
} from "@/lib/site-settings/validation";

const TIKTOK_SELECT = "id,tiktok_account_url,tiktok_video_urls";
const TIKTOK_FALLBACK_SELECT = "id";
const INVALID_TIKTOK_VIDEO_URL_LIST_ERROR =
  "รายการวิดีโอ TikTok ต้องเป็นรายการลิงก์ที่ถูกต้อง";
const TIKTOK_ACCOUNT_URL_NOT_STRING_ERROR = "ค่าฟิลด์ tiktokAccountUrl ต้องเป็นข้อความ";
const TIKTOK_VIDEO_URLS_NOT_STRING_ERROR = "ค่าฟิลด์ tiktokVideoUrls ต้องเป็นข้อความ";
const TIKTOK_ACCOUNT_URL_MULTIPLE_VALUES_ERROR = "ฟิลด์ tiktokAccountUrl ต้องระบุได้เพียงหนึ่งค่า";
const TIKTOK_VIDEO_URLS_MULTIPLE_VALUES_ERROR = "ฟิลด์ tiktokVideoUrls ต้องระบุได้เพียงหนึ่งค่า";

interface SupabaseLikeError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

interface TikTokSettingsUpdatePayload {
  tiktok_account_url: string;
  tiktok_video_urls: string[];
}

interface TikTokSettingsInsertPayload extends TikTokSettingsUpdatePayload {
  id: string;
  site_name: string;
}

interface StringFieldResult {
  value: string;
  errors: string[];
}

interface StringArrayFieldResult {
  values: string[];
  errors: string[];
}

type AdminCheck = Awaited<ReturnType<typeof assertHomeConfigAdmin>>;
type HomeConfigSupabaseClient = Extract<AdminCheck, { ok: true }>["supabase"];

function isMissingColumnError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();

  return (
    error.code === "42703" ||
    (message.includes("column") && message.includes("does not exist")) ||
    message.includes("schema cache") ||
    message.includes("unknown column")
  );
}

function isNoRowsError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();

  return (
    error.code === "PGRST116" ||
    message.includes("contains 0 rows") ||
    message.includes("result contains 0 rows")
  );
}

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

function readStringField(formData: FormData, fieldName: string): StringFieldResult {
  const values = formData.getAll(fieldName);

  if (values.length === 0) {
    return { value: "", errors: [] };
  }

  if (values.length > 1) {
    const duplicateError =
      fieldName === "tiktokVideoUrls"
        ? TIKTOK_VIDEO_URLS_MULTIPLE_VALUES_ERROR
        : TIKTOK_ACCOUNT_URL_MULTIPLE_VALUES_ERROR;

    return { value: "", errors: [duplicateError] };
  }

  const value = values[0];

  if (typeof value !== "string") {
    const error =
      fieldName === "tiktokVideoUrls"
        ? TIKTOK_VIDEO_URLS_NOT_STRING_ERROR
        : TIKTOK_ACCOUNT_URL_NOT_STRING_ERROR;

    return { value: "", errors: [error] };
  }

  return { value, errors: [] };
}

function readStringArrayField(formData: FormData, fieldName: string): StringArrayFieldResult {
  const rawValue = readStringField(formData, fieldName);

  if (rawValue.errors.length > 0) {
    return { values: [], errors: rawValue.errors };
  }

  const trimmedValue = rawValue.value.trim();

  if (trimmedValue.length === 0) {
    return { values: [], errors: [] };
  }

  try {
    const parsedValue = JSON.parse(trimmedValue);

    if (!Array.isArray(parsedValue) || !parsedValue.every((item) => typeof item === "string")) {
      return {
        values: [],
        errors: [INVALID_TIKTOK_VIDEO_URL_LIST_ERROR],
      };
    }

    return { values: parsedValue, errors: [] };
  } catch {
    return {
      values: [],
      errors: [INVALID_TIKTOK_VIDEO_URL_LIST_ERROR],
    };
  }
}

function parseTikTokPayload(formData: FormData): {
  draft: ReturnType<typeof normalizeTikTokSettingsDraft>;
  errors: string[];
} {
  const accountField = readStringField(formData, "tiktokAccountUrl");
  const videosField = readStringArrayField(formData, "tiktokVideoUrls");
  const normalizedDraft = normalizeTikTokSettingsDraft({
    accountUrl: accountField.value,
    videoUrls: videosField.values,
  });

  return {
    draft: normalizedDraft,
    errors: [...accountField.errors, ...videosField.errors, ...validateTikTokSettingsDraft(normalizedDraft)],
  };
}

async function loadAdminTikTokSettings(supabase: HomeConfigSupabaseClient): Promise<{
  data: SiteSettingsRow | null;
  error: SupabaseLikeError | null;
}> {
  const primary = await supabase
    .from("site_settings")
    .select(TIKTOK_SELECT)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (!primary.error) {
    return {
      data: (primary.data as SiteSettingsRow | null) ?? null,
      error: null,
    };
  }

  if (!isMissingColumnError(primary.error)) {
    return { data: null, error: primary.error };
  }

  const fallback = await supabase
    .from("site_settings")
    .select(TIKTOK_FALLBACK_SELECT)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  return {
    data: fallback.error ? null : (fallback.data as SiteSettingsRow | null),
    error: fallback.error ? fallback.error : null,
  };
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const { data, error } = await loadAdminTikTokSettings(admin.supabase);

  if (error) {
    return supabaseErrorResponse(error, "Unable to load TikTok settings.");
  }

  return Response.json({
    settings: normalizeSiteSettingsRow((data as SiteSettingsRow | null) ?? null).tiktok,
    source: data ? "config" : "fallback",
  });
}

export async function PUT(request: Request) {
  const admin = await requireAdmin(request);

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

  const payload: TikTokSettingsUpdatePayload = {
    tiktok_account_url: draft.accountUrl,
    tiktok_video_urls: draft.videoUrls,
  };

  let saveResult = await admin.supabase
    .from("site_settings")
    .update(payload)
    .eq("id", SITE_SETTINGS_ID)
    .select(TIKTOK_SELECT)
    .single();

  if (isNoRowsError(saveResult.error)) {
    const insertPayload: TikTokSettingsInsertPayload = {
      id: SITE_SETTINGS_ID,
      site_name: DEFAULT_SITE_SETTINGS.siteName,
      ...payload,
    };

    saveResult = await admin.supabase
      .from("site_settings")
      .insert(insertPayload)
      .select(TIKTOK_SELECT)
      .single();
  }

  const { data, error } = saveResult;

  if (error) {
    return supabaseErrorResponse(error, "Unable to save TikTok settings.");
  }

  revalidateSiteSettingsCache();

  return Response.json({
    settings: normalizeSiteSettingsRow((data as SiteSettingsRow | null) ?? null).tiktok,
  });
}
