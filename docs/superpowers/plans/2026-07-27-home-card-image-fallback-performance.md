# Home Card Image Fallback and Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve up to ten scrollable homepage card images while filling incomplete selections, supporting two-image sliders, bounding database results, and delaying offscreen thumbnail downloads.

**Architecture:** A shared pure selector merges uploaded cover, admin order, database recommendation, outside, inside, and remaining images into one deduplicated ten-item list. Homepage server loading queries only the first twelve rendered villas per rail and prefers a bounded Supabase RPC, while the card gallery mounts thumbnail image elements only after its card enters a `600px 0px` observer margin.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase PostgreSQL RPC, Vitest, Cloudflare/OpenNext image proxy caching.

## Global Constraints

- Keep `IMAGE_INTERNAL_API_TOKEN` server-only; do not add a public manifest endpoint or browser token.
- Keep at most ten images per villa card.
- One image renders without gallery controls; two through ten images render the slider and thumbnail rail.
- Homepage rails continue rendering at most twelve villa cards each.
- Database batches contain at most 48 unique positive villa ids.
- Browser requests use only existing same-origin image-id proxy paths.
- Keep the shared twelve-hour villa-card-image cache and existing cache tags.
- Preserve current card layout, arrows, thumbnail rail, normal document navigation, and image downloads.
- Do not commit unless the user gives a separate explicit commit instruction.

---

## File Structure

- `lib/villas/card-image-selection.ts`: owns source-priority merging, URL/id deduplication, and the ten-image cap.
- `lib/villas/card-image-batch.ts`: owns bounded RPC loading, compatibility fallback, cache wrapping, and public proxy URL conversion.
- `lib/home-sections/card-image-ids.ts`: owns extraction of only the villa ids that homepage rails can render.
- `components/villas/listing/villa-card-gallery-images.tsx`: owns the one-image/two-image UI boundary and near-viewport thumbnail activation.
- `supabase/migrations/20260727090000_create_public_villa_card_images_rpc.sql`: owns the read-only bounded RPC and grants.
- Existing focused tests remain beside their owners.

### Task 1: Correct the Card Image Selection Contract

**Files:**
- Modify: `lib/villas/card-image-selection.ts`
- Modify: `lib/villas/__tests__/card-image-selection.test.ts`

**Interfaces:**
- Consumes: `VillaCardDisplayImageConfig`, `VillaImage[]`, and `recommendedImages`.
- Produces: `selectVillaCardDisplayImages(input): VillaImage[]`, ordered and capped at ten.

- [ ] **Step 1: Add failing tests for incomplete-source filling**

Add literal expectations proving that each incomplete source is retained and
filled by later sources:

```ts
it("fills an incomplete admin order from recommended and system images", () => {
  expect(
    selectVillaCardDisplayImages({
      config: { coverImage: null, imageIds: [5] },
      images,
      recommendedImages: [images[1]],
    }).map(({ id }) => id),
  ).toEqual([5, 2, 1, 3, 4]);
});

it("uses remaining zones when outside and inside do not fill ten slots", () => {
  expect(
    selectVillaCardDisplayImages({
      config: { coverImage: null, imageIds: [] },
      images,
      recommendedImages: [],
    }).map(({ id }) => id),
  ).toEqual([1, 2, 3, 4, 5]);
});
```

Add a duplicate-URL fixture with a different id and assert it appears once.

- [ ] **Step 2: Run the selector test and verify RED**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/card-image-selection.test.ts
```

Expected: the incomplete-admin test fails because the current selector replaces
the incomplete source instead of filling it; the remaining-zone test fails
because `review` is omitted.

- [ ] **Step 3: Implement one ordered merge**

Keep `dedupeAndCap` as the only cap/deduplication owner. Build ordered sources
and merge once:

```ts
const selectedCustomImages = config.imageIds
  .map((imageId) => imagesById.get(imageId))
  .filter((image): image is VillaImage => image !== undefined);
const outsideImages = orderedZoneImages(images, "outside");
const insideImages = orderedZoneImages(images, "inside");
const remainingImages = [...images]
  .filter((image) => !isCover(image))
  .sort((left, right) => left.id - right.id);

return dedupeAndCap([
  ...(config.coverImage ? [config.coverImage] : []),
  ...withoutOldCovers(selectedCustomImages),
  ...withoutOldCovers(recommendedImages),
  ...withoutOldCovers(outsideImages),
  ...withoutOldCovers(insideImages),
  ...withoutOldCovers(remainingImages),
]);
```

`withoutOldCovers` must remove only uploaded-cover duplicates and old
cover-zone rows when a cover override exists. Do not discard valid
`cover_select` recommendations solely because `isCover` is true.

- [ ] **Step 4: Run selector and existing image tests**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/card-image-selection.test.ts lib/villas/__tests__/images.test.ts
```

Expected: PASS. Update an old expectation only when it contradicts the approved
fill-order contract, and retain a literal expected id list.

- [ ] **Step 5: Review checkpoint**

Inspect `git diff -- lib/villas/card-image-selection.ts lib/villas/__tests__/card-image-selection.test.ts`.
Do not commit.

### Task 2: Render Two-Image Galleries and Defer Offscreen Thumbnails

**Files:**
- Modify: `components/villas/listing/villa-card-gallery-images.tsx`
- Modify: `components/villas/listing/__tests__/villa-card-gallery-images.test.tsx`

**Interfaces:**
- Consumes: `coverImageSrc`, `staticImageUrls`, and the existing card props.
- Produces: unchanged `VillaCardGalleryImages` public props and interaction behavior.

- [ ] **Step 1: Add failing two-image and inactive-viewport tests**

Use the existing jsdom `createRoot` pattern. Add a controllable observer:

```tsx
let enterViewport: (() => void) | null = null;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "600px 0px";
  readonly thresholds = [];

  constructor(callback: IntersectionObserverCallback) {
    enterViewport = () => callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this,
    );
  }

  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = () => [];
  unobserve = vi.fn();
}

it("renders gallery controls when exactly two unique images exist", async () => {
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <VillaCardGalleryImages
        alt="Two image villa"
        coverImageSrc="/api/houses/images/9"
        staticImageUrls={["/api/villas/9/images/proxy?imageId=2"]}
        villaId="9"
      />,
    );
  });
  await act(async () => enterViewport?.());

  expect(container.querySelectorAll("[data-villa-card-thumbnail]")).toHaveLength(2);
  expect(container.querySelector("[data-villa-card-gallery-status]")?.getAttribute(
    "data-villa-card-gallery-status",
  )).toBe("ready");
});

it("does not mount thumbnail images before the card nears the viewport", async () => {
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <VillaCardGalleryImages
        alt="Ten image villa"
        coverImageSrc="/api/houses/images/9"
        staticImageUrls={Array.from(
          { length: 9 },
          (_, index) => `/api/villas/9/images/proxy?imageId=${index + 2}`,
        )}
        villaId="9"
      />,
    );
  });

  expect(container.querySelectorAll("[data-villa-card-thumbnail]")).toHaveLength(0);
  expect(container.querySelector("[data-villa-card-gallery-main-link]")).not.toBeNull();
});
```

Stub `IntersectionObserver` so the test controls the transition. Mark each
thumbnail button with `data-villa-card-thumbnail`.

- [ ] **Step 2: Run the component test and verify RED**

Run:

```powershell
npm.cmd test -- components/villas/listing/__tests__/villa-card-gallery-images.test.tsx
```

Expected: two images resolve to `empty`, and offscreen thumbnails already exist.

- [ ] **Step 3: Change the gallery minimum from three to two**

Set:

```ts
const MIN_GALLERY_CARD_IMAGES = 2;
```

The single-image branch continues rendering the main image without arrows or
thumbnail buttons.

- [ ] **Step 4: Add near-viewport activation**

Add `isGalleryActive` state initialized to `false`. Observe `rootRef` with:

```ts
const observer = new IntersectionObserver(
  ([entry]) => {
    if (entry?.isIntersecting) {
      setIsGalleryActive(true);
      observer.disconnect();
    }
  },
  { rootMargin: "600px 0px" },
);
```

When `IntersectionObserver` is unavailable, schedule activation with
`setTimeout(..., 0)` and clear it on unmount. Render the existing thumbnail rail
only when `galleryStatus === "ready" && isGalleryActive`. Before activation,
render the existing main cover link and no thumbnail image elements.

- [ ] **Step 5: Run listing-card tests**

Run:

```powershell
npm.cmd test -- components/villas/listing/__tests__/villa-card-gallery-images.test.tsx components/villas/listing/__tests__/villa-card-navigation.test.tsx
```

Expected: PASS, including existing arrow selection and normal-link behavior.

- [ ] **Step 6: Review checkpoint**

Inspect the focused diff. Confirm no fetch call or token was introduced. Do not
commit.

### Task 3: Query Only Homepage Cards That Can Render

**Files:**
- Create: `lib/home-sections/card-image-ids.ts`
- Create: `lib/home-sections/__tests__/card-image-ids.test.ts`
- Modify: `app/(public)/(home)/page.tsx`
- Modify: `app/(public)/(home)/page.test.ts` if its server-data expectations change

**Interfaces:**
- Produces:

```ts
export type HomepageCardImageSection = {
  villas: ReadonlyArray<{ id: string }>;
};

export function selectHomepageCardImageVillaIds(
  sections: ReadonlyArray<HomepageCardImageSection>,
): string[];
```

- [ ] **Step 1: Add the failing pure test**

```ts
it("takes at most twelve villas per rail and deduplicates across rails", () => {
  const first = Array.from({ length: 15 }, (_, index) => ({ id: String(index + 1) }));
  const second = [{ id: "2" }, { id: "20" }, { id: "bad" }];

  expect(selectHomepageCardImageVillaIds([
    { villas: first },
    { villas: second },
  ])).toEqual([
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "20",
  ]);
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
npm.cmd test -- lib/home-sections/__tests__/card-image-ids.test.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the bounded id selector**

Use one shared exported constant so the server selector and `VillaRail` cannot
drift:

```ts
export const MAX_RENDERED_VILLA_RAIL_ITEMS = 12;

export type HomepageCardImageSection = {
  villas: ReadonlyArray<{ id: string }>;
};

export function selectHomepageCardImageVillaIds(
  sections: ReadonlyArray<HomepageCardImageSection>,
): string[] {
  return [...new Set(
    sections.flatMap((section) =>
      section.villas
        .slice(0, MAX_RENDERED_VILLA_RAIL_ITEMS)
        .map(({ id }) => id.trim())
        .filter((id) => /^[1-9]\d*$/.test(id)),
    ),
  )];
}
```

Import the constant into `components/villas/home/villa-rail.tsx`. Replace the
homepage `flatMap` passed to `fetchPublicVillaCardImageUrls` with the new helper.

- [ ] **Step 4: Run home-section and homepage tests**

Run:

```powershell
npm.cmd test -- lib/home-sections/__tests__/card-image-ids.test.ts components/villas/home/__tests__/page.test.tsx "app/(public)/(home)/page.test.ts"
```

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Verify a rail with 99 configured villas renders and queries only its first
twelve. Do not commit.

### Task 4: Add the Bounded Supabase Card-Image RPC

**Files:**
- Create: `supabase/migrations/20260727090000_create_public_villa_card_images_rpc.sql`
- Create: `lib/villas/card-image-rpc.ts`
- Create: `lib/villas/__tests__/card-image-rpc.test.ts`
- Modify: `lib/villas/card-image-batch.ts`
- Modify: `lib/villas/__tests__/card-image-batch.test.ts`

**Interfaces:**
- SQL:

```sql
public.get_public_villa_card_images(p_house_ids bigint[])
```

- TypeScript:

```ts
export type VillaCardImageRpcRow = {
  property_id: number;
  id: number;
  image_name: string | null;
  image_url: string | null;
  caption: string | null;
  image_zone: string | null;
  cover_select: number | null;
  selection_order: number;
};

export function mapVillaCardImageRpcRows(
  ids: readonly string[],
  rows: readonly VillaCardImageRpcRow[],
  supabaseUrl: string,
): Map<string, VillaImage[]>;
```

- [ ] **Step 1: Add failing RPC-row mapping tests**

Use complete literal RPC rows for two villas. Assert rows are grouped by
`property_id`, sorted by `selection_order`, normalized, capped at ten, and
unknown villa ids are ignored.

```ts
expect(
  [...mapVillaCardImageRpcRows(["9"], rows, "https://db.test").get("9")!]
    .map(({ id }) => id),
).toEqual([0, 8, 3]);
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/card-image-rpc.test.ts
```

Expected: FAIL because the mapper does not exist.

- [ ] **Step 3: Implement the read-only idempotent RPC migration**

Create the migration with this complete function. It returns an empty set for
an empty input, rejects invalid or over-48 inputs, ranks all six approved
sources, deduplicates first by image id and then by normalized URL/name, and
keeps ten rows per villa:

```sql
create or replace function public.get_public_villa_card_images(
  p_house_ids bigint[]
)
returns table (
  property_id bigint,
  id integer,
  image_name text,
  image_url text,
  caption text,
  image_zone text,
  cover_select integer,
  selection_order integer
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  normalized_ids bigint[];
begin
  select coalesce(array_agg(distinct value order by value), '{}'::bigint[])
  into normalized_ids
  from unnest(coalesce(p_house_ids, '{}'::bigint[])) as input(value)
  where value > 0;

  if cardinality(normalized_ids) <> cardinality(coalesce(p_house_ids, '{}'::bigint[])) then
    raise exception 'Villa ids must be unique positive integers';
  end if;

  if cardinality(normalized_ids) > 48 then
    raise exception 'At most 48 villa ids are allowed';
  end if;

  return query
  with requested as (
    select unnest(normalized_ids) as house_id
  ),
  active_configs as (
    select
      requested.house_id,
      config.id as config_id,
      nullif(btrim(config.cover_image_path), '') as cover_image_path,
      nullif(btrim(config.cover_image_url), '') as cover_image_url,
      nullif(btrim(config.cover_image_alt), '') as cover_image_alt
    from requested
    left join public.villa_card_image_configs config
      on config.page_key = 'default'
      and config.house_id = requested.house_id::text
      and config.is_active
  ),
  candidates as (
    select
      config.house_id as property_id,
      0::integer as id,
      regexp_replace(config.cover_image_path, '^.*/', '') as image_name,
      config.cover_image_url as image_url,
      config.cover_image_alt as caption,
      'cover'::text as image_zone,
      null::integer as cover_select,
      1::integer as source_rank,
      0::integer as source_order
    from active_configs config
    where config.cover_image_url is not null

    union all

    select
      image.property_id::bigint,
      image.id,
      image.image_name,
      image.image_url,
      image.caption,
      image.image_zone,
      image.cover_select,
      2,
      item.sort_order::integer
    from active_configs config
    join public.villa_card_image_items item
      on item.config_id = config.config_id
    join public.images image
      on image.id = item.image_id
      and image.property_id = config.house_id

    union all

    select
      image.property_id::bigint,
      image.id,
      image.image_name,
      image.image_url,
      image.caption,
      image.image_zone,
      image.cover_select,
      case
        when image.cover_select between 1 and 10 then 3
        when lower(btrim(coalesce(image.image_zone, ''))) = 'outside' then 4
        when lower(btrim(coalesce(image.image_zone, ''))) = 'inside' then 5
        else 6
      end,
      case
        when image.cover_select between 1 and 10 then image.cover_select
        else image.id
      end
    from requested
    join public.images image on image.property_id = requested.house_id
    where lower(btrim(coalesce(image.image_zone, ''))) not in (
      'cover',
      'รูปปก',
      'ภาพปก'
    )
  ),
  usable as (
    select
      candidate.*,
      coalesce(
        'url:' || lower(nullif(btrim(candidate.image_url), '')),
        'name:' || nullif(btrim(candidate.image_name), '')
      ) as asset_key
    from candidates candidate
    where nullif(btrim(candidate.image_url), '') is not null
       or nullif(btrim(candidate.image_name), '') is not null
  ),
  id_deduped as (
    select *
    from (
      select
        usable.*,
        row_number() over (
          partition by usable.property_id, usable.id
          order by usable.source_rank, usable.source_order, usable.id
        ) as id_position
      from usable
    ) ranked
    where ranked.id_position = 1
  ),
  asset_deduped as (
    select *
    from (
      select
        id_deduped.*,
        row_number() over (
          partition by id_deduped.property_id, id_deduped.asset_key
          order by id_deduped.source_rank, id_deduped.source_order, id_deduped.id
        ) as asset_position
      from id_deduped
    ) ranked
    where ranked.asset_position = 1
  ),
  final_ranked as (
    select
      asset_deduped.*,
      row_number() over (
        partition by asset_deduped.property_id
        order by
          asset_deduped.source_rank,
          asset_deduped.source_order,
          asset_deduped.id
      ) as final_position
    from asset_deduped
  )
  select
    final_ranked.property_id,
    final_ranked.id,
    final_ranked.image_name,
    final_ranked.image_url,
    final_ranked.caption,
    final_ranked.image_zone,
    final_ranked.cover_select,
    final_ranked.final_position::integer
  from final_ranked
  where final_ranked.final_position <= 10
  order by final_ranked.property_id, final_ranked.final_position;
end;
$$;

revoke all on function public.get_public_villa_card_images(bigint[]) from public;
grant execute on function public.get_public_villa_card_images(bigint[])
  to anon, authenticated;

notify pgrst, 'reload schema';
```

The migration itself is the minimal idempotent patch for existing projects.
Do not add seed, delete, policy-replacement, or schema-creation statements.

- [ ] **Step 4: Implement row mapping**

Validate every row defensively, ignore rows not requested, normalize image URLs
with existing helpers, map id `0` as the existing cover override, and return an
entry for every requested id even when no rows exist.

- [ ] **Step 5: Make the cached batch prefer RPC and retain compatibility fallback**

Inside each existing maximum-48 batch:

```ts
const { data, error } = await supabase.rpc(
  "get_public_villa_card_images",
  { p_house_ids: numericIds },
);

if (!error && Array.isArray(data)) {
  return mapVillaCardImageRpcRows(ids, data, supabaseUrl);
}

if (isMissingCardImageRpc(error)) {
  return fetchVillaDisplayImages(ids);
}

throw new Error(errorText(error));
```

Treat only PostgreSQL/PostgREST “function not found/schema cache” errors as
staged-deployment compatibility fallback. Other RPC errors propagate to the
existing page-level degradation path.

- [ ] **Step 6: Run RPC, batch, selector, and image tests**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/card-image-rpc.test.ts lib/villas/__tests__/card-image-batch.test.ts lib/villas/__tests__/card-image-selection.test.ts lib/villas/__tests__/images.test.ts
```

Expected: PASS. Confirm the existing 49-id test still produces two bounded
batches.

- [ ] **Step 7: Review migration and fallback**

Check the SQL has explicit grants, a 48-id cap, a ten-row-per-villa cap, no
write statements, and schema reload notification. Do not execute it against an
online project and do not commit without separate user authorization.

### Task 5: Update Architecture and Deployment Guidance

**Files:**
- Modify: `docs/ai/structure.html`
- Modify: `DEPLOY.md`

**Interfaces:**
- Documents the RPC name, migration order, lazy viewport boundary, fallback,
  cache behavior, and private-manifest boundary.

- [ ] **Step 1: Update the structure map**

Record:

- selector source order and two-image slider behavior;
- `lib/home-sections/card-image-ids.ts` ownership;
- bounded RPC ownership in `lib/villas/card-image-rpc.ts`;
- twelve cards per rail, 48 ids per database batch, ten selections per villa;
- `600px 0px` thumbnail activation;
- no browser private-manifest requests.

- [ ] **Step 2: Update deployment steps**

Add the exact migration filename and state:

1. apply `20260727090000_create_public_villa_card_images_rpc.sql`;
2. verify `get_public_villa_card_images` is visible after schema reload;
3. deploy application code;
4. retain compatibility fallback for rolling/staged deployments.

Do not add or print any new secret; this change reuses existing server-side
Supabase configuration and `IMAGE_INTERNAL_API_TOKEN`.

- [ ] **Step 3: Run documentation checks**

Run:

```powershell
rg -n "get_public_villa_card_images|600px 0px|48|ten|10" DEPLOY.md docs/ai/structure.html
git diff --check
```

Expected: the RPC and limits are documented, and `git diff --check` exits 0.

### Task 6: Full Verification

**Files:**
- Verify all modified files; no new production behavior in this task.

- [ ] **Step 1: Run focused tests**

```powershell
npm.cmd test -- lib/villas/__tests__/card-image-selection.test.ts lib/villas/__tests__/card-image-rpc.test.ts lib/villas/__tests__/card-image-batch.test.ts lib/home-sections/__tests__/card-image-ids.test.ts components/villas/listing/__tests__/villa-card-gallery-images.test.tsx components/villas/home/__tests__/page.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run the full quality gate**

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Expected: ESLint has zero errors, Vitest has zero failures, and Next production
build exits 0.

- [ ] **Step 3: Run static private-manifest checks**

```powershell
rg -n "fetch\\(|view=card|/api/villas/.*/images" components/villas/home components/villas/listing -g "*.ts" -g "*.tsx" -g "!**/__tests__/**"
```

Expected: no browser fetch of the private manifest; same-origin proxy URL
builders may still appear.

- [ ] **Step 4: Run a production browser network check**

On mobile and desktop homepage widths:

1. load the homepage with cache disabled;
2. before scrolling, confirm below-fold card thumbnail image requests are absent;
3. scroll a card into the `600px` margin and confirm its thumbnails begin loading;
4. verify a two-image villa has two selectable thumbnails;
5. verify a ten-image villa can reach image ten;
6. confirm no `/_next/image`, unexpected `_rsc`, query-free image manifest, or
   `view=card` browser request appears;
7. record initial and post-scroll image request counts.

- [ ] **Step 5: Final diff and status**

Run:

```powershell
git diff --check
git status --short
```

Report changed files, verification evidence, and the unapplied Supabase
migration. Do not commit, apply online SQL, or deploy without explicit user
instructions.
