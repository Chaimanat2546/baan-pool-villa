import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { VillaImage } from "./types";

type SupabaseImageRow = {
  id: number;
  property_id: number;
  cover_select: number | null;
  image_name: string | null;
  image_url: string | null;
  caption: string | null;
  image_zone: string | null;
};

const DEFAULT_SUPABASE_URL = "https://rqizfiayvcbozlzuvbok.supabase.co";
const DEFAULT_IMAGE_PROXY_BASE_URL =
  "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/";

function normalizeNullableText(value: string | null): string | null {
  const trimmedValue = value?.trim();

  if (!trimmedValue || trimmedValue.toLowerCase() === "null") {
    return null;
  }

  return trimmedValue;
}

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    DEFAULT_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseKey) {
    throw new Error("Supabase publishable key is missing");
  }

  return { supabaseUrl, supabaseKey };
}

export function normalizeImageUrl(
  imageUrl: string | null,
  supabaseUrl = DEFAULT_SUPABASE_URL,
): string | null {
  const trimmedUrl = imageUrl?.trim();

  if (!trimmedUrl) {
    return null;
  }

  try {
    return new URL(trimmedUrl).toString();
  } catch {
    return new URL(trimmedUrl.replace(/^\/+/, ""), `${supabaseUrl}/`).toString();
  }
}

export function buildProxyImageUrl(
  imageName: string | null,
  proxyBaseUrl = DEFAULT_IMAGE_PROXY_BASE_URL,
): string | null {
  const trimmedImageName = imageName?.trim();

  if (!trimmedImageName) {
    return null;
  }

  return new URL(encodeURIComponent(trimmedImageName), proxyBaseUrl).toString();
}

export function normalizeImageRows(
  rows: SupabaseImageRow[],
  supabaseUrl = DEFAULT_SUPABASE_URL,
  proxyBaseUrl = process.env.IMAGE_PROXY_BASE_URL ?? DEFAULT_IMAGE_PROXY_BASE_URL,
): VillaImage[] {
  return rows
    .map((row) => ({
      row,
      imageUrl:
        buildProxyImageUrl(row.image_name, proxyBaseUrl) ??
        normalizeImageUrl(row.image_url, supabaseUrl),
    }))
    .filter((item): item is { row: SupabaseImageRow; imageUrl: string } =>
      Boolean(item.imageUrl),
    )
    .map((row) => ({
      id: row.row.id,
      imageUrl: row.imageUrl,
      imageName: normalizeNullableText(row.row.image_name),
      caption: normalizeNullableText(row.row.caption),
      isCover: (row.row.cover_select ?? 0) > 0,
      zone: normalizeNullableText(row.row.image_zone),
    }));
}

export function parseVillaId(id: string): number {
  if (!/^[1-9]\d*$/.test(id)) {
    throw new Error("Invalid villa id");
  }

  const villaId = Number(id);

  if (!Number.isSafeInteger(villaId)) {
    throw new Error("Invalid villa id");
  }

  return villaId;
}

export async function fetchVillaImages(id: string): Promise<VillaImage[]> {
  const villaId = parseVillaId(id);
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase
    .from("images")
    .select("id, property_id, cover_select, image_name, image_url, caption, image_zone")
    .eq("property_id", villaId)
    .order("cover_select", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return normalizeImageRows((data ?? []) as SupabaseImageRow[], supabaseUrl);
}
