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

export function normalizeImageRows(rows: SupabaseImageRow[]): VillaImage[] {
  return rows
    .filter((row) => row.image_url)
    .map((row) => ({
      id: row.id,
      imageUrl: row.image_url as string,
      imageName: row.image_name,
      caption: row.caption,
      isCover: (row.cover_select ?? 0) > 0,
      zone: row.image_zone,
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing");
  }

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

  return normalizeImageRows((data ?? []) as SupabaseImageRow[]);
}
