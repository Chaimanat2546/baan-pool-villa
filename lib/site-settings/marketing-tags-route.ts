import type {
  HomeConfigSupabaseClient,
  SupabaseLikeError,
} from "@/lib/admin/route-helpers";
import { adminSupabaseErrorResponse } from "@/lib/admin/route-helpers";
import { revalidateSiteSettingsCache } from "@/lib/cache-revalidation";
import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID } from "./defaults";
import type { SiteSettingsRow } from "./types";
import {
  normalizeGoogleTagManagerId,
  validateGoogleTagManagerId,
} from "./validation";

export const MARKETING_TAGS_SELECT = "id,google_tag_manager_id";

const MARKETING_TAGS_FALLBACK_SELECT = "id";
const GTM_ID_NOT_STRING_ERROR = "ฟิลด์ googleTagManagerId ต้องเป็นข้อความ";
const GTM_ID_MULTIPLE_VALUES_ERROR =
  "ฟิลด์ googleTagManagerId ต้องระบุได้เพียงหนึ่งค่า";

export type MarketingTagsSource = "config" | "fallback" | "none";

export interface MarketingTagsSettings {
  googleTagManagerId: string;
}

export interface MarketingTrackingSurface {
  description: string;
  eventName: string;
  path: string;
  status: "pageview" | "ready" | "planned";
  title: string;
}

export const MARKETING_TRACKING_SURFACES: MarketingTrackingSurface[] = [
  {
    description: "GTM script ทำงานทุก public route เมื่อมี GTM ID",
    eventName: "page_view",
    path: "ทุก public page",
    status: "pageview",
    title: "ทุกหน้าเว็บไซต์",
  },
  {
    description: "ส่งข้อมูลบ้านพักสำหรับ Dynamic Remarketing และ GA4 ecommerce",
    eventName: "view_item",
    path: "/villas/[id]",
    status: "ready",
    title: "หน้ารายละเอียดบ้านพัก",
  },
  {
    description: "วัดคลิกปุ่มจองผ่าน LINE พร้อม item_id, item_name และ price",
    eventName: "booking_contact_click",
    path: "/villas/[id]#contact",
    status: "ready",
    title: "ปุ่มจองผ่าน LINE",
  },
  {
    description: "วัดคลิกปุ่ม Messenger พร้อมข้อมูลบ้านพักใน booking sidebar",
    eventName: "booking_contact_click",
    path: "/villas/[id]#contact",
    status: "ready",
    title: "ปุ่ม Messenger",
  },
  {
    description: "มี GTM pageview แล้ว แต่ยังไม่มี context บ้านพักเฉพาะรายการ",
    eventName: "page_view",
    path: "/search",
    status: "pageview",
    title: "หน้าค้นหา",
  },
  {
    description: "มี GTM pageview แล้ว เหมาะต่อยอดเป็น content engagement",
    eventName: "page_view",
    path: "/guides และ /guides/[slug]",
    status: "pageview",
    title: "บทความ",
  },
];

interface StringFieldResult {
  errors: string[];
  value: string;
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

function readStringField(formData: FormData, fieldName: string): StringFieldResult {
  const values = formData.getAll(fieldName);

  if (values.length === 0) {
    return { errors: [], value: "" };
  }

  if (values.length > 1) {
    return { errors: [GTM_ID_MULTIPLE_VALUES_ERROR], value: "" };
  }

  const value = values[0];

  if (typeof value !== "string") {
    return { errors: [GTM_ID_NOT_STRING_ERROR], value: "" };
  }

  return { errors: [], value };
}

function toMarketingTagsSettings(
  row: SiteSettingsRow | null,
): MarketingTagsSettings {
  return {
    googleTagManagerId: normalizeGoogleTagManagerId(row?.google_tag_manager_id),
  };
}

export function parseMarketingTagsPayload(formData: FormData): {
  errors: string[];
  settings: MarketingTagsSettings;
} {
  const googleTagManagerIdField = readStringField(
    formData,
    "googleTagManagerId",
  );
  const googleTagManagerId = normalizeGoogleTagManagerId(
    googleTagManagerIdField.value,
  );

  return {
    errors: [
      ...googleTagManagerIdField.errors,
      ...validateGoogleTagManagerId(googleTagManagerIdField.value),
    ],
    settings: {
      googleTagManagerId,
    },
  };
}

export async function loadAdminMarketingTags(
  supabase: HomeConfigSupabaseClient,
): Promise<{
  data: SiteSettingsRow | null;
  error: SupabaseLikeError | null;
  source: MarketingTagsSource;
}> {
  const primary = await supabase
    .from("site_settings")
    .select(MARKETING_TAGS_SELECT)
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
    .select(MARKETING_TAGS_FALLBACK_SELECT)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  return {
    data: fallback.error ? null : (fallback.data as SiteSettingsRow | null),
    error: fallback.error ? fallback.error : null,
    source: fallback.data ? "fallback" : "none",
  };
}

function marketingTagsResponse(
  settings: MarketingTagsSettings,
  source: MarketingTagsSource,
) {
  return Response.json({
    settings,
    source,
    trackingSurfaces: MARKETING_TRACKING_SURFACES,
  });
}

export async function buildAdminMarketingTagsResponse(
  supabase: HomeConfigSupabaseClient,
) {
  const { data, error, source } = await loadAdminMarketingTags(supabase);

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to load marketing tags.");
  }

  return marketingTagsResponse(
    toMarketingTagsSettings((data as SiteSettingsRow | null) ?? null),
    source,
  );
}

export async function saveAdminMarketingTags(
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

  const { errors, settings } = parseMarketingTagsPayload(formData);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const payload = {
    google_tag_manager_id: settings.googleTagManagerId,
  };

  let saveResult = await supabase
    .from("site_settings")
    .update(payload)
    .eq("id", SITE_SETTINGS_ID)
    .select(MARKETING_TAGS_SELECT)
    .single();

  if (isNoRowsError(saveResult.error)) {
    saveResult = await supabase
      .from("site_settings")
      .insert({
        id: SITE_SETTINGS_ID,
        site_name: DEFAULT_SITE_SETTINGS.siteName,
        ...payload,
      })
      .select(MARKETING_TAGS_SELECT)
      .single();
  }

  const { data, error } = saveResult;

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to save marketing tags.");
  }

  await revalidateSiteSettingsCache();

  return marketingTagsResponse(
    toMarketingTagsSettings((data as SiteSettingsRow | null) ?? null),
    data ? "config" : "none",
  );
}
