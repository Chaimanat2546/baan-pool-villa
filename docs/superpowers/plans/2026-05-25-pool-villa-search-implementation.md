# Pool Villa Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a searchable pool villa website with internal API proxy routes, a premium single-bar search UI, and `/villas/[id]` detail pages backed by Deville and Supabase data.

**Architecture:** Keep all external data access behind Next.js App Router route handlers. The browser calls `/api/houses`, `/api/villas/[id]`, and `/api/villas/[id]/images`; shared server utilities normalize Deville responses and Supabase image rows. Client components handle dropdown search interactions and filtering after the internal API returns normalized data.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest, Supabase JavaScript client, lucide-react icons.

---

## File Structure

- `package.json`, `package-lock.json`: add `@supabase/supabase-js`, `lucide-react`, `server-only`, and `vitest`; add `test` script.
- `next.config.ts`: allow remote images from Deville and Supabase hosts.
- `app/layout.tsx`: update Thai metadata and root language.
- `app/globals.css`: replace scaffold styling with the villa theme tokens and base styles.
- `lib/villas/types.ts`: shared DTOs for raw Deville rows, normalized listings, filters, detail response, and image rows.
- `lib/villas/amenities.ts`: amenity key map, Thai labels, and helpers.
- `lib/villas/normalize.ts`: pure normalization from raw Deville rows to frontend-safe listings.
- `lib/villas/filters.ts`: pure client-side filter function.
- `lib/villas/server.ts`: server-only external API helpers for Deville list/detail data.
- `lib/villas/images.ts`: server-only Supabase image query and image row normalization.
- `app/api/houses/route.ts`: list proxy route.
- `app/api/villas/[id]/route.ts`: detail proxy route.
- `app/api/villas/[id]/images/route.ts`: image proxy route.
- `components/villas/search-bar.tsx`: reference-style search bar with location dropdown, amenity dropdown, guest/bedroom inputs, max price slider, and submit button.
- `components/villas/villa-card.tsx`: villa listing card.
- `components/villas/villa-grid.tsx`: result grid, empty state, and count header.
- `components/villas/home-page.tsx`: client data loading and filter state for the search page.
- `components/villas/detail-page.tsx`: client data loading and detail display for `/villas/[id]`.
- `app/page.tsx`: route shell for the search page.
- `app/villas/[id]/page.tsx`: route shell for the detail page.
- `app/villas/[id]/loading.tsx`: route loading state.
- `app/villas/[id]/not-found.tsx`: route 404 state.
- `lib/villas/__tests__/normalize.test.ts`: normalization tests.
- `lib/villas/__tests__/filters.test.ts`: filter tests.
- `lib/villas/__tests__/images.test.ts`: Supabase image normalization tests.

---

## Task 1: Dependencies And Project Baseline

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `next.config.ts`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Install runtime and test dependencies**

Run:

```powershell
npm install @supabase/supabase-js lucide-react server-only
npm install -D vitest
```

Expected: `package.json` and `package-lock.json` include the new packages.

- [ ] **Step 2: Add the test script**

Modify `package.json` scripts to:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Configure remote images**

Replace `next.config.ts` with:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "devillegroups.com",
        pathname: "/imgs/profile_imgs_large/**",
      },
      {
        protocol: "https",
        hostname: "www.devillegroups.com",
        pathname: "/imgs/profile_imgs_large/**",
      },
      {
        protocol: "https",
        hostname: "rqizfiayvcbozlzuvbok.supabase.co",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 4: Update root metadata**

Replace `app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Baan Pool Villa",
  description: "ค้นหาบ้านพักพูลวิลล่าพัทยา",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#f4f7f4] text-[#063f35]">{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Update global CSS**

Replace `app/globals.css` with:

```css
@import "tailwindcss";

:root {
  --background: #f4f7f4;
  --foreground: #063f35;
  --surface: #ffffff;
  --villa-green: #064d3d;
  --villa-green-dark: #04382d;
  --villa-teal: #0f5a66;
  --villa-gold: #f6ad21;
  --villa-border: #dbe7e3;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: "Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", "Geist Mono Fallback", ui-monospace, monospace;
}

* {
  box-sizing: border-box;
}

html {
  background: var(--background);
}

body {
  margin: 0;
  background:
    radial-gradient(circle at top left, rgba(15, 90, 102, 0.14), transparent 34rem),
    linear-gradient(180deg, #f8fbf7 0%, #eef5f1 100%);
  color: var(--foreground);
  font-family: var(--font-geist-sans), "Noto Sans Thai", ui-sans-serif, system-ui, sans-serif;
}

button,
input,
select {
  font: inherit;
}
```

- [ ] **Step 6: Verify baseline**

Run:

```powershell
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add package.json package-lock.json next.config.ts app/layout.tsx app/globals.css
git commit -m "chore: configure villa app baseline"
```

---

## Task 2: Shared Villa Types, Amenities, And Normalization

**Files:**
- Create: `lib/villas/types.ts`
- Create: `lib/villas/amenities.ts`
- Create: `lib/villas/normalize.ts`
- Create: `lib/villas/__tests__/normalize.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Create `lib/villas/__tests__/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeHouse } from "../normalize";
import type { RawHouse } from "../types";

const rawHouse: RawHouse = {
  h_id: "9",
  h_zone: "pattaya",
  h_bedroom: "6",
  h_toilet: "6",
  h_farsea: "5.6 กม",
  wifi: "y",
  grill: "y",
  pet: "n",
  snooker: "y",
  discotech: "n",
  fancyring: "y",
  tabletennis: "n",
  slider: "y",
  billard: "n",
  swimming_kid: "y",
  swim: "chlorine",
  karaoke: "y",
  airhockey: "n",
  jacuzzi: "n",
  bath: "n",
  img_name: "cover.jpg",
  price: "8000",
  people: "9",
};

describe("normalizeHouse", () => {
  it("maps Deville list fields into a safe listing DTO", () => {
    expect(normalizeHouse(rawHouse)).toEqual({
      id: "9",
      zone: "pattaya",
      zoneLabel: "พัทยา",
      bedrooms: 6,
      bathrooms: 6,
      distanceToSea: "5.6 กม",
      price: 8000,
      people: 9,
      coverImage: "https://devillegroups.com/imgs/profile_imgs_large/cover.jpg",
      poolType: "chlorine",
      amenities: [
        { key: "wifi", label: "Wi-Fi" },
        { key: "grill", label: "เตาปิ้งย่าง" },
        { key: "snooker", label: "สนุกเกอร์" },
        { key: "fancyring", label: "ห่วงยางแฟนซี" },
        { key: "slider", label: "สไลเดอร์" },
        { key: "swimming_kid", label: "สระเด็ก" },
        { key: "karaoke", label: "คาราโอเกะ" },
      ],
    });
  });

  it("returns null cover image when img_name is missing", () => {
    expect(normalizeHouse({ ...rawHouse, img_name: null }).coverImage).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- lib/villas/__tests__/normalize.test.ts
```

Expected: FAIL because `lib/villas/normalize.ts` does not exist.

- [ ] **Step 3: Create shared types**

Create `lib/villas/types.ts`:

```ts
export type AmenityKey =
  | "wifi"
  | "grill"
  | "pet"
  | "snooker"
  | "discotech"
  | "fancyring"
  | "tabletennis"
  | "slider"
  | "billard"
  | "swimming_kid"
  | "karaoke"
  | "airhockey"
  | "jacuzzi"
  | "bath";

export type Amenity = {
  key: AmenityKey;
  label: string;
};

export type RawHouse = {
  h_id: string | number;
  h_zone: string | null;
  h_bedroom: string | number | null;
  h_toilet: string | number | null;
  h_farsea: string | null;
  price: string | number | null;
  people: string | number | null;
  img_name: string | null;
  swim: string | null;
} & Record<AmenityKey, "y" | "n" | string | null>;

export type VillaListing = {
  id: string;
  zone: string;
  zoneLabel: string;
  bedrooms: number;
  bathrooms: number;
  distanceToSea: string;
  price: number;
  people: number;
  coverImage: string | null;
  amenities: Amenity[];
  poolType: string;
};

export type VillaFilters = {
  zone: string;
  guests: number;
  bedrooms: number;
  amenities: AmenityKey[];
  maxPrice: number;
};

export type VillaImage = {
  id: number;
  imageUrl: string;
  imageName: string | null;
  caption: string | null;
  isCover: boolean;
  zone: string | null;
};

export type VillaDetailPayload = {
  listing: VillaListing;
  detail: unknown;
  detailStatus: "available" | "missing_token" | "unavailable";
};
```

- [ ] **Step 4: Create amenity definitions**

Create `lib/villas/amenities.ts`:

```ts
import type { Amenity, AmenityKey, RawHouse } from "./types";

export const AMENITY_OPTIONS: Amenity[] = [
  { key: "wifi", label: "Wi-Fi" },
  { key: "grill", label: "เตาปิ้งย่าง" },
  { key: "pet", label: "นำสัตว์เลี้ยงได้" },
  { key: "snooker", label: "สนุกเกอร์" },
  { key: "discotech", label: "ไฟเธค" },
  { key: "fancyring", label: "ห่วงยางแฟนซี" },
  { key: "tabletennis", label: "โต๊ะปิงปอง" },
  { key: "slider", label: "สไลเดอร์" },
  { key: "billard", label: "โต๊ะพูล" },
  { key: "swimming_kid", label: "สระเด็ก" },
  { key: "karaoke", label: "คาราโอเกะ" },
  { key: "airhockey", label: "แอร์ฮอกกี้" },
  { key: "jacuzzi", label: "จากุซซี่" },
  { key: "bath", label: "อ่างอาบน้ำ" },
];

export const AMENITY_LABELS = Object.fromEntries(
  AMENITY_OPTIONS.map((amenity) => [amenity.key, amenity.label]),
) as Record<AmenityKey, string>;

export function getHouseAmenities(house: RawHouse): Amenity[] {
  return AMENITY_OPTIONS.filter((amenity) => house[amenity.key] === "y");
}
```

- [ ] **Step 5: Create normalizer**

Create `lib/villas/normalize.ts`:

```ts
import { getHouseAmenities } from "./amenities";
import type { RawHouse, VillaListing } from "./types";

const PROFILE_IMAGE_BASE = "https://devillegroups.com/imgs/profile_imgs_large";

const ZONE_LABELS: Record<string, string> = {
  pattaya: "พัทยา",
};

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getZoneLabel(zone: string): string {
  return ZONE_LABELS[zone] ?? zone;
}

export function normalizeHouse(house: RawHouse): VillaListing {
  const zone = house.h_zone?.trim() || "unknown";
  const imageName = house.img_name?.trim();

  return {
    id: String(house.h_id),
    zone,
    zoneLabel: getZoneLabel(zone),
    bedrooms: toNumber(house.h_bedroom),
    bathrooms: toNumber(house.h_toilet),
    distanceToSea: house.h_farsea?.trim() || "-",
    price: toNumber(house.price),
    people: toNumber(house.people),
    coverImage: imageName ? `${PROFILE_IMAGE_BASE}/${imageName}` : null,
    amenities: getHouseAmenities(house),
    poolType: house.swim?.trim() || "-",
  };
}

export function normalizeHouses(houses: RawHouse[]): VillaListing[] {
  return houses.map(normalizeHouse);
}
```

- [ ] **Step 6: Verify tests pass**

Run:

```powershell
npm run test -- lib/villas/__tests__/normalize.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add lib/villas/types.ts lib/villas/amenities.ts lib/villas/normalize.ts lib/villas/__tests__/normalize.test.ts
git commit -m "feat: normalize villa listings"
```

---

## Task 3: Filter Utility

**Files:**
- Create: `lib/villas/filters.ts`
- Create: `lib/villas/__tests__/filters.test.ts`

- [ ] **Step 1: Write failing filter tests**

Create `lib/villas/__tests__/filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterVillas, getDefaultFilters } from "../filters";
import type { VillaListing } from "../types";

const villas: VillaListing[] = [
  {
    id: "1",
    zone: "pattaya",
    zoneLabel: "พัทยา",
    bedrooms: 4,
    bathrooms: 4,
    distanceToSea: "1 กม.",
    price: 5000,
    people: 12,
    coverImage: null,
    poolType: "salt",
    amenities: [{ key: "karaoke", label: "คาราโอเกะ" }],
  },
  {
    id: "2",
    zone: "bangsaen",
    zoneLabel: "บางแสน",
    bedrooms: 2,
    bathrooms: 2,
    distanceToSea: "500 ม.",
    price: 2500,
    people: 4,
    coverImage: null,
    poolType: "chlorine",
    amenities: [{ key: "pet", label: "นำสัตว์เลี้ยงได้" }],
  },
];

describe("filterVillas", () => {
  it("keeps villas matching guests, bedrooms, max price, and selected amenities", () => {
    expect(
      filterVillas(villas, {
        zone: "all",
        guests: 10,
        bedrooms: 3,
        maxPrice: 6000,
        amenities: ["karaoke"],
      }).map((villa) => villa.id),
    ).toEqual(["1"]);
  });

  it("filters by exact zone unless zone is all", () => {
    expect(
      filterVillas(villas, {
        ...getDefaultFilters(6000),
        zone: "bangsaen",
      }).map((villa) => villa.id),
    ).toEqual(["2"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- lib/villas/__tests__/filters.test.ts
```

Expected: FAIL because `lib/villas/filters.ts` does not exist.

- [ ] **Step 3: Create filter utility**

Create `lib/villas/filters.ts`:

```ts
import type { VillaFilters, VillaListing } from "./types";

export function getDefaultFilters(maxPrice: number): VillaFilters {
  return {
    zone: "all",
    guests: 2,
    bedrooms: 1,
    amenities: [],
    maxPrice,
  };
}

export function filterVillas(
  villas: VillaListing[],
  filters: VillaFilters,
): VillaListing[] {
  return villas.filter((villa) => {
    const zoneMatches = filters.zone === "all" || villa.zone === filters.zone;
    const guestMatches = villa.people >= filters.guests;
    const bedroomMatches = villa.bedrooms >= filters.bedrooms;
    const priceMatches = villa.price <= filters.maxPrice;
    const villaAmenityKeys = new Set(villa.amenities.map((amenity) => amenity.key));
    const amenityMatches = filters.amenities.every((key) => villaAmenityKeys.has(key));

    return zoneMatches && guestMatches && bedroomMatches && priceMatches && amenityMatches;
  });
}

export function getMaxVillaPrice(villas: VillaListing[]): number {
  return villas.reduce((max, villa) => Math.max(max, villa.price), 0);
}

export function getUniqueZones(villas: VillaListing[]): Array<{ value: string; label: string }> {
  const zones = new Map<string, string>();

  villas.forEach((villa) => {
    zones.set(villa.zone, villa.zoneLabel);
  });

  return Array.from(zones, ([value, label]) => ({ value, label })).sort((a, b) =>
    a.label.localeCompare(b.label, "th"),
  );
}
```

- [ ] **Step 4: Verify tests pass**

Run:

```powershell
npm run test -- lib/villas/__tests__/filters.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add lib/villas/filters.ts lib/villas/__tests__/filters.test.ts
git commit -m "feat: add villa filtering"
```

---

## Task 4: Deville API Proxy Routes

**Files:**
- Create: `lib/villas/server.ts`
- Create: `app/api/houses/route.ts`
- Create: `app/api/villas/[id]/route.ts`

- [ ] **Step 1: Create server data helper**

Create `lib/villas/server.ts`:

```ts
import "server-only";

import { normalizeHouses } from "./normalize";
import type { RawHouse, VillaDetailPayload, VillaListing } from "./types";

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
```

- [ ] **Step 2: Create `/api/houses` route**

Create `app/api/houses/route.ts`:

```ts
import { fetchHouseListings } from "@/lib/villas/server";

export async function GET() {
  try {
    const items = await fetchHouseListings();
    return Response.json({ items });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to load houses",
      },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 3: Create `/api/villas/[id]` route**

Create `app/api/villas/[id]/route.ts`:

```ts
import { fetchVillaDetail } from "@/lib/villas/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const payload = await fetchVillaDetail(id);

    if (!payload) {
      return Response.json({ error: "Villa not found" }, { status: 404 });
    }

    return Response.json(payload);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to load villa",
      },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 4: Verify TypeScript and lint**

Run:

```powershell
npm run lint
npm run build
```

Expected: both PASS. `npm run build` should not require `DEVILLE_BEARER_TOKEN`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add lib/villas/server.ts app/api/houses/route.ts app/api/villas/[id]/route.ts
git commit -m "feat: add deville api proxies"
```

---

## Task 5: Supabase Image Proxy Route

**Files:**
- Create: `lib/villas/images.ts`
- Create: `lib/villas/__tests__/images.test.ts`
- Create: `app/api/villas/[id]/images/route.ts`

- [ ] **Step 1: Write failing image normalization tests**

Create `lib/villas/__tests__/images.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeImageRows } from "../images";

describe("normalizeImageRows", () => {
  it("maps Supabase image rows into public image DTOs", () => {
    expect(
      normalizeImageRows([
        {
          id: 12,
          property_id: 9,
          cover_select: 1,
          image_name: "living.jpg",
          image_url: "https://rqizfiayvcbozlzuvbok.supabase.co/storage/v1/object/public/images/living.jpg",
          caption: "ห้องนั่งเล่น",
          image_zone: "living",
        },
      ]),
    ).toEqual([
      {
        id: 12,
        imageUrl: "https://rqizfiayvcbozlzuvbok.supabase.co/storage/v1/object/public/images/living.jpg",
        imageName: "living.jpg",
        caption: "ห้องนั่งเล่น",
        isCover: true,
        zone: "living",
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- lib/villas/__tests__/images.test.ts
```

Expected: FAIL because `lib/villas/images.ts` does not exist.

- [ ] **Step 3: Create Supabase image helper**

Create `lib/villas/images.ts`:

```ts
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
    .filter((row) => Boolean(row.image_url))
    .map((row) => ({
      id: row.id,
      imageUrl: row.image_url as string,
      imageName: row.image_name,
      caption: row.caption,
      isCover: Number(row.cover_select) > 0,
      zone: row.image_zone,
    }));
}

export async function fetchVillaImages(id: string): Promise<VillaImage[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Supabase environment variables are missing");
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase
    .from("images")
    .select("id, property_id, cover_select, image_name, image_url, caption, image_zone")
    .eq("property_id", Number(id))
    .order("cover_select", { ascending: false })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return normalizeImageRows((data ?? []) as SupabaseImageRow[]);
}
```

- [ ] **Step 4: Create images route**

Create `app/api/villas/[id]/images/route.ts`:

```ts
import { fetchVillaImages } from "@/lib/villas/images";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const images = await fetchVillaImages(id);
    return Response.json({ images });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to load villa images",
      },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 5: Verify tests and build**

Run:

```powershell
npm run test -- lib/villas/__tests__/images.test.ts
npm run build
```

Expected: tests PASS and build PASS. The build must not query Supabase.

- [ ] **Step 6: Commit**

Run:

```powershell
git add lib/villas/images.ts lib/villas/__tests__/images.test.ts app/api/villas/[id]/images/route.ts
git commit -m "feat: add villa image proxy"
```

---

## Task 6: Search Page UI

**Files:**
- Create: `components/villas/search-bar.tsx`
- Create: `components/villas/villa-card.tsx`
- Create: `components/villas/villa-grid.tsx`
- Create: `components/villas/home-page.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create search bar component**

Create `components/villas/search-bar.tsx` with a client component that accepts `filters`, `zones`, `maxAvailablePrice`, `onChange`, and `onSearch`. It must render the reference-style controls in this order:

```tsx
"use client";

import { BedDouble, ChevronDown, Filter, MapPin, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { AMENITY_OPTIONS } from "@/lib/villas/amenities";
import type { AmenityKey, VillaFilters } from "@/lib/villas/types";

type SearchBarProps = {
  filters: VillaFilters;
  zones: Array<{ value: string; label: string }>;
  maxAvailablePrice: number;
  onChange: (filters: VillaFilters) => void;
  onSearch: () => void;
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export function SearchBar({
  filters,
  zones,
  maxAvailablePrice,
  onChange,
  onSearch,
}: SearchBarProps) {
  const [locationOpen, setLocationOpen] = useState(false);
  const [amenitiesOpen, setAmenitiesOpen] = useState(false);
  const selectedZone = zones.find((zone) => zone.value === filters.zone);

  const selectedAmenityLabel = useMemo(() => {
    if (filters.amenities.length === 0) return "สิ่งอำนวยความสะดวก";
    if (filters.amenities.length === 1) {
      return AMENITY_OPTIONS.find((amenity) => amenity.key === filters.amenities[0])?.label ?? "1 รายการ";
    }
    return `${filters.amenities.length} รายการ`;
  }, [filters.amenities]);

  function update(next: Partial<VillaFilters>) {
    onChange({ ...filters, ...next });
  }

  function toggleAmenity(key: AmenityKey) {
    const exists = filters.amenities.includes(key);
    update({
      amenities: exists
        ? filters.amenities.filter((amenity) => amenity !== key)
        : [...filters.amenities, key],
    });
  }

  return (
    <section className="relative z-10 mx-auto w-full max-w-7xl rounded-[22px] bg-white px-6 py-6 shadow-[0_24px_54px_rgba(0,77,61,0.28)] ring-1 ring-[#dbe7e3]">
      <div className="grid gap-3 lg:grid-cols-[1.35fr_0.9fr_0.9fr_1.35fr_1.05fr_auto] lg:items-end">
        <div className="relative">
          <label className="mb-2 block text-sm font-medium text-[#075244]">ทำเลที่พัก</label>
          <button
            type="button"
            className="flex h-12 w-full items-center justify-between rounded-lg border border-[#dbe7e3] bg-white px-3 text-left text-[#075244]"
            onClick={() => setLocationOpen((open) => !open)}
          >
            <span className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {selectedZone?.label ?? "เลือกทำเลที่ต้องการ"}
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>
          {locationOpen ? (
            <div className="absolute left-0 top-[5.2rem] w-full rounded-lg border border-[#dbe7e3] bg-white p-2 shadow-xl">
              <button
                type="button"
                className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[#edf6f2]"
                onClick={() => {
                  update({ zone: "all" });
                  setLocationOpen(false);
                }}
              >
                ทุกทำเล
              </button>
              {zones.map((zone) => (
                <button
                  type="button"
                  key={zone.value}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[#edf6f2]"
                  onClick={() => {
                    update({ zone: zone.value });
                    setLocationOpen(false);
                  }}
                >
                  {zone.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <label>
          <span className="mb-2 block text-sm font-medium text-[#075244]">ผู้เข้าพัก</span>
          <span className="flex h-12 items-center gap-2 rounded-lg border border-[#dbe7e3] bg-white px-3">
            <Users className="h-5 w-5" />
            <input
              min={1}
              type="number"
              value={filters.guests}
              onChange={(event) => update({ guests: Number(event.target.value) })}
              className="w-full bg-transparent outline-none"
            />
          </span>
        </label>

        <label>
          <span className="mb-2 block text-sm font-medium text-[#075244]">ห้องนอน</span>
          <span className="flex h-12 items-center gap-2 rounded-lg border border-[#dbe7e3] bg-white px-3">
            <BedDouble className="h-5 w-5" />
            <input
              min={1}
              type="number"
              value={filters.bedrooms}
              onChange={(event) => update({ bedrooms: Number(event.target.value) })}
              className="w-full bg-transparent outline-none"
            />
          </span>
        </label>

        <div className="relative">
          <label className="mb-2 block text-sm font-medium text-[#075244]">สิ่งอำนวยความสะดวก</label>
          <button
            type="button"
            className="flex h-12 w-full items-center justify-between rounded-lg border border-[#dbe7e3] bg-white px-3 text-left text-[#075244]"
            onClick={() => setAmenitiesOpen((open) => !open)}
          >
            <span className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {selectedAmenityLabel}
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>
          {amenitiesOpen ? (
            <div className="absolute left-0 top-[5.2rem] max-h-80 w-full overflow-auto rounded-lg border border-[#dbe7e3] bg-white p-2 shadow-xl">
              {AMENITY_OPTIONS.map((amenity) => (
                <label
                  key={amenity.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-[#edf6f2]"
                >
                  <input
                    type="checkbox"
                    checked={filters.amenities.includes(amenity.key)}
                    onChange={() => toggleAmenity(amenity.key)}
                  />
                  {amenity.label}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <label>
          <span className="mb-2 flex items-center justify-between text-sm font-medium text-[#075244]">
            ราคาสูงสุด
            <span className="text-[#f6ad21]">{currencyFormatter.format(filters.maxPrice)}</span>
          </span>
          <input
            type="range"
            min={1000}
            max={Math.max(maxAvailablePrice, 1000)}
            step={500}
            value={filters.maxPrice}
            onChange={(event) => update({ maxPrice: Number(event.target.value) })}
            className="h-12 w-full accent-[#0f5a66]"
          />
        </label>

        <button
          type="button"
          onClick={onSearch}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#064d3d] px-6 font-semibold text-white transition hover:bg-[#04382d]"
        >
          <Search className="h-5 w-5" />
          ค้นหาบ้านพัก
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create villa card component**

Create `components/villas/villa-card.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, MapPin, Users } from "lucide-react";
import type { VillaListing } from "@/lib/villas/types";

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export function VillaCard({ villa }: { villa: VillaListing }) {
  return (
    <Link
      href={`/villas/${villa.id}`}
      className="group overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[#dbe7e3] transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative aspect-[4/3] bg-[#dcebe5]">
        {villa.coverImage ? (
          <Image
            src={villa.coverImage}
            alt={`พูลวิลล่า ${villa.id}`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[#0f5a66]">
            Baan Pool Villa
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-sm font-semibold text-[#064d3d]">
          {currencyFormatter.format(villa.price)}
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <h2 className="text-lg font-bold text-[#063f35]">พูลวิลล่า #{villa.id}</h2>
          <p className="mt-1 flex items-center gap-1 text-sm text-[#47766b]">
            <MapPin className="h-4 w-4" />
            {villa.zoneLabel} · ห่างทะเล {villa.distanceToSea}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm text-[#075244]">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {villa.people}
          </span>
          <span className="flex items-center gap-1">
            <BedDouble className="h-4 w-4" />
            {villa.bedrooms}
          </span>
          <span className="flex items-center gap-1">
            <Bath className="h-4 w-4" />
            {villa.bathrooms}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {villa.amenities.slice(0, 3).map((amenity) => (
            <span
              key={amenity.key}
              className="rounded-full bg-[#edf6f2] px-2.5 py-1 text-xs font-medium text-[#064d3d]"
            >
              {amenity.label}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Create grid component**

Create `components/villas/villa-grid.tsx`:

```tsx
import { VillaCard } from "./villa-card";
import type { VillaListing } from "@/lib/villas/types";

export function VillaGrid({ villas }: { villas: VillaListing[] }) {
  if (villas.length === 0) {
    return (
      <div className="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-[#dbe7e3]">
        <h2 className="text-xl font-bold text-[#063f35]">ไม่พบบ้านพักที่ตรงกับเงื่อนไข</h2>
        <p className="mt-2 text-[#47766b]">ลองปรับจำนวนผู้เข้าพัก ห้องนอน สิ่งอำนวยความสะดวก หรือราคาสูงสุด</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {villas.map((villa) => (
        <VillaCard key={villa.id} villa={villa} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create home page client component**

Create `components/villas/home-page.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { filterVillas, getDefaultFilters, getMaxVillaPrice, getUniqueZones } from "@/lib/villas/filters";
import type { VillaFilters, VillaListing } from "@/lib/villas/types";
import { SearchBar } from "./search-bar";
import { VillaGrid } from "./villa-grid";

type HousesResponse = {
  items: VillaListing[];
  error?: string;
};

export function HomePage() {
  const [villas, setVillas] = useState<VillaListing[]>([]);
  const [filters, setFilters] = useState<VillaFilters>(getDefaultFilters(58000));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadHouses() {
      try {
        const response = await fetch("/api/houses");
        const payload = (await response.json()) as HousesResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load houses");
        }

        if (!mounted) return;

        const maxPrice = getMaxVillaPrice(payload.items);
        setVillas(payload.items);
        setFilters(getDefaultFilters(maxPrice));
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load houses");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadHouses();

    return () => {
      mounted = false;
    };
  }, []);

  const maxAvailablePrice = useMemo(() => getMaxVillaPrice(villas), [villas]);
  const zones = useMemo(() => getUniqueZones(villas), [villas]);
  const filteredVillas = useMemo(() => filterVillas(villas, filters), [filters, villas]);

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0f5a66]">Baan Pool Villa</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-[#04382d] md:text-6xl">
            ค้นหาพูลวิลล่าที่พอดีกับทริปของคุณ
          </h1>
        </header>

        <SearchBar
          filters={filters}
          zones={zones}
          maxAvailablePrice={maxAvailablePrice}
          onChange={setFilters}
          onSearch={() => window.scrollTo({ top: 360, behavior: "smooth" })}
        />

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#04382d]">บ้านพักทั้งหมด</h2>
              <p className="text-sm text-[#47766b]">
                แสดง {filteredVillas.length.toLocaleString("th-TH")} จาก {villas.length.toLocaleString("th-TH")} หลัง
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-80 animate-pulse rounded-xl bg-white/70 ring-1 ring-[#dbe7e3]" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl bg-white p-8 text-[#8b1e1e] ring-1 ring-red-100">{error}</div>
          ) : (
            <VillaGrid villas={filteredVillas} />
          )}
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Replace home route shell**

Replace `app/page.tsx` with:

```tsx
import { HomePage } from "@/components/villas/home-page";

export default function Page() {
  return <HomePage />;
}
```

- [ ] **Step 6: Verify search UI compiles**

Run:

```powershell
npm run lint
npm run build
```

Expected: both PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add components/villas/search-bar.tsx components/villas/villa-card.tsx components/villas/villa-grid.tsx components/villas/home-page.tsx app/page.tsx
git commit -m "feat: build villa search page"
```

---

## Task 7: Villa Detail Page UI

**Files:**
- Create: `components/villas/detail-page.tsx`
- Create: `app/villas/[id]/page.tsx`
- Create: `app/villas/[id]/loading.tsx`
- Create: `app/villas/[id]/not-found.tsx`

- [ ] **Step 1: Create detail client component**

Create `components/villas/detail-page.tsx`:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bath, BedDouble, MapPin, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { VillaDetailPayload, VillaImage } from "@/lib/villas/types";

type ImagesResponse = {
  images: VillaImage[];
  error?: string;
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export function VillaDetailPage({ id }: { id: string }) {
  const [detail, setDetail] = useState<VillaDetailPayload | null>(null);
  const [images, setImages] = useState<VillaImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadVilla() {
      try {
        const [detailResponse, imagesResponse] = await Promise.all([
          fetch(`/api/villas/${id}`),
          fetch(`/api/villas/${id}/images`),
        ]);

        const detailPayload = (await detailResponse.json()) as VillaDetailPayload & { error?: string };
        const imagesPayload = (await imagesResponse.json()) as ImagesResponse;

        if (!detailResponse.ok) {
          throw new Error(detailPayload.error ?? "Villa not found");
        }

        if (!mounted) return;

        setDetail(detailPayload);
        setImages(imagesResponse.ok ? imagesPayload.images : []);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load villa");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadVilla();

    return () => {
      mounted = false;
    };
  }, [id]);

  const gallery = useMemo(() => {
    if (!detail) return [];
    if (images.length > 0) return images.map((image) => image.imageUrl);
    return detail.listing.coverImage ? [detail.listing.coverImage] : [];
  }, [detail, images]);

  if (loading) {
    return <main className="min-h-screen p-8">กำลังโหลดรายละเอียดบ้านพัก...</main>;
  }

  if (error || !detail) {
    return (
      <main className="min-h-screen p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-[#064d3d]">
          <ArrowLeft className="h-4 w-4" />
          กลับหน้าค้นหา
        </Link>
        <div className="mt-8 rounded-xl bg-white p-8 ring-1 ring-[#dbe7e3]">{error ?? "ไม่พบบ้านพัก"}</div>
      </main>
    );
  }

  const { listing } = detail;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#064d3d]">
          <ArrowLeft className="h-4 w-4" />
          กลับหน้าค้นหา
        </Link>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[#dcebe5]">
            {gallery[0] ? (
              <Image src={gallery[0]} alt={`พูลวิลล่า ${listing.id}`} fill priority className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[#0f5a66]">Baan Pool Villa</div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {gallery.slice(1, 4).map((src) => (
              <div key={src} className="relative min-h-36 overflow-hidden rounded-2xl bg-[#dcebe5]">
                <Image src={src} alt={`รูปพูลวิลล่า ${listing.id}`} fill className="object-cover" />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <div>
              <p className="flex items-center gap-2 text-[#0f5a66]">
                <MapPin className="h-5 w-5" />
                {listing.zoneLabel} · ห่างทะเล {listing.distanceToSea}
              </p>
              <h1 className="mt-3 text-4xl font-black text-[#04382d]">พูลวิลล่า #{listing.id}</h1>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-4 ring-1 ring-[#dbe7e3]">
                <Users className="h-5 w-5" />
                <p className="mt-2 font-bold">พักได้ {listing.people} คน</p>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-[#dbe7e3]">
                <BedDouble className="h-5 w-5" />
                <p className="mt-2 font-bold">{listing.bedrooms} ห้องนอน</p>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-[#dbe7e3]">
                <Bath className="h-5 w-5" />
                <p className="mt-2 font-bold">{listing.bathrooms} ห้องน้ำ</p>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 ring-1 ring-[#dbe7e3]">
              <h2 className="text-xl font-bold">สิ่งอำนวยความสะดวก</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {listing.amenities.map((amenity) => (
                  <span key={amenity.key} className="rounded-full bg-[#edf6f2] px-3 py-1.5 text-sm text-[#064d3d]">
                    {amenity.label}
                  </span>
                ))}
              </div>
            </div>

            {detail.detailStatus === "available" ? (
              <div className="rounded-xl bg-white p-6 ring-1 ring-[#dbe7e3]">
                <h2 className="text-xl font-bold">รายละเอียดเพิ่มเติม</h2>
                <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap text-sm text-[#47766b]">
                  {JSON.stringify(detail.detail, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="rounded-xl bg-white p-6 text-[#47766b] ring-1 ring-[#dbe7e3]">
                รายละเอียดเพิ่มเติมยังไม่พร้อมแสดงในขณะนี้
              </div>
            )}
          </div>

          <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#dbe7e3]">
            <p className="text-sm text-[#47766b]">ราคาเริ่มต้น</p>
            <p className="mt-1 text-3xl font-black text-[#064d3d]">{currencyFormatter.format(listing.price)}</p>
            <button className="mt-6 w-full rounded-full bg-[#064d3d] px-5 py-3 font-semibold text-white">
              สอบถามบ้านพัก
            </button>
          </aside>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create detail route shell**

Create `app/villas/[id]/page.tsx`:

```tsx
import { VillaDetailPage } from "@/components/villas/detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VillaDetailPage id={id} />;
}
```

- [ ] **Step 3: Create loading and not-found states**

Create `app/villas/[id]/loading.tsx`:

```tsx
export default function Loading() {
  return <main className="min-h-screen p-8">กำลังโหลดรายละเอียดบ้านพัก...</main>;
}
```

Create `app/villas/[id]/not-found.tsx`:

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold text-[#04382d]">ไม่พบบ้านพัก</h1>
      <Link href="/" className="mt-4 inline-block text-[#064d3d]">
        กลับหน้าค้นหา
      </Link>
    </main>
  );
}
```

- [ ] **Step 4: Verify detail UI compiles**

Run:

```powershell
npm run lint
npm run build
```

Expected: both PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add components/villas/detail-page.tsx app/villas/[id]/page.tsx app/villas/[id]/loading.tsx app/villas/[id]/not-found.tsx
git commit -m "feat: add villa detail page"
```

---

## Task 8: End-To-End Verification

**Files:**
- No new files unless a verification issue requires a focused fix.

- [ ] **Step 1: Run full automated checks**

Run:

```powershell
npm run test
npm run lint
npm run build
```

Expected: all PASS.

- [ ] **Step 2: Start dev server**

Run:

```powershell
npm run dev
```

Expected: Next.js starts on `http://localhost:3000` or prints the alternate port if 3000 is in use.

- [ ] **Step 3: Verify API routes**

In another shell, run:

```powershell
Invoke-WebRequest -Uri 'http://localhost:3000/api/houses' -UseBasicParsing | Select-Object -ExpandProperty StatusCode
Invoke-WebRequest -Uri 'http://localhost:3000/api/villas/9' -UseBasicParsing | Select-Object -ExpandProperty StatusCode
Invoke-WebRequest -Uri 'http://localhost:3000/api/villas/9/images' -UseBasicParsing | Select-Object -ExpandProperty StatusCode
```

Expected:

- `/api/houses` returns `200`.
- `/api/villas/9` returns `200` even without `DEVILLE_BEARER_TOKEN`, with `detailStatus: "missing_token"`.
- `/api/villas/9/images` returns `200` when Supabase env vars are configured, or `502` with a clear env error when they are not configured.

- [ ] **Step 4: Verify browser flows**

Use the in-app browser:

1. Open `http://localhost:3000`.
2. Confirm the search bar visually matches the provided reference: location, guests, bedrooms, amenities, max price, green search button.
3. Open the location dropdown and choose `พัทยา`.
4. Increase guests and bedrooms.
5. Select at least one amenity.
6. Move max price down.
7. Confirm result count and cards update.
8. Click a card and confirm navigation to `/villas/[id]`.
9. Confirm the detail page renders with summary data even when extended details are unavailable.

- [ ] **Step 5: Close verification**

If all checks pass without code changes, stop here and do not create an empty commit.

If verification reveals a defect, return to the task that owns the affected file, make the smallest focused fix there, rerun that task's verification command, and use that task's existing commit step with its explicit file paths.
