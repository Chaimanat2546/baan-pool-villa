import type {
  HomeConfigSupabaseClient,
  SupabaseLikeError,
} from "@/lib/admin/route-helpers";
import { adminSupabaseErrorResponse } from "@/lib/admin/route-helpers";
import { revalidateSiteSettingsCache } from "@/lib/cache-revalidation";
import { resolveTikTokVillaLinks, validateTikTokVideoHouseIds } from "@/lib/tiktok/villa-links";
import { fetchHouseListings } from "@/lib/villas/server";
import type { VillaListing } from "@/lib/villas/types";
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
  tiktok_video_urls: Array<{ houseId?: string; url: string }>;
}

export interface TikTokSettingsInsertPayload extends TikTokSettingsUpdatePayload {
  id: string;
  site_name: string;
}

interface StringFieldResult {
  value: string;
  errors: string[];
}

interface TikTokVideosFieldResult {
  values: TikTokSettingsVideoInput[];
  errors: string[];
}

interface TikTokSettingsVideoInput {
  houseId: string | null;
  url: string;
}

export type AdminTikTokSettingsSource = "config" | "fallback" | "none";

async function addTikTokVillaTitles(
  settings: ReturnType<typeof normalizeSiteSettingsRow>["tiktok"],
  cachedVillas?: readonly VillaListing[],
) {
  if (!settings.videos.some((video) => video.houseId)) {
    return settings;
  }

  let villas = cachedVillas;

  if (!villas) {
    try {
      villas = await fetchHouseListings();
    } catch {
      return settings;
    }
  }

  return {
    ...settings,
    videos: resolveTikTokVillaLinks(settings.videos, villas).map(({ villa, ...video }) => ({
      ...video,
      ...(villa ? { villaTitle: villa.title } : {}),
    })),
  };
}

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
      fieldName === "tiktokVideoUrls" || fieldName === "tiktokVideos"
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

function readTikTokVideosField(
  formData: FormData,
): TikTokVideosFieldResult {
  const primaryValues = formData.getAll("tiktokVideos");
  const fieldName = primaryValues.length > 0 ? "tiktokVideos" : "tiktokVideoUrls";
  const rawValue = readStringField(formData, fieldName);

  if (rawValue.errors.length > 0) {
    return { values: [], errors: rawValue.errors };
  }

  const trimmedValue = rawValue.value.trim();

  if (trimmedValue.length === 0) {
    return { values: [], errors: [] };
  }

  try {
    const parsedValue: unknown = JSON.parse(trimmedValue);

    if (!Array.isArray(parsedValue)) {
      return {
        values: [],
        errors: [INVALID_TIKTOK_VIDEO_URL_LIST_ERROR],
      };
    }

    const videos = parsedValue.map((item): TikTokSettingsVideoInput | null => {
      if (typeof item === "string") {
        return { houseId: null, url: item.trim() };
      }

      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return null;
      }

      const video = item as Record<string, unknown>;

      if (typeof video.url !== "string") {
        return null;
      }

      const rawHouseId = video.houseId;

      if (rawHouseId !== undefined && rawHouseId !== null && typeof rawHouseId !== "string") {
        return null;
      }

      return {
        houseId: typeof rawHouseId === "string" ? rawHouseId.trim() || null : null,
        url: video.url.trim(),
      };
    });

    if (videos.some((video) => video === null)) {
      return {
        values: [],
        errors: [INVALID_TIKTOK_VIDEO_URL_LIST_ERROR],
      };
    }

    return {
      values: videos.filter((video): video is TikTokSettingsVideoInput => video !== null),
      errors: [],
    };
  } catch {
    return {
      values: [],
      errors: [INVALID_TIKTOK_VIDEO_URL_LIST_ERROR],
    };
  }
}

export function parseTikTokPayload(formData: FormData): {
  draft: {
    accountUrl: string;
    videos: TikTokSettingsVideoInput[];
  };
  errors: string[];
} {
  const accountField = readStringField(formData, "tiktokAccountUrl");
  const videosField = readTikTokVideosField(formData);
  const normalizedDraft = normalizeTikTokSettingsDraft({
    accountUrl: accountField.value,
    videoUrls: videosField.values.map((video) => video.url),
  });

  const videos = videosField.values
    .map((video) => ({
      houseId: video.houseId,
      url: video.url.trim(),
    }))
    .filter((video) => video.url.length > 0);

  return {
    draft: {
      accountUrl: normalizedDraft.accountUrl,
      videos,
    },
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
  draft: {
    accountUrl: string;
    videos: TikTokSettingsVideoInput[];
  },
): TikTokSettingsUpdatePayload {
  return {
    tiktok_account_url: draft.accountUrl,
    tiktok_video_urls: draft.videos.map((video) => ({
      ...(video.houseId ? { houseId: video.houseId } : {}),
      url: video.url,
    })),
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

  const settings = normalizeSiteSettingsRow((data as SiteSettingsRow | null) ?? null).tiktok;

  return Response.json({
    settings: await addTikTokVillaTitles(settings),
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

  let validatedVillas: VillaListing[] | undefined;

  if (draft.videos.some((video) => video.houseId)) {

    try {
      validatedVillas = await fetchHouseListings();
    } catch {
      return Response.json(
        { errors: ["ไม่สามารถตรวจสอบบ้านพักได้ในขณะนี้"] },
        { status: 500 },
      );
    }

    const houseIdErrors = validateTikTokVideoHouseIds(
      draft.videos,
      validatedVillas,
    );

    if (houseIdErrors.length > 0) {
      return Response.json({ errors: houseIdErrors }, { status: 400 });
    }
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

  const settings = normalizeSiteSettingsRow((data as SiteSettingsRow | null) ?? null).tiktok;

  return Response.json({
    settings: await addTikTokVillaTitles(settings, validatedVillas),
    source: data ? "config" : "none",
  });
}
