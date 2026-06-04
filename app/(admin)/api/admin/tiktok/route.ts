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

/**
 * Checks whether a Supabase-style error indicates a missing database column or related schema/cache issue.
 *
 * @param error - The Supabase-like error object to inspect (may be null/undefined)
 * @returns `true` if the error indicates a missing column or schema/cache problem, `false` otherwise
 */
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

/**
 * Determines whether a Supabase-style error indicates an empty result (no rows).
 *
 * @returns `true` if the error represents a "no rows" condition, `false` otherwise.
 */
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

/**
 * Builds a standardized JSON error response using a Supabase-style error or a fallback message.
 *
 * @param error - Optional Supabase-like error containing `message`, `code`, `details`, and `hint`
 * @param fallbackMessage - Message to use when `error.message` is not provided
 * @returns A JSON error response with the selected message, HTTP status 403, and `code`, `details`, and `hint` populated from the Supabase-like error when available
 */
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

/**
 * Authenticate the incoming request and produce either an authorized Supabase client for admin operations or an HTTP error response.
 *
 * @returns An object with `ok: true` and `supabase` when authentication and admin check succeed, or `ok: false` and a `Response` containing the appropriate HTTP error when authentication or authorization fails.
 */
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

/**
 * Reads a single string field from FormData, enforcing that at most one string value is provided and returning any validation errors.
 *
 * @param formData - The FormData object to read the field from.
 * @param fieldName - The name of the field to read; when `fieldName` is `"tiktokVideoUrls"` or `"tiktokAccountUrl"` the function returns field-specific error messages for duplicate or non-string values.
 * @returns An object with `value` set to the field string (empty if missing or invalid) and `errors` containing zero or more validation messages.
 */
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

/**
 * Parse a FormData field expected to contain a JSON-encoded array of strings.
 *
 * Reads `fieldName` from `formData`, preserves any read errors, and returns:
 * - `values` as the parsed string array when the field contains a valid JSON array of strings,
 * - an empty `values` array with no errors when the field is missing or contains only whitespace,
 * - an empty `values` array and `errors` containing `INVALID_TIKTOK_VIDEO_URL_LIST_ERROR` when the field contains invalid JSON or a value that is not an array of strings.
 *
 * @param formData - The multipart form data to read from.
 * @param fieldName - The field name that holds the JSON-encoded array of strings.
 * @returns An object with `values` (the parsed string array) and `errors` (validation or parsing errors).
 */
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

/**
 * Parse TikTok settings fields from multipart FormData into a normalized draft and collect validation errors.
 *
 * @param formData - FormData expected to contain `tiktokAccountUrl` (single string) and `tiktokVideoUrls` (JSON-encoded array string)
 * @returns An object with `draft` (the normalized TikTok settings draft) and `errors` (array of validation error messages; empty if no issues)
 */
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

/**
 * Load TikTok-related site settings, using a fallback query when the TikTok columns are missing.
 *
 * @returns An object with:
 * - `data`: the `site_settings` row containing TikTok fields when available, or `null` if not found.
 * - `error`: a Supabase-style error object when the query failed, or `null` on success.
 */
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

/**
 * Serve the admin GET endpoint that returns the TikTok settings and which data source was used.
 *
 * @returns A Response whose JSON has:
 *  - `settings`: the normalized TikTok settings object (may be empty when using fallback)
 *  - `source`: `"config"` if settings were loaded from the `site_settings` row, `"fallback"` if a fallback row was used
 */
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

/**
 * Handles authenticated updates to TikTok settings submitted as multipart/form-data.
 *
 * @returns A `Response` whose JSON body varies by outcome:
 * - Success: `{ settings: <tiktok-settings> }` with the saved TikTok settings.
 * - Validation error: status `400` and `{ errors: string[] }` for malformed input.
 * - Authentication/authorization failure: the JSON error response produced by the auth helper.
 * - Supabase failure: a JSON error response (status `403`) describing the persistence error.
 */
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
