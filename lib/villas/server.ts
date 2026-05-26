import "server-only";

import { fetchVillaImages } from "./images";
import { normalizeHouses } from "./normalize";
import type { RawHouse, VillaDetailPayload, VillaImage, VillaListing } from "./types";

const HOUSE_LIST_URL = "https://www.devillegroups.com/api/json/getHouse_deville.json";
const DETAIL_URL = "https://deville-central.com/api/getAccommodation.php";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("External API returned invalid JSON");
  }
}

export async function fetchHouseListings(): Promise<VillaListing[]> {
  const response = await fetch(HOUSE_LIST_URL, {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`House list API failed with ${response.status}`);
  }

  const data = await readJson<RawHouse[]>(response);
  return normalizeHouses(Array.isArray(data) ? data : []);
}

export async function getListingById(id: string): Promise<VillaListing | null> {
  const listings = await fetchHouseListings();
  return listings.find((listing) => listing.id === id) ?? null;
}

export async function fetchVillaDetail(id: string): Promise<VillaDetailPayload | null> {
  const listing = await getListingById(id);

  if (!listing) {
    return null;
  }

  const token = process.env.DEVILLE_BEARER_TOKEN;

  if (!token) {
    return {
      listing,
      detail: null,
      detailStatus: "missing_token",
    };
  }

  const url = new URL(DETAIL_URL);
  url.searchParams.set("hid", id);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        listing,
        detail: null,
        detailStatus: "unavailable",
      };
    }

    return {
      listing,
      detail: await readJson<unknown>(response),
      detailStatus: "available",
    };
  } catch {
    return {
      listing,
      detail: null,
      detailStatus: "unavailable",
    };
  }
}

export type VillaPageData = {
  payload: VillaDetailPayload;
  images: VillaImage[];
};

export async function fetchVillaPageData(
  id: string,
): Promise<VillaPageData | null> {
  const payload = await fetchVillaDetail(id);

  if (!payload) {
    return null;
  }

  try {
    return {
      payload,
      images: await fetchVillaImages(id),
    };
  } catch (error) {
    console.error("Unable to load villa gallery images", error);

    return {
      payload,
      images: [],
    };
  }
}
