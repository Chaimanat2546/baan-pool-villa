import "server-only";

import { unstable_cache } from "next/cache";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { createHomeConfigClient } from "@/lib/home-sections/supabase";
import {
  DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
  type HomepageCustomerReviewData,
  type HomepageCustomerReviewImage,
  toPublicCustomerReviewHomepageLayout,
} from "./types";

interface CustomerReviewImageRow {
  alt?: unknown;
  homepage_order?: unknown;
  id?: unknown;
  public_url?: unknown;
}

interface CustomerReviewSettingsRow {
  layout?: unknown;
}

function mapHomepageCustomerReviewImage(
  row: CustomerReviewImageRow,
): HomepageCustomerReviewImage | null {
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const url = typeof row.public_url === "string" ? row.public_url.trim() : "";
  const order =
    typeof row.homepage_order === "number" && Number.isInteger(row.homepage_order)
      ? row.homepage_order
      : 0;

  if (!id || !url || order < 1) {
    return null;
  }

  const alt = typeof row.alt === "string" && row.alt.trim()
    ? row.alt.trim()
    : "รีวิวจากลูกค้า";

  return { alt, id, order, url };
}

async function loadHomepageCustomerReviewData(): Promise<HomepageCustomerReviewData> {
  try {
    const supabase = createHomeConfigClient();
    const settingsResult = await supabase
      .from("customer_review_homepage_settings")
      .select("layout")
      .eq("singleton_id", true)
      .maybeSingle();
    const imageResult = await supabase
      .from("customer_review_images")
      .select("id,public_url,alt,homepage_order")
      .eq("is_active", true)
      .eq("is_homepage", true)
      .order("homepage_order", { ascending: true })
      .limit(20);

    if (settingsResult.error || imageResult.error || !Array.isArray(imageResult.data)) {
      return {
        images: [],
        layout: DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
      };
    }

    return {
      images: imageResult.data
        .map((row) => mapHomepageCustomerReviewImage(row as CustomerReviewImageRow))
        .filter((image): image is HomepageCustomerReviewImage => image !== null)
        .sort((a, b) => a.order - b.order)
        .slice(0, 20),
      layout: toPublicCustomerReviewHomepageLayout(
        (settingsResult.data as CustomerReviewSettingsRow | null)?.layout,
      ),
    };
  } catch {
    return {
      images: [],
      layout: DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
    };
  }
}

export const getHomepageCustomerReviewData = unstable_cache(
  loadHomepageCustomerReviewData,
  [CACHE_TAGS.customerReviews],
  {
    revalidate: CACHE_REVALIDATE_SECONDS.customerReviews,
    tags: [CACHE_TAGS.customerReviews],
  },
);
