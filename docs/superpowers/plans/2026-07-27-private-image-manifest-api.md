# Private Image Manifest API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the full and card villa image-manifest APIs private Bearer endpoints while preserving unauthenticated galleries, card sliders, downloads, exact-host enforcement, and public same-origin image delivery across all three environments.

**Architecture:** Server Components load complete gallery manifests and bounded batches of card-image manifests, then pass same-origin image-ID URLs to existing interactive Client Components. The Worker and Next Route Handler independently protect only manifest request shapes; dedicated proxy/download routes remain public and validate image ownership. Search changes from browser catalog hydration to URL-backed server pagination so the browser never needs a manifest credential.

**Tech Stack:** Next.js 16.2 App Router, React Server/Client Components, TypeScript, Vitest, Supabase JS, Cloudflare Workers/OpenNext, Cloudflare Rate Limiting, R2/Cache API.

## Global Constraints

- Visitors remain unauthenticated and can see every gallery image, use every card slider, and download images.
- Browsers never receive `IMAGE_INTERNAL_API_TOKEN` or call the full/card manifest API.
- `IMAGE_INTERNAL_API_TOKEN` is unique per environment and separate from `CALENDAR_INTERNAL_API_TOKEN`.
- Full and card manifest responses are always `Cache-Control: private, no-store`.
- Public proxy/download responses validate that `imageId` belongs to the requested villa and never expose the upstream source URL.
- Card manifests contain at most 10 images per villa and batch input is capped at 48 unique positive safe-integer villa IDs.
- Image metadata keeps the shared 12-hour data-cache policy and existing image/config invalidation tags.
- `baanparty` accepts only `www.baanpartypattaya.com` and `baanpartypattaya.com`.
- `baan02` accepts only `www.poolvillapattaya.co.th` and `poolvillapattaya.co.th`.
- `baanPMhee` accepts only `baan-pool-villa03.poolvilla.workers.dev`.
- Sibling hosts, unrelated Workers.dev hosts, HTTP, missing/malformed configuration, missing IP, and missing bindings fail closed.
- Legacy `?imageId=`/`?url=` display and download shapes remain public for compatibility but can never return a manifest.
- Preserve normal document navigation and avoid public `next/link` prefetch.
- Preserve user changes; do not reset, clean, checkout, deploy, stage, or commit without explicit user authorization.
- Before editing Next.js APIs, follow the repository-local Next.js 16.2 guides under `node_modules/next/dist/docs/01-app`.

---

### Task 1: Shared Server-Only Bearer Authentication

**Files:**
- Create: `lib/api/internal-bearer-auth.ts`
- Create: `lib/api/__tests__/internal-bearer-auth.test.ts`
- Modify: `lib/api/calendar-internal-auth.ts`
- Modify: `lib/api/__tests__/calendar-internal-auth.test.ts`

**Interfaces:**
- Consumes: a `Request`, an expected server-only token, and an API-specific unavailable message.
- Produces:

```ts
export interface InternalBearerOptions {
  expectedToken: string | undefined;
  unavailableMessage: string;
}

export async function requireInternalBearer(
  request: Request,
  options: InternalBearerOptions,
): Promise<Response | null>;
```

- Keeps `requireCalendarInternalBearer(request)` as the Calendar-specific wrapper used by existing callers.

- [ ] **Step 1: Write failing generic-auth tests**

Add cases proving configuration is checked before credentials, malformed/missing/wrong Bearer values return `401`, valid credentials return `null`, every error is `private, no-store`, `401` includes `WWW-Authenticate: Bearer`, and raw credentials are never logged.

```ts
await expect(
  requireInternalBearer(request("Bearer valid-token-value-with-32-characters"), {
    expectedToken: "valid-token-value-with-32-characters",
    unavailableMessage: "Image API is not configured.",
  }),
).resolves.toBeNull();
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```powershell
npm.cmd test -- lib/api/__tests__/internal-bearer-auth.test.ts
```

Expected: FAIL because `lib/api/internal-bearer-auth.ts` does not exist.

- [ ] **Step 3: Extract the shared implementation**

Move strict Bearer parsing, SHA-256 hashing, and equal-work comparison from the Calendar helper into the new server-only module:

```ts
import "server-only";

const MINIMUM_TOKEN_LENGTH = 32;

export async function requireInternalBearer(
  request: Request,
  { expectedToken, unavailableMessage }: InternalBearerOptions,
) {
  if (!expectedToken || expectedToken.length < MINIMUM_TOKEN_LENGTH) {
    return privateError(unavailableMessage, 503);
  }

  const supplied = readBearerCredential(request);

  if (!supplied) {
    return privateError("Unauthorized.", 401);
  }

  const [expectedHash, suppliedHash] = await Promise.all([
    hashCredential(expectedToken),
    hashCredential(supplied),
  ]);

  return equalWithoutEarlyExit(expectedHash, suppliedHash)
    ? null
    : privateError("Unauthorized.", 401);
}
```

Make the Calendar wrapper call it with `process.env.CALENDAR_INTERNAL_API_TOKEN`.

- [ ] **Step 4: Run generic and Calendar auth tests**

Run:

```powershell
npm.cmd test -- lib/api/__tests__/internal-bearer-auth.test.ts lib/api/__tests__/calendar-internal-auth.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit checkpoint only if the user authorizes commits**

```powershell
git add lib/api/internal-bearer-auth.ts lib/api/calendar-internal-auth.ts lib/api/__tests__/internal-bearer-auth.test.ts lib/api/__tests__/calendar-internal-auth.test.ts
git commit -m "refactor: share private api bearer authentication"
```

---

### Task 2: Dedicated Public Image-ID Proxy and Download Routes

**Files:**
- Modify: `lib/public-image-proxy.ts`
- Modify: `lib/villas/public-dto.ts`
- Modify: `lib/villas/public-image-route.ts`
- Modify: `components/villas/detail/gallery-urls.ts`
- Modify: `app/(public)/api/villas/[id]/images/proxy/route.ts`
- Modify: `app/(public)/api/villas/[id]/images/download/route.ts`
- Modify: `lib/__tests__/public-image-proxy.test.ts`
- Modify: `lib/villas/__tests__/image-proxy.test.ts`
- Modify: `lib/villas/__tests__/image-download.test.ts`
- Modify: `components/villas/detail/__tests__/gallery-urls.test.ts`

**Interfaces:**
- Produces:

```ts
buildVillaGalleryImageProxyPath("88", 7)
// "/api/villas/88/images/proxy?imageId=7"

buildVillaGalleryImageDownloadPath("88", 7, {
  imageName: "pool.webp",
  zoneKey: "outside",
})
// "/api/villas/88/images/download?imageId=7&name=pool.webp&zone=outside"
```

- `buildVillaImageProxyResponse` and `buildVillaImageDownloadResponse` accept either an allowlisted legacy `url` or a positive `imageId`, but prefer `imageId`.

- [ ] **Step 1: Change URL-builder tests to the dedicated routes**

Assert public DTO gallery items use `/images/proxy?imageId=...`, Gallery display transforms remain on that path, and download links use `/images/download?imageId=...`.

- [ ] **Step 2: Add ownership tests**

For both proxy and download:

```ts
fetchVillaImagesMock.mockResolvedValue([
  { id: 7, imageUrl: "https://source.example/pool.webp", imageName: "pool.webp" },
]);

const response = await buildVillaImageProxyResponse(
  new Request("https://site.test/api/villas/88/images/proxy?imageId=8"),
  "88",
);

expect(response.status).toBe(404);
expect(fetchPublicImageProxyResponseMock).not.toHaveBeenCalled();
```

Also verify `imageId=7` succeeds without returning or redirecting to the source URL.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
npm.cmd test -- lib/__tests__/public-image-proxy.test.ts lib/villas/__tests__/image-proxy.test.ts lib/villas/__tests__/image-download.test.ts components/villas/detail/__tests__/gallery-urls.test.ts
```

Expected: FAIL because builders still use the mixed `/images` route and dedicated handlers do not resolve `imageId`.

- [ ] **Step 4: Implement ID-first delivery**

Change the proxy path builder:

```ts
return `/api/villas/${encodeURIComponent(trimmedListingId)}/images/proxy?${params}`;
```

Resolve the requested ID before fetching bytes:

```ts
const images = await fetchVillaImages(id);
const image = findVillaImageById(images, requestUrl.searchParams.get("imageId"));

if (requestUrl.searchParams.has("imageId") && !image) {
  return Response.json({ error: "Image not found" }, { status: 404 });
}

return proxyVillaImage(request, requestUrl, images, image?.imageUrl);
```

Apply the same ownership-first flow to download and update Gallery URL normalization to accept only the dedicated first-party paths.

- [ ] **Step 5: Run focused tests**

Run the Step 3 command.

Expected: PASS.

- [ ] **Step 6: Search for first-party mixed delivery URLs**

Run:

```powershell
rg -n "/api/villas/.*/images\\?(imageId|download)" app components lib
```

Expected: matches only explicit legacy-compatibility tests/helpers, not normal rendered DTOs or Gallery links.

- [ ] **Step 7: Commit checkpoint only if authorized**

```powershell
git add lib/public-image-proxy.ts lib/villas/public-dto.ts lib/villas/public-image-route.ts components/villas/detail/gallery-urls.ts app/(public)/api/villas/[id]/images/proxy/route.ts app/(public)/api/villas/[id]/images/download/route.ts lib/__tests__/public-image-proxy.test.ts lib/villas/__tests__/image-proxy.test.ts lib/villas/__tests__/image-download.test.ts components/villas/detail/__tests__/gallery-urls.test.ts
git commit -m "refactor: separate villa image delivery routes"
```

---

### Task 3: Private Next.js Image Manifest Handler

**Files:**
- Create: `lib/api/image-internal-auth.ts`
- Create: `lib/api/__tests__/image-internal-auth.test.ts`
- Modify: `lib/api/rate-limit.ts`
- Modify: `lib/api/__tests__/rate-limit.test.ts`
- Modify: `lib/villas/public-image-route.ts`
- Modify: `app/(public)/api/villas/[id]/images/route.ts`
- Modify: `lib/villas/__tests__/images.test.ts`
- Modify: `lib/villas/__tests__/public-routes.test.ts`

**Interfaces:**
- Produces:

```ts
export function getVillaImagesRequestMode(
  url: URL,
): "manifest" | "card_manifest" | "legacy_display" | "legacy_download" | "invalid_private";

export async function buildPrivateVillaImageManifestResponse(
  request: Request,
  id: string,
): Promise<Response>;

export async function requireImageInternalBearer(
  request: Request,
): Promise<Response | null>;
```

- Adds local policy `"publicImageManifest"` with exactly 60 requests per IP per 60 seconds.

- [ ] **Step 1: Write request-mode tests**

Cover:

```ts
expect(getVillaImagesRequestMode(new URL("https://x/api/villas/9/images")))
  .toBe("manifest");
expect(getVillaImagesRequestMode(new URL("https://x/api/villas/9/images?view=card")))
  .toBe("card_manifest");
expect(getVillaImagesRequestMode(new URL("https://x/api/villas/9/images?imageId=7&w=828&q=60")))
  .toBe("legacy_display");
expect(getVillaImagesRequestMode(new URL("https://x/api/villas/9/images?view=card&extra=1")))
  .toBe("invalid_private");
```

Strictly allow only documented transform/download keys for legacy delivery.

- [ ] **Step 2: Write route-order tests**

Assert missing Bearer returns `401` before local rate limit and before `fetchVillaImages`/`resolveDisplayImages`; valid Bearer consumes the image-manifest bucket before ID/query validation; the 61st request returns `429`; malformed ID/query returns `400`; successes and all failures are `private, no-store`.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
npm.cmd test -- lib/api/__tests__/image-internal-auth.test.ts lib/api/__tests__/rate-limit.test.ts lib/villas/__tests__/images.test.ts lib/villas/__tests__/public-routes.test.ts
```

Expected: FAIL because image auth, request classification, and the new local policy do not exist.

- [ ] **Step 4: Add the image auth wrapper and local policy**

```ts
export function requireImageInternalBearer(request: Request) {
  return requireInternalBearer(request, {
    expectedToken: process.env.IMAGE_INTERNAL_API_TOKEN,
    unavailableMessage: "Image manifest API is not configured.",
  });
}
```

Add `"publicImageManifest"` to `PublicRateLimitPolicy` and configure `60 / 60_000`.

- [ ] **Step 5: Split manifest construction from legacy delivery**

The private builder permits only no query or exact `view=card`, validates `parseVillaId(id)`, loads `fetchVillaImages` or `resolveDisplayImages`, converts through `toPublicVillaImages`, and always returns private no-store JSON.

- [ ] **Step 6: Coordinate the route in security order**

```ts
const mode = getVillaImagesRequestMode(new URL(request.url));

if (mode === "legacy_display" || mode === "legacy_download") {
  return handleLegacyPublicImageDelivery(request, context, mode);
}

const authorizationResponse = await requireImageInternalBearer(request);
if (authorizationResponse) return authorizationResponse;

const rateLimitResponse = limitPublicApiRequest(request, "publicImageManifest");
if (rateLimitResponse) return markImageManifestResponsePrivate(rateLimitResponse);

const { id } = await context.params;
return buildPrivateVillaImageManifestResponse(request, id);
```

Malformed delivery-like queries deliberately enter the private branch and cannot bypass authentication.

- [ ] **Step 7: Run focused tests**

Run the Step 3 command.

Expected: PASS.

- [ ] **Step 8: Commit checkpoint only if authorized**

```powershell
git add lib/api/image-internal-auth.ts lib/api/__tests__/image-internal-auth.test.ts lib/api/rate-limit.ts lib/api/__tests__/rate-limit.test.ts lib/villas/public-image-route.ts app/(public)/api/villas/[id]/images/route.ts lib/villas/__tests__/images.test.ts lib/villas/__tests__/public-routes.test.ts
git commit -m "feat: protect villa image manifests with bearer auth"
```

---

### Task 4: Shared Worker Host Policy and Image Manifest Guard

**Files:**
- Create: `worker-private-api-security.js`
- Create: `worker-private-api-security.test.ts`
- Create: `worker-image-manifest-access.js`
- Create: `worker-image-manifest-access.test.ts`
- Modify: `worker-calendar-access.js`
- Modify: `worker-calendar-access.test.ts`
- Modify: `worker-cache-policy.js`
- Modify: `worker-cache-policy.test.ts`
- Modify: `worker.js`
- Modify: `wrangler.jsonc`

**Interfaces:**
- Produces:

```js
getPrivateApiHostDecision(request, {
  mode: "www-apex" | "exact",
  primaryHost: string,
})
// { allowed: boolean, reason: "hostname" | "protocol" | "config" }

hasValidWorkerBearer(request, expectedToken)
// Promise<boolean>

handleImageManifestAccess(request, env)
// Promise<Response | null>
```

- Wrangler vars:

```json
{
  "PRIVATE_API_HOST_MODE": "www-apex",
  "PRIVATE_API_PRIMARY_HOST": "www.baanpartypattaya.com"
}
```

`baanPMhee` uses mode `"exact"` and primary host
`"baan-pool-villa03.poolvilla.workers.dev"`.

- [ ] **Step 1: Write host-policy RED tests**

Test both modes, exact apex derivation only for `www-apex`, rejection of non-HTTPS requests, ports, paths embedded in configuration, blank values, unknown modes, sibling domains, and unrelated Workers.dev hosts.

- [ ] **Step 2: Write image-guard RED tests**

Prove full, card, malformed-ID, and malformed-query manifest shapes are candidates; exact legacy display/download shapes are not. Verify host → method → environment → Bearer → IP → rate-limit order, 60 successful requests then `429`, binding rejection/missing IP returns `503`, and every Worker rejection is `private, no-store`.

- [ ] **Step 3: Run Worker tests and verify RED**

Run:

```powershell
npm.cmd test -- worker-private-api-security.test.ts worker-image-manifest-access.test.ts worker-calendar-access.test.ts worker-cache-policy.test.ts
```

Expected: FAIL because the shared policy and image guard do not exist and Calendar still derives hosts from `NEXT_PUBLIC_SITE_URL`.

- [ ] **Step 4: Implement strict shared host and Bearer helpers**

For `www-apex`, require a hostname-only `primaryHost` beginning with `www.` and allow only it plus `slice(4)`. For `exact`, allow one hostname only. Reject values containing schemes, slashes, whitespace, credentials, ports, or empty labels.

Use `crypto.subtle.digest("SHA-256", ...)` and
`crypto.subtle.timingSafeEqual(...)` for Worker Bearer comparison.

- [ ] **Step 5: Move Calendar to the shared host policy**

Replace Calendar's `NEXT_PUBLIC_SITE_URL` decision with:

```js
getPrivateApiHostDecision(request, {
  mode: env?.PRIVATE_API_HOST_MODE,
  primaryHost: env?.PRIVATE_API_PRIMARY_HOST,
});
```

Add the exact `baanPMhee` positive case and retain all fail-closed tests.

- [ ] **Step 6: Implement the image manifest candidate classifier**

Treat `/api/villas/<one-nonempty-segment>/images` as private unless its query is an exact allowlisted legacy display/download shape. Do not validate numeric villa IDs in the Worker; Next validates them after auth and rate limiting.

- [ ] **Step 7: Run image guard before every cache**

In `worker.js`, execute Calendar then Image Manifest access before
`fetchWithImageEdgeCache`. Update comments to state both private APIs bypass every cache lookup.

- [ ] **Step 8: Remove manifest JSON caching**

`getJsonEdgeCacheDecision` must not consider full or card image manifests cacheable. Keep public proxy bytes in the image cache and keep unrelated image-list/card variants from creating JSON cache keys.

- [ ] **Step 9: Configure all environments**

Add unique rate-limit bindings:

```json
{ "name": "IMAGE_API_RATE_LIMITER", "namespace_id": "91014", "simple": { "limit": 60, "period": 60 } }
{ "name": "IMAGE_API_RATE_LIMITER", "namespace_id": "92014", "simple": { "limit": 60, "period": 60 } }
{ "name": "IMAGE_API_RATE_LIMITER", "namespace_id": "93014", "simple": { "limit": 60, "period": 60 } }
```

Add `IMAGE_INTERNAL_API_TOKEN` to each environment's required secrets and add the exact host vars from the design.

- [ ] **Step 10: Run Worker tests**

Run the Step 3 command.

Expected: PASS.

- [ ] **Step 11: Commit checkpoint only if authorized**

```powershell
git add worker-private-api-security.js worker-private-api-security.test.ts worker-image-manifest-access.js worker-image-manifest-access.test.ts worker-calendar-access.js worker-calendar-access.test.ts worker-cache-policy.js worker-cache-policy.test.ts worker.js wrangler.jsonc
git commit -m "feat: guard private image manifests at the edge"
```

---

### Task 5: Server-Preload the Complete Villa Gallery

**Files:**
- Modify: `lib/villas/server.ts`
- Modify: `app/(public)/villas/[id]/page.tsx`
- Modify: `components/villas/detail/types.ts`
- Modify: `components/villas/detail/page.tsx`
- Modify: `components/villas/detail/detail-client-shell.tsx`
- Modify: `components/villas/detail/use-villa-gallery.ts`
- Modify: `components/villas/detail/__tests__/page.test.tsx`
- Modify: `components/villas/detail/__tests__/gallery.test.tsx`
- Modify: `components/villas/detail/__tests__/detail-layout-renderer.test.tsx`

**Interfaces:**
- `fetchVillaPageData(id)` returns `galleryImages: PublicVillaImage[]` containing the complete normalized gallery.
- `VillaDetailPage`, `DetailClientShell`, and `useVillaGallery` consume `galleryImages` as complete data, not as a preview that triggers a browser request.

- [ ] **Step 1: Write no-browser-fetch tests**

Render/open the Gallery using a complete server prop and assert:

```ts
expect(fetchMock).not.toHaveBeenCalled();
expect(renderedImageIds).toEqual(["1", "2", "3", "4", "5"]);
```

Add a degraded test showing cover/preview UI remains available when full gallery loading returns an empty fallback.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm.cmd test -- components/villas/detail/__tests__/page.test.tsx components/villas/detail/__tests__/gallery.test.tsx components/villas/detail/__tests__/detail-layout-renderer.test.tsx
```

Expected: FAIL because `useVillaGallery` still fetches `/api/villas/:id/images`.

- [ ] **Step 3: Load the full gallery in `fetchVillaPageData`**

Replace the four-image preview result with:

```ts
const galleryImagesPromise = fetchVillaImages(id)
  .catch(async (error) => {
    console.error("Unable to load complete villa gallery", error);
    return fetchVillaPreviewImages(id).catch(() => []);
  });
```

Return `toPublicVillaImages(id, galleryImages)` without slicing to four.

- [ ] **Step 4: Remove the manifest request from the Gallery hook**

Initialize the hook with the complete `galleryImages` prop. `loadGallery()` returns that in-memory array and exposes the existing loaded/empty state without `fetch`, `AbortController`, or an in-flight request ref.

- [ ] **Step 5: Propagate the renamed contract**

Rename `initialGalleryImages` to `galleryImages` through the page/detail prop chain so future callers cannot mistake it for a partial payload.

- [ ] **Step 6: Run focused tests**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 7: Static browser-fetch search**

Run:

```powershell
rg -n "fetch\\(`/api/villas/.*/images|fetch\\(\"/api/villas/.*/images" components/villas/detail
```

Expected: no manifest fetch.

- [ ] **Step 8: Commit checkpoint only if authorized**

```powershell
git add lib/villas/server.ts app/(public)/villas/[id]/page.tsx components/villas/detail/types.ts components/villas/detail/page.tsx components/villas/detail/detail-client-shell.tsx components/villas/detail/use-villa-gallery.ts components/villas/detail/__tests__/page.test.tsx components/villas/detail/__tests__/gallery.test.tsx components/villas/detail/__tests__/detail-layout-renderer.test.tsx
git commit -m "refactor: preload complete villa galleries on the server"
```

---

### Task 6: Bounded Batch Card-Image Loader

**Files:**
- Create: `lib/villas/card-image-selection.ts`
- Create: `lib/villas/card-image-batch.ts`
- Create: `lib/villas/__tests__/card-image-selection.test.ts`
- Create: `lib/villas/__tests__/card-image-batch.test.ts`
- Modify: `lib/villas/images.ts`
- Modify: `lib/villas/__tests__/images.test.ts`
- Modify: `lib/villas/public-dto.ts`

**Interfaces:**
- Produces:

```ts
export const MAX_VILLA_CARD_IMAGE_BATCH_SIZE = 48;

export async function fetchVillaDisplayImagesBatch(
  villaIds: readonly string[],
): Promise<Map<string, VillaImage[]>>;

export async function fetchPublicVillaCardImageUrls(
  villaIds: readonly string[],
): Promise<Record<string, string[]>>;
```

- `selectVillaCardDisplayImages(images, config)` becomes the pure shared rule used by both single-villa and batch loaders.

- [ ] **Step 1: Write pure selection tests**

Copy the existing behavioral cases into a pure fixture-driven suite: custom order wins with at least 3 usable images, uploaded cover is first and suppresses old covers, recommended `cover_select` order is used without custom config, default outside/inside ordering remains, duplicates are removed, and output is capped at 10.

- [ ] **Step 2: Write batch contract tests**

Verify invalid IDs are ignored, duplicates are deduplicated, more than 48 unique valid IDs throws `"Too many villa ids"`, rows/configs are grouped correctly, one invalid row affects only its villa, and a dependency failure returns an empty record only when caught by the page-level caller.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/card-image-selection.test.ts lib/villas/__tests__/card-image-batch.test.ts lib/villas/__tests__/images.test.ts
```

Expected: FAIL because the pure selection and batch modules do not exist.

- [ ] **Step 4: Extract the pure rule**

Move the custom/recommended/default resolution from
`resolveDisplayImagesFromSupabase` behind:

```ts
export function selectVillaCardDisplayImages({
  config,
  images,
  recommendedImages,
}: SelectVillaCardDisplayImagesInput): VillaImage[] {
  // Apply the existing ordering and minimum/maximum rules exactly once.
}
```

Keep `resolveDisplayImages(id)` using this function so behavior does not diverge.

- [ ] **Step 5: Implement two bounded Supabase batch reads**

The batch module:

1. normalizes and sorts unique IDs;
2. queries `images` with `.in("property_id", numericIds)`;
3. retries once with legacy columns only for the existing missing-`image_url` error;
4. queries active `villa_card_image_configs` and nested ordered items with `.in("house_id", ids)`;
5. groups both results by villa ID;
6. applies the pure selector per ID.

Do not issue one Supabase query per villa.

- [ ] **Step 6: Add 12-hour tagged caching**

Use a stable sorted-ID cache key and tags:

```ts
[
  CACHE_TAGS.villaImages,
  CACHE_TAGS.villaCardImages,
  ...ids.flatMap((id) => [
    CACHE_TAGS.villaImage(id),
    CACHE_TAGS.villaCardImage(VILLA_CARD_IMAGE_CONFIG_PAGE_KEY, id),
  ]),
]
```

- [ ] **Step 7: Convert raw images to serializable public URLs**

`fetchPublicVillaCardImageUrls` returns an object keyed by villa ID and maps each raw image through `toPublicVillaImage`, dropping invalid entries.

- [ ] **Step 8: Run focused tests**

Run the Step 3 command.

Expected: PASS.

- [ ] **Step 9: Commit checkpoint only if authorized**

```powershell
git add lib/villas/card-image-selection.ts lib/villas/card-image-batch.ts lib/villas/__tests__/card-image-selection.test.ts lib/villas/__tests__/card-image-batch.test.ts lib/villas/images.ts lib/villas/__tests__/images.test.ts lib/villas/public-dto.ts
git commit -m "feat: batch villa card image manifests"
```

---

### Task 7: Supply Static Card Manifests to Home and Recommendations

**Files:**
- Modify: `components/villas/listing/villa-card.tsx`
- Modify: `components/villas/listing/villa-card-gallery-images.tsx`
- Modify: `components/villas/listing/__tests__/villa-card-gallery-images.test.tsx`
- Modify: `components/villas/home/villa-rail.tsx`
- Modify: `components/villas/home/page.tsx`
- Modify: `components/villas/home/__tests__/request-budget.test.tsx`
- Modify: `app/(public)/(home)/page.tsx`
- Modify: `app/(public)/api/home-sections/route.ts`
- Modify: `lib/home-sections/server.ts`
- Modify: `components/villas/detail/deferred-detail-block.tsx`
- Modify: `components/villas/detail/__tests__/deferred-detail-block.test.tsx`
- Modify: `app/(public)/villas/[id]/page.tsx`

**Interfaces:**
- `VillaRail` accepts:

```ts
cardImageUrlsByVillaId?: Record<string, string[]>;
```

- The shared home-section server helper returns resolved public sections without forcing browser fetch.
- `DeferredRecommendedVillas` receives the recommendation section plus
`cardImageUrlsByVillaId` as props and remains viewport-deferred without fetching.

- [ ] **Step 1: Make client components fail when static data is omitted intentionally**

Add a `disableManifestFetch`/complete-data contract rather than using `undefined` ambiguously:

```ts
interface VillaCardGalleryImagesProps {
  staticImageUrls: string[];
}
```

Update tests to assert Gallery Card never calls `fetch`, including empty and cover-only arrays.

- [ ] **Step 2: Run card tests and verify RED**

Run:

```powershell
npm.cmd test -- components/villas/listing/__tests__/villa-card-gallery-images.test.tsx components/villas/home/__tests__/request-budget.test.tsx components/villas/detail/__tests__/deferred-detail-block.test.tsx
```

Expected: FAIL because card/recommendation components still fetch manifests.

- [ ] **Step 3: Remove card manifest fetching**

Delete the `useEffect`, `IntersectionObserver`, `AbortController`, response parsing, and loading state that call `view=card`. Derive slider state only from:

```ts
selectVillaCardGalleryImages(coverImageSrc, staticImageUrls.map((imageUrl) => ({
  imageUrl,
})));
```

Keep thumbnail interaction, lazy image loading, and cover fallback.

- [ ] **Step 4: Load Home card manifests once**

After resolving Home sections, collect unique IDs from rendered rails, call
`fetchPublicVillaCardImageUrls(ids)` once, catch a batch failure to `{}`, store
the record in `HomePageData`, and pass it through `HomePageContent` →
`VillaRail` → `VillaCard`.

- [ ] **Step 5: Extract reusable server Home-section resolution**

Move the data work currently owned only by `/api/home-sections` into a shared
server function that returns public resolved sections. Keep the public API
route as a thin coordinator for unrelated consumers.

- [ ] **Step 6: Server-load detail recommendations**

The Villa page starts recommendation and card-manifest work on the server. Pass
the result into the deferred recommendation block. The block keeps viewport
render deferral but removes its module-level promise and
`fetch("/api/home-sections")`.

- [ ] **Step 7: Run focused tests**

Run the Step 2 command.

Expected: PASS and no card/recommendation manifest fetch.

- [ ] **Step 8: Run request-budget searches**

```powershell
rg -n "view=card|fetch\\(\"/api/home-sections\"|fetch\\('/api/home-sections'" components/villas
```

Expected: no first-party card manifest or deferred recommendation fetch.

- [ ] **Step 9: Commit checkpoint only if authorized**

```powershell
git add components/villas/listing/villa-card.tsx components/villas/listing/villa-card-gallery-images.tsx components/villas/listing/__tests__/villa-card-gallery-images.test.tsx components/villas/home/villa-rail.tsx components/villas/home/page.tsx components/villas/home/__tests__/request-budget.test.tsx app/(public)/(home)/page.tsx app/(public)/api/home-sections/route.ts lib/home-sections/server.ts components/villas/detail/deferred-detail-block.tsx components/villas/detail/__tests__/deferred-detail-block.test.tsx app/(public)/villas/[id]/page.tsx
git commit -m "refactor: render card manifests from server data"
```

---

### Task 8: Convert Search to Server Pagination with Card Manifests

**Files:**
- Modify: `components/villas/search/page-data.ts`
- Modify: `components/villas/search/page.tsx`
- Modify: `components/villas/search/search-page-helpers.ts`
- Modify: `components/villas/search/search-bar.tsx`
- Modify: `components/villas/search/mobile-filter-drawer.tsx`
- Modify: `components/villas/search/__tests__/page.test.tsx`
- Modify: `components/villas/listing/villa-grid.tsx`
- Modify: `app/(public)/search/page.tsx`

**Interfaces:**
- `getSearchPageData` returns:

```ts
interface SearchPageInitialMeta {
  maxPrice: number;
  page: number;
  pageSize: 12;
  resultCount: number;
  totalPages: number;
  zones: { value: string; label: string }[];
}

interface SearchPageData {
  cardImageUrlsByVillaId: Record<string, string[]>;
  error: string | null;
  meta: SearchPageInitialMeta;
  villas: VillaListing[];
}
```

- Page query `page` is a positive integer capped to `totalPages`; all other
existing search filters/sort/ID behavior remains.

- [ ] **Step 1: Rewrite tests around document navigation**

Replace expectations for `/api/houses` browser fetch, session snapshots, abort
controllers, and append state with assertions that:

- initial server villas render with supplied static card images;
- applying filters builds `/search?...&page=1`;
- sorting resets `page=1`;
- next/previous controls preserve filters;
- page size is 12;
- no `fetch` occurs after interaction;
- loading, empty, error, long-label, desktop, and mobile controls remain usable.

- [ ] **Step 2: Run Search tests and verify RED**

Run:

```powershell
npm.cmd test -- components/villas/search/__tests__/page.test.tsx
```

Expected: FAIL because the client still hydrates/appends through `/api/houses`.

- [ ] **Step 3: Make page-data truly page-aware**

Parse `page` from the route search params, call `fetchVillaSearchPage` with
`pageSize: 12`, convert listings, batch their card images, and calculate:

```ts
totalPages: Math.max(1, Math.ceil(result.total / PAGE_SIZE));
```

Catch card-manifest failure separately so listings still render with cover-only
cards.

- [ ] **Step 4: Pass card manifests through the grid**

```tsx
<VillaGrid
  villas={villas}
  cardImageUrlsByVillaId={cardImageUrlsByVillaId}
/>
```

`VillaGrid` passes `cardImageUrlsByVillaId[villa.id] ?? []` to every card.

- [ ] **Step 5: Remove browser catalog hydration**

Delete `/api/houses` fetches, catalog append state, abort/request refs,
sessionStorage snapshots, and client-side full-catalog filtering. Keep draft
control state for usability.

- [ ] **Step 6: Navigate through explicit URLs**

On Search/apply, serialize the existing filters, ID, and sort, set `page=1`,
then use normal document navigation:

```ts
window.location.assign(`/search?${params.toString()}`);
```

Render pagination with plain `<a href>` controls and no `next/link` prefetch.

- [ ] **Step 7: Keep accessible loading/navigation behavior**

Retain `/search/loading.tsx` or the existing route Suspense boundary, visible
focus states, button/label names, mobile drawer behavior, empty/error panels,
and scroll-to-results behavior after a new document load.

- [ ] **Step 8: Run Search and listing tests**

Run:

```powershell
npm.cmd test -- components/villas/search/__tests__/page.test.tsx components/villas/listing/__tests__/villa-card-gallery-images.test.tsx components/villas/listing/__tests__/villa-card-navigation.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Static browser-fetch search**

```powershell
rg -n "/api/houses|view=card|/api/villas/.*/images" components/villas/search components/villas/listing
```

Expected: no manifest or catalog fetch used to hydrate Search/Card sliders.

- [ ] **Step 10: Commit checkpoint only if authorized**

```powershell
git add components/villas/search/page-data.ts components/villas/search/page.tsx components/villas/search/search-page-helpers.ts components/villas/search/search-bar.tsx components/villas/search/mobile-filter-drawer.tsx components/villas/search/__tests__/page.test.tsx components/villas/listing/villa-grid.tsx app/(public)/search/page.tsx
git commit -m "refactor: server-render paginated search card images"
```

---

### Task 9: Documentation, Configuration Guidance, and End-to-End Verification

**Files:**
- Modify: `DEPLOY.md`
- Modify: `docs/ai/structure.html`
- Modify: `docs/superpowers/specs/2026-07-27-private-image-manifest-api-design.md` only if implementation reveals an approved contract correction
- Test: all focused files from Tasks 1-8

**Interfaces:**
- Documents the exact three-environment host table, separate Image secret,
separate rate-limit binding, build-per-env rule, production probes, rollback,
and the distinction between private manifests and public image bytes.

- [ ] **Step 1: Update deployment documentation**

Add compatible PowerShell generation/upload commands for
`IMAGE_INTERNAL_API_TOKEN` for `baanparty`, `baan02`, and `baanPMhee`; state
that values must be independently generated and Cloudflare cannot reveal them
after storage.

List expected dry-run bindings:

```text
IMAGE_API_RATE_LIMITER
PRIVATE_API_HOST_MODE
PRIVATE_API_PRIMARY_HOST
```

- [ ] **Step 2: Update the architecture map**

Document:

- manifest/private vs proxy/download/public ownership;
- full Gallery server preload;
- bounded 48-villa card batch;
- Home/Search/recommendation server data flow;
- Search server pagination;
- Worker cache exclusions and host modes;
- focused test commands and production network assertions.

- [ ] **Step 3: Run focused security/data/UI suites**

```powershell
npm.cmd test -- lib/api worker-private-api-security.test.ts worker-image-manifest-access.test.ts worker-calendar-access.test.ts worker-cache-policy.test.ts lib/villas/__tests__/public-routes.test.ts lib/villas/__tests__/images.test.ts lib/villas/__tests__/image-proxy.test.ts lib/villas/__tests__/image-download.test.ts lib/villas/__tests__/card-image-selection.test.ts lib/villas/__tests__/card-image-batch.test.ts components/villas/detail components/villas/listing components/villas/search components/villas/home
```

Expected: PASS.

- [ ] **Step 4: Run full repository gates**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
git diff --check
```

Expected: all tests pass, lint has zero errors, build exits 0, and diff check is clean. Existing unrelated warnings must be reported, not silently attributed to this work.

- [ ] **Step 5: Run local production browser checks**

Build and start the production app, then inspect `/`, `/search`, and
`/villas/1981` at desktop and mobile widths:

- card sliders work;
- Gallery opens all server-provided images;
- download produces an attachment;
- no browser request hits full manifest or `view=card`;
- no upstream source hostname appears;
- no `/_next/image` request appears;
- image proxy counts remain lazy/bounded;
- loading, empty, error, and cover-only fallbacks render.

- [ ] **Step 6: Configure secrets before any deployment**

The owner creates one unique `IMAGE_INTERNAL_API_TOKEN` per environment:

```powershell
npx.cmd wrangler secret put IMAGE_INTERNAL_API_TOKEN -e baanparty
npx.cmd wrangler secret put IMAGE_INTERNAL_API_TOKEN -e baan02
npx.cmd wrangler secret put IMAGE_INTERNAL_API_TOKEN -e baanPMhee
```

Verify names only with `wrangler secret list`; never print real values.

- [ ] **Step 7: Run Wrangler dry-runs only with explicit external-transmission approval**

```powershell
npx.cmd wrangler deploy --dry-run -e baanparty
npx.cmd wrangler deploy --dry-run -e baan02
npx.cmd wrangler deploy --dry-run -e baanPMhee
```

Expected: each environment shows its unique Calendar/Image rate limiters and
exact host vars. Dry-run may send the Worker bundle and configuration-derived
metadata to Cloudflare, so do not run it without explicit approval.

- [ ] **Step 8: Production verification after owner-authorized deployment**

For each environment separately:

- unauthenticated manifest request returns `401`;
- valid server Bearer returns `200 private, no-store`;
- sibling/unrelated host is rejected;
- `baanPMhee` exact Workers.dev host is accepted and other Workers.dev hosts
  are rejected;
- proxy/download work without Bearer and reject cross-villa image IDs;
- Browser network assertions from Step 5 remain true.

- [ ] **Step 9: Request a final code review**

Review the complete diff against
`docs/superpowers/specs/2026-07-27-private-image-manifest-api-design.md`.
Block completion for any Critical or Important finding; fix all security and
runtime issues before repeating full verification.

- [ ] **Step 10: Commit checkpoint only if authorized**

```powershell
git add DEPLOY.md docs/ai/structure.html docs/superpowers/specs/2026-07-27-private-image-manifest-api-design.md
git commit -m "docs: document private image manifest deployment"
```

