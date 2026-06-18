import type {
  HomeConfigSupabaseClient,
  SupabaseLikeError,
} from "@/lib/admin/route-helpers";
import { adminSupabaseErrorResponse } from "@/lib/admin/route-helpers";
import { revalidateSiteSettingsCache } from "@/lib/cache-revalidation";
import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID } from "./defaults";
import type { SiteSettingsRow } from "./types";
import {
  normalizeSiteSettingsRow,
  normalizeTikTokSettingsDraft,
  validateTikTokSettingsDraft,
} from "./validation";

export const TIKTOK_SELECT = "id,tiktok_account_url,tiktok_video_urls";

const TIKTOK_FALLBACK_SELECT = "id";
const INVALID_TIKTOK_VIDEO_URL_LIST_ERROR =
  "รายการวิดีโอ TikTok ต้องเป็นรายการลิงก์ที่ถูกต้อง";
const TIKTOK_ACCOUNT_URL_NOT_STRING_ERROR = "ค่าฟิลด์ tiktokAccountUrl ต้องเป็นข้อความ";
const TIKTOK_VIDEO_URLS_NOT_STRING_ERROR = "ค่าฟิลด์ tiktokVideoUrls ต้องเป็นข้อความ";
const TIKTOK_ACCOUNT_URL_MULTIPLE_VALUES_ERROR = "ฟิลด์ tiktokAccountUrl ต้องระบุได้เพียงหนึ่งค่า";
const TIKTOK_VIDEO_URLS_MULTIPLE_VALUES_ERROR = "ฟิลด์ tiktokVideoUrls ต้องระบุได้เพียงหนึ่งค่า";

export interface TikTokSettingsUpdatePayload {
  tiktok_account_url: string;
  tiktok_video_urls: string[];
}

export interface TikTokSettingsInsertPayload extends TikTokSettingsUpdatePayload {
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

export type AdminTikTokSettingsSource = "config" | "fallback" | "none";

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

export function isNoRowsError(error: SupabaseLikeError | null | undefined): boolean {
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

function readStringArrayField(
  formData: FormData,
  fieldName: string,
): StringArrayFieldResult {
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

export function parseTikTokPayload(formData: FormData): {
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
    errors: [
      ...accountField.errors,
      ...videosField.errors,
      ...validateTikTokSettingsDraft(normalizedDraft),
    ],
  };
}

export async function loadAdminTikTokSettings(
  supabase: HomeConfigSupabaseClient,
): Promise<{
  data: SiteSettingsRow | null;
  error: SupabaseLikeError | null;
  source: AdminTikTokSettingsSource;
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
      source: primary.data ? "config" : "none",
    };
  }

  if (!isMissingColumnError(primary.error)) {
    return { data: null, error: primary.error, source: "none" };
  }

  const fallback = await supabase
    .from("site_settings")
    .select(TIKTOK_FALLBACK_SELECT)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  return {
    data: fallback.error ? null : (fallback.data as SiteSettingsRow | null),
    error: fallback.error ? fallback.error : null,
    source: fallback.data ? "fallback" : "none",
  };
}

export function toTikTokUpdatePayload(
  draft: ReturnType<typeof normalizeTikTokSettingsDraft>,
): TikTokSettingsUpdatePayload {
  return {
    tiktok_account_url: draft.accountUrl,
    tiktok_video_urls: draft.videoUrls,
  };
}

export function toTikTokInsertPayload(
  payload: TikTokSettingsUpdatePayload,
): TikTokSettingsInsertPayload {
  return {
    id: SITE_SETTINGS_ID,
    site_name: DEFAULT_SITE_SETTINGS.siteName,
    ...payload,
  };
}

export async function buildAdminTikTokSettingsResponse(
  supabase: HomeConfigSupabaseClient,
) {
  const { data, error, source } = await loadAdminTikTokSettings(supabase);

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to load TikTok settings.");
  }

  return Response.json({
    settings: normalizeSiteSettingsRow((data as SiteSettingsRow | null) ?? null).tiktok,
    source,
  });
}

export async function saveAdminTikTokSettings(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
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

  let saveResult = await supabase
    .from("site_settings")
    .update(payload)
    .eq("id", SITE_SETTINGS_ID)
    .select(TIKTOK_SELECT)
    .single();

  if (isNoRowsError(saveResult.error)) {
    saveResult = await supabase
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
