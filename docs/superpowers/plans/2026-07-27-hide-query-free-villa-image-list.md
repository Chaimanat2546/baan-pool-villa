# Hide Query-Free Villa Image List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop query-free and unsupported `/api/villas/:id/images` requests from returning the complete image manifest, preserve the supported public image flows, move the complete detail gallery to server props, keep the admin picker functional through its authenticated API, and prevent normal homepage image traffic from sharing the 90-request detail bucket.

**Architecture:** Add one explicit request classifier in the existing public image-route helper and apply its policy only after request validation. Keep `view=card`, validated image delivery, and downloads as separate modes. Load the complete normalized gallery through the cached server helper for villa detail pages, and attach admin gallery data to the existing authorized admin response. Narrow the Worker JSON-cache candidate to the exact card query.

**Tech Stack:** Next.js 16.2 App Router route handlers and Server Components, React 19 client components, TypeScript, Vitest, Supabase-backed cached data helpers, and the existing Cloudflare/OpenNext Worker cache policy.

## Global Constraints

- The approved design is `docs/superpowers/specs/2026-07-27-hide-query-free-villa-image-list-design.md`; it is the source of truth for this plan.
- Do not use `docs/superpowers/plans/2026-07-27-private-image-manifest-api.md`; it predates the approved narrower design.
- Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` before changing route handlers and preserve the documented Next.js 16 route-handler conventions.
- Keep public images public. This change removes a convenient complete JSON manifest; it does not claim to prevent determined scraping of rendered public images.
- Do not trust `X-Forwarded-For`. Only `CF-Connecting-IP` may identify a rate-limit client.
- Do not change the shared 12-hour public data-cache policy, the `43200` second ISR policy, image source validation, transform validation, or existing cache tags.
- Do not add browser tokens, internal Bearer tokens to public pages, Turnstile, WAF rules, Supabase migrations, or a broad cache purge.
- Preserve unrelated user changes in the working tree.
- The user has not authorized a commit. Use test and diff checkpoints only; do not run `git add`, `git commit`, or push.
- If Vitest fails with the known sandbox `spawn EPERM`, rerun the same command with the required execution approval rather than changing the test configuration.

## Public Contracts and Types

Add these route-classification types in `lib/villas/public-image-route.ts`:

```ts
export type VillaImagesRequestMode = "card" | "display" | "download";

export type VillaImagesRequestDecision =
  | {
      mode: VillaImagesRequestMode;
      ok: true;
      policy: PublicRateLimitPolicy;
    }
  | { ok: false };

export function classifyVillaImagesRequest(
  request: Request,
): VillaImagesRequestDecision;

export function villaImagesNotFoundResponse(): Response;
```

Extend `PublicRateLimitPolicy` in `lib/api/rate-limit.ts` with:

```ts
| "publicImageManifest"
| "publicImageDelivery"
```

The policy values are fixed:

| Policy | Limit | Window |
| --- | ---: | ---: |
| `publicDetail` | 90 | 60 seconds |
| `publicImageManifest` | 120 | 60 seconds |
| `publicImageDelivery` | 600 | 60 seconds |
| `publicDownload` | 20 | 60 seconds |

Extend the server/client detail data contract with:

```ts
initialGalleryLoadFailed: boolean;
```

Extend the existing admin GET response with:

```ts
images?: PublicVillaImage[];
```

`images` is present for the valid `houseId` detail request and omitted for paginated house-list requests.

## File Map

| File | Responsibility in this change |
| --- | --- |
| `lib/api/rate-limit.ts` | Add image-manifest/image-delivery buckets and development-only headerless bypass. |
| `lib/api/__tests__/rate-limit.test.ts` | Lock policy values, bucket isolation, homepage-sized traffic, and environment behavior. |
| `app/(public)/api/villas/[id]/images/route.ts` | Validate villa ID, classify request, reject unsupported shapes, then apply the selected limiter. |
| `app/(public)/api/villas/[id]/images/proxy/route.ts` | Use the image-delivery bucket. |
| `lib/villas/public-image-route.ts` | Own the strict query allowlist, generic 404 response, and mode-specific response builder. |
| `lib/villas/__tests__/images.test.ts` | Cover the public route matrix and remove the old query-free success expectation. |
| `lib/villas/__tests__/image-proxy.test.ts` | Preserve dedicated proxy behavior under the delivery policy. |
| `worker-cache-policy.js` | Make only exact `view=card` image-list requests JSON-cache candidates. |
| `worker-cache-policy.test.ts` | Prove query-free/extra-query variants cannot use the JSON edge cache. |
| `lib/villas/server.ts` | Fetch the complete cached gallery for the server-rendered detail payload. |
| `lib/villas/images.ts` | Remove the superseded preview-only cached helper. |
| `lib/villas/__tests__/server.test.ts` | Cover complete gallery serialization and recoverable gallery failure. |
| `components/villas/detail/detail-page-helpers.ts` | Replace deferred-load states with server-result states. |
| `components/villas/detail/use-villa-gallery.ts` | Remove the query-free browser fetch and derive gallery state from props. |
| `components/villas/detail/detail-client-shell.tsx` | Remove async gallery loading/retry callbacks and use a document reload URL. |
| `components/villas/detail/detail-page-gallery.tsx` | Render retry controls as normal anchors. |
| `components/villas/detail/page.tsx` | Pass the server gallery failure flag into the client shell. |
| `components/villas/detail/types.ts` | Declare the new detail prop. |
| `app/(public)/villas/[id]/page.tsx` | Pass both complete gallery data and its failure flag. |
| Detail tests | Prove complete server gallery behavior and absence of the public manifest fetch. |
| `lib/villas/card-image-config-admin.ts` | Attach normalized gallery data to the already-authorized admin detail response. |
| `components/admin/villa-card-images/admin-villa-card-images-page.tsx` | Consume images from the protected response and remove the public fetch. |
| Admin tests | Prove authorization headers remain and there is only one admin read. |
| `docs/ai/structure.html` | Update route, data-flow, cache, rate-limit, and verification ownership. |

---

### Task 1: Split image rate-limit policies and fix local-development exhaustion

**Files:**

- Modify: `lib/api/rate-limit.ts`
- Modify: `lib/api/__tests__/rate-limit.test.ts`
- Modify: `app/(public)/api/villas/[id]/images/proxy/route.ts`
- Verify: `lib/villas/__tests__/image-proxy.test.ts`

- [ ] **Step 1: Add failing policy-boundary and isolation tests**

Add test cleanup so environment stubs never leak:

```ts
afterEach(() => {
  vi.unstubAllEnvs();
});
```

Test the exact public contract through observable request boundaries rather
than asserting the configuration object directly:

```ts
for (let index = 0; index < 120; index += 1) {
  expect(
    limitPublicApiRequest(manifestRequest, "publicImageManifest"),
  ).toBeNull();
}
expect(
  limitPublicApiRequest(manifestRequest, "publicImageManifest")?.status,
).toBe(429);

for (let index = 0; index < 600; index += 1) {
  expect(
    limitPublicApiRequest(deliveryRequest, "publicImageDelivery"),
  ).toBeNull();
}
expect(
  limitPublicApiRequest(deliveryRequest, "publicImageDelivery")?.status,
).toBe(429);
```

Add a same-client isolation test that exhausts `publicDetail` and then confirms the first manifest, delivery, and download requests are still allowed. Add a representative homepage workload test using one IP, 12 manifest requests, and 120 delivery requests; every request must be allowed.

- [ ] **Step 2: Add failing environment-behavior tests**

Cover all three cases explicitly:

```ts
it("bypasses headerless requests only in development", () => {
  vi.stubEnv("NODE_ENV", "development");
  const request = new Request("https://example.com/api/villas/9/images");

  for (let index = 0; index < 700; index += 1) {
    expect(limitPublicApiRequest(request, "publicImageDelivery")).toBeNull();
  }
});

it("still limits development requests with CF-Connecting-IP", () => {
  vi.stubEnv("NODE_ENV", "development");
  const request = new Request("https://example.com/api/villas/9/images", {
    headers: { "CF-Connecting-IP": "203.0.113.20" },
  });

  for (
    let index = 0;
    index < 120;
    index += 1
  ) {
    expect(limitPublicApiRequest(request, "publicImageManifest")).toBeNull();
  }

  expect(
    limitPublicApiRequest(request, "publicImageManifest")?.status,
  ).toBe(429);
});
```

Keep the existing test-environment assertion that headerless requests share the fail-safe `unknown` client. Keep the existing assertion that `X-Forwarded-For` is ignored.

- [ ] **Step 3: Run the red tests**

Run:

```powershell
npm.cmd test -- lib/api/__tests__/rate-limit.test.ts
```

Expected: failures because both new policies and the development bypass do not exist.

- [ ] **Step 4: Implement the two policies**

Extend `PublicRateLimitPolicy` and `PUBLIC_RATE_LIMIT_POLICIES`:

```ts
publicImageManifest: {
  limit: 120,
  windowMs: ONE_MINUTE_MS,
},
publicImageDelivery: {
  limit: 600,
  windowMs: ONE_MINUTE_MS,
},
```

Do not change the existing catalog, detail, calendar, or download limits.

- [ ] **Step 5: Implement the narrow development bypass**

At the start of `limitPublicApiRequest`, before bucket pruning or mutation, return `null` only when:

```ts
process.env.NODE_ENV === "development" &&
readTrimmedHeader(request.headers, "CF-Connecting-IP") === null
```

Do not put this behavior inside `getPublicRateLimitClientKey`; that helper must retain the production/test fallback to `"unknown"`.

- [ ] **Step 6: Move the dedicated villa proxy route to the delivery policy**

In `app/(public)/api/villas/[id]/images/proxy/route.ts`, change only:

```ts
limitPublicApiRequest(request, "publicImageDelivery");
```

The dedicated download route stays on `publicDownload`.

- [ ] **Step 7: Run focused green tests**

Run:

```powershell
npm.cmd test -- lib/api/__tests__/rate-limit.test.ts lib/villas/__tests__/image-proxy.test.ts
```

Expected: all tests pass, including existing fixed-window, pruning, trusted-header, and proxy tests.

- [ ] **Step 8: Review the task diff**

Run:

```powershell
git diff -- lib/api/rate-limit.ts lib/api/__tests__/rate-limit.test.ts "app/(public)/api/villas/[id]/images/proxy/route.ts"
git diff --check
```

Confirm there is no `X-Forwarded-For` fallback and no policy limit outside the approved table changed.

---

### Task 2: Reject the full manifest and narrow the Worker JSON cache

**Files:**

- Modify: `lib/villas/public-image-route.ts`
- Modify: `app/(public)/api/villas/[id]/images/route.ts`
- Modify: `lib/villas/__tests__/images.test.ts`
- Modify: `worker-cache-policy.js`
- Modify: `worker-cache-policy.test.ts`

- [ ] **Step 1: Add the failing request-classification matrix**

In `lib/villas/__tests__/images.test.ts`, import the classifier and assert these valid decisions:

```ts
[
  ["?view=card", "card", "publicImageManifest"],
  ["?imageId=7", "display", "publicImageDelivery"],
  ["?imageId=7&w=828&q=60", "display", "publicImageDelivery"],
  ["?url=https%3A%2F%2Fimages.example.com%2Fpool.jpg", "display", "publicImageDelivery"],
  ["?download=1&imageId=7&name=pool&zone=outside", "download", "publicDownload"],
]
```

Assert `{ ok: false }` for each unsupported shape:

```ts
[
  "",
  "?debug=1",
  "?view=card&debug=1",
  "?view=card&view=card",
  "?view=full",
  "?imageId=7&imageId=8",
  "?imageId=7&url=https%3A%2F%2Fimages.example.com%2Fpool.jpg",
  "?imageId=7&name=pool",
  "?w=828",
  "?download=0&imageId=7",
  "?download=1",
  "?download=1&imageId=7&w=828",
]
```

- [ ] **Step 2: Replace the old query-free success test with route rejection tests**

Delete the expectation that the query-free route returns `200` and same-origin images. Replace it with tests that assert:

```ts
expect(response.status).toBe(404);
expect(response.headers.get("Cache-Control")).toBe("private, no-store");
await expect(response.json()).resolves.toEqual({ error: "Not found" });
expect(createClientMock).not.toHaveBeenCalled();
```

Run the same assertions for query-free, `?debug=1`, duplicate `view`, and `view=card` with an extra key.

Send more than 120 rejected requests with one `CF-Connecting-IP`, then send one valid `?view=card` request and assert it is not `429`. This proves rejection happens before rate-limit mutation.

Change the existing repeated-request rate-limit test to use `?view=card` and `PUBLIC_RATE_LIMIT_POLICIES.publicImageManifest.limit`. Change the backend-failure test to use a recognized image request such as `?imageId=7`, so it still reaches Supabase.

- [ ] **Step 3: Run the route tests red**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/images.test.ts
```

Expected: the classifier import is missing, query-free requests still return the old list, and card traffic still uses the wrong policy.

- [ ] **Step 4: Implement the explicit classifier**

In `lib/villas/public-image-route.ts`, use `URLSearchParams.entries()` and a `Set` to reject duplicate parameter names before mode selection. Do not validate the content of `imageId`, `url`, `w`, or `q` in the classifier; recognized malformed values must continue to reach the existing mode-specific `400`/`404` validation.

Use these exact allowed-key sets:

```ts
const DISPLAY_QUERY_KEYS = new Set(["imageId", "url", "w", "q"]);
const DOWNLOAD_QUERY_KEYS = new Set([
  "download",
  "imageId",
  "url",
  "name",
  "zone",
]);
```

Classification order:

1. Reject any duplicate name.
2. Accept card mode only when the sole entry is exactly `view=card`.
3. Require exactly one selector name: `imageId` XOR `url`.
4. If `download` is present, require `download=1` and only download keys.
5. Otherwise require only display keys.
6. Reject everything else.

Return the policies from the approved contract:

```ts
{ ok: true, mode: "card", policy: "publicImageManifest" }
{ ok: true, mode: "display", policy: "publicImageDelivery" }
{ ok: true, mode: "download", policy: "publicDownload" }
```

- [ ] **Step 5: Add the generic rejection response and mode-only builder**

Add:

```ts
export function villaImagesNotFoundResponse(): Response {
  return Response.json(
    { error: "Not found" },
    {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
```

Change the builder signature to:

```ts
export async function buildVillaImagesRouteResponse(
  request: Request,
  id: string,
  mode: VillaImagesRequestMode,
)
```

Use an exhaustive `card`/`display`/`download` branch. Delete the final query-free JSON-list response entirely. Keep `toPublicVillaImages` only for the bounded card response. Keep current image ownership, URL, transform, download filename, and upstream response validation unchanged.

- [ ] **Step 6: Reorder the route handler**

In `app/(public)/api/villas/[id]/images/route.ts`, perform operations in this order inside the existing error boundary:

```ts
const { id } = await context.params;
parseVillaId(id);

const decision = classifyVillaImagesRequest(request);
if (!decision.ok) {
  return villaImagesNotFoundResponse();
}

const rateLimitResponse = limitPublicApiRequest(request, decision.policy);
if (rateLimitResponse) {
  return rateLimitResponse;
}

return buildVillaImagesRouteResponse(request, id, decision.mode);
```

Import `parseVillaId` from the existing image helper. Keeping the builder's own ID assertion is acceptable as a defensive invariant. This order preserves invalid-ID `400`, prevents rejected requests from consuming a bucket, and prevents Supabase reads for rejected requests.

- [ ] **Step 7: Run the public route tests green**

Run:

```powershell
npm.cmd test -- lib/api/__tests__/rate-limit.test.ts lib/villas/__tests__/images.test.ts lib/villas/__tests__/image-proxy.test.ts
```

Expected: query-free and unsupported requests are `404`; exact card, image-ID, legacy URL, proxy, and download tests pass.

- [ ] **Step 8: Add failing Worker-cache tests**

In `worker-cache-policy.test.ts`, change/add expectations:

```ts
expect(
  getJsonEdgeCacheDecision(
    new Request("https://example.com/api/villas/9/images"),
  ),
).toMatchObject({ cacheable: false, candidate: false, reason: "path" });

expect(
  getJsonEdgeCacheDecision(
    new Request("https://example.com/api/villas/9/images?view=card"),
  ),
).toMatchObject({ cacheable: true, candidate: true, reason: "json" });
```

Also assert `view=card&debug=1` and duplicate `view=card&view=card` are not JSON-cache candidates. Preserve the card cache-key/version-group assertions.

- [ ] **Step 9: Narrow the Worker candidate**

Make `hasOnlyVillaCardImagesQuery` require exactly one query entry:

```js
const entries = Array.from(url.searchParams.entries());
return (
  isVillaImagesApiPath(url.pathname) &&
  entries.length === 1 &&
  entries[0][0] === "view" &&
  entries[0][1] === "card"
);
```

In `getJsonEdgeCacheDecision`, include a villa-images path in `isCandidatePath` only when `hasOnlyVillaCardImagesQuery(url)` is true. Query-free and extra-query image-list requests must therefore return `candidate: false` with reason `path`. Do not alter image-byte cache classification.

- [ ] **Step 10: Run Worker and route tests**

Run:

```powershell
npm.cmd test -- worker-cache-policy.test.ts lib/villas/__tests__/images.test.ts
```

Expected: all changed cache-policy and public-route tests pass.

- [ ] **Step 11: Review the task diff**

Run:

```powershell
git diff -- "app/(public)/api/villas/[id]/images/route.ts" lib/villas/public-image-route.ts lib/villas/__tests__/images.test.ts worker-cache-policy.js worker-cache-policy.test.ts
git diff --check
```

Search for a remaining full-list fallback:

```powershell
rg -n 'CACHE_HEADERS\.villaImages|toPublicVillaImages\(id, images\)' lib/villas/public-image-route.ts
```

Expected: no query-free manifest response remains; the bounded card branch is the only list response.

---

### Task 3: Supply the complete villa detail gallery from the server

**Files:**

- Modify: `lib/villas/server.ts`
- Modify: `lib/villas/images.ts`
- Modify: `lib/villas/__tests__/server.test.ts`
- Modify: `lib/villas/__tests__/images.test.ts`
- Modify: `app/(public)/villas/[id]/page.tsx`
- Modify: `components/villas/detail/types.ts`
- Modify: `components/villas/detail/page.tsx`
- Modify: `components/villas/detail/detail-client-shell.tsx`
- Modify: `components/villas/detail/detail-page-helpers.ts`
- Modify: `components/villas/detail/use-villa-gallery.ts`
- Modify: `components/villas/detail/detail-page-gallery.tsx`
- Modify: `components/villas/detail/__tests__/detail-page-helpers.test.ts`
- Modify: `components/villas/detail/__tests__/page.test.tsx`

- [ ] **Step 1: Add failing server-data tests**

In `lib/villas/__tests__/server.test.ts`, replace the `fetchVillaPreviewImages` mock with a partial `fetchVillaImages` mock. Update the existing parallel-loading test to return five images and assert:

```ts
expect(fetchVillaImagesMock).toHaveBeenCalledWith("9");
expect(result?.initialGalleryImages).toHaveLength(5);
expect(result?.initialGalleryLoadFailed).toBe(false);
```

Assert each serialized image uses its same-origin ID route and contains no upstream source host.

Add a failure test:

```ts
fetchVillaImagesMock.mockRejectedValueOnce(new Error("gallery unavailable"));

expect(await fetchVillaPageData("9")).toMatchObject({
  initialGalleryImages: [],
  initialGalleryLoadFailed: true,
  payload: expect.any(Object),
});
```

Spy on `console.error` so the dependency failure is visible without polluting test output.

- [ ] **Step 2: Run server tests red**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/server.test.ts
```

Expected: the server still calls the preview helper, truncates at four, and has no failure flag.

- [ ] **Step 3: Implement the complete cached server gallery**

In `lib/villas/server.ts`:

- Replace the `fetchVillaPreviewImages` import with `fetchVillaImages`.
- Add `initialGalleryLoadFailed: boolean` to `VillaPageData`.
- Start the gallery request before awaiting detail, preserving current parallelism.
- Convert success/failure into a discriminated local result:

```ts
const initialGalleryPromise = fetchVillaImages(id)
  .then((images) => ({ failed: false as const, images }))
  .catch((error: unknown) => {
    console.error("Unable to load villa detail gallery images", error);
    return { failed: true as const, images: [] };
  });
```

Return every normalized image:

```ts
initialGalleryImages: toPublicVillaImages(id, galleryResult.images),
initialGalleryLoadFailed: galleryResult.failed,
```

Do not add another cache; `fetchVillaImages` already owns the shared 12-hour cache and tags.

- [ ] **Step 4: Remove the superseded preview-only helper**

Delete `selectPreviewImages` and `fetchVillaPreviewImages` from `lib/villas/images.ts`. Remove the `fetchVillaPreviewImages` import and its dedicated test block from `lib/villas/__tests__/images.test.ts`.

Confirm no reference remains:

```powershell
rg -n "fetchVillaPreviewImages|selectPreviewImages" .
```

Expected: no matches outside ignored historical documentation.

- [ ] **Step 5: Thread the failure flag through page props**

Add `initialGalleryLoadFailed?: boolean` to `VillaDetailPageProps` and `VillaDetailClientShellProps`, defaulting it to `false`.

Pass it through:

```tsx
// app/(public)/villas/[id]/page.tsx
initialGalleryLoadFailed={data.initialGalleryLoadFailed}

// components/villas/detail/page.tsx
initialGalleryLoadFailed={initialGalleryLoadFailed}

// components/villas/detail/detail-client-shell.tsx
useVillaGallery({
  id,
  initialGalleryImages,
  initialGalleryLoadFailed,
});
```

- [ ] **Step 6: Add failing client tests for the new server-only flow**

Rewrite the deferred-gallery section in `components/villas/detail/__tests__/page.test.tsx` to prove:

1. All supplied server images render without an idle callback.
2. Opening the overview/lightbox uses the supplied images.
3. The cover remains first according to `buildGalleryItems`.
4. A successful empty gallery renders the empty state without a skeleton.
5. `initialGalleryLoadFailed` renders the error state.
6. Retry controls are anchors with `href="/villas/9"`.
7. Rerendering from villa `9` to villa `10` uses only villa `10` props.
8. No fetch call targets the exact query-free pattern `/api/villas/<id>/images`.

Delete obsolete deferred-promise, idle-callback, and gallery-fetch test helpers after their last use.

In `components/villas/detail/__tests__/detail-page-helpers.test.ts`, replace idle/preview/loading expectations with:

```ts
expect(getServerGalleryLoadState("9", [image], false)).toEqual({
  error: null,
  images: [image],
  status: "loaded",
  villaId: "9",
});

expect(getServerGalleryLoadState("9", [], true)).toMatchObject({
  images: [],
  status: "error",
  villaId: "9",
});
```

- [ ] **Step 7: Run the client tests red**

Run:

```powershell
npm.cmd test -- components/villas/detail/__tests__/detail-page-helpers.test.ts components/villas/detail/__tests__/page.test.tsx
```

Expected: old idle/preview states, background fetches, button retries, and loading callbacks conflict with the new expectations.

- [ ] **Step 8: Simplify gallery load state to the server result**

In `components/villas/detail/detail-page-helpers.ts`:

- Change `GalleryLoadStatus` to `"loaded" | "error"`.
- Delete `GalleryLoadMode`, `LoadGalleryImagesOptions`, `getInitialGalleryLoadState`, `getPreviewGalleryLoadState`, and `getActiveGalleryLoadState`.
- Add `getServerGalleryLoadState(villaId, images, failed)`.
- Preserve all unrelated detail-layout helpers in the file.

Successful empty image arrays are `loaded`, not `error`. Only the explicit server failure flag creates an error state.

- [ ] **Step 9: Remove every browser manifest fetch**

In `use-villa-gallery.ts`:

- Add `initialGalleryLoadFailed` to `UseVillaGalleryOptions`.
- Delete the idle timers, `requestIdleCallback` handling, fetch response type, in-flight promise/ref, `loadGalleryImages`, and `handleGalleryRetry`.
- Derive the active gallery state from `getServerGalleryLoadState`.
- Keep failed-image URL filtering, category construction, active lightbox item state, and villa-ID reset behavior.
- Make `handleGalleryImageClick` synchronous: select the matching non-mock item from the current gallery, otherwise select the first current real item.
- Return `shouldShowGallerySkeleton: false`.

Run:

```powershell
rg -n 'fetch\(`/api/villas/.+/images|loadGalleryImages|handleGalleryRetry|requestIdleCallback' components/villas/detail
```

Expected: no runtime match; removed names may remain only in the diff history, not current source.

- [ ] **Step 10: Change retries to document navigation**

In `detail-page-gallery.tsx`, replace both `onRetry` callback props with `retryHref: string`. Render the existing retry labels as:

```tsx
<a
  className="..."
  data-gallery-retry="true"
  href={retryHref}
>
  {/* keep the existing Thai label */}
</a>
```

In the client shell:

```ts
const galleryRetryHref = `/villas/${encodeURIComponent(id)}`;
```

Pass that URL to both gallery components. Remove the categorized `loadGalleryImages()` call; opening the overview is now only a local state change. Do not use `next/link`, so retry remains a normal document request and does not create an `_rsc` fetch.

- [ ] **Step 11: Run complete detail-focused tests**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/server.test.ts lib/villas/__tests__/images.test.ts components/villas/detail/__tests__/detail-page-helpers.test.ts components/villas/detail/__tests__/page.test.tsx
```

Expected: complete gallery, failure fallback, modal behavior, and no-query-free-fetch assertions all pass.

- [ ] **Step 12: Review the task diff**

Run:

```powershell
git diff -- lib/villas/server.ts lib/villas/images.ts lib/villas/__tests__/server.test.ts lib/villas/__tests__/images.test.ts "app/(public)/villas/[id]/page.tsx" components/villas/detail
git diff --check
```

Confirm the detail page still receives only `PublicVillaImage` DTOs, never upstream `imageUrl` values from raw Supabase rows.

---

### Task 4: Load admin picker images through the authenticated admin response

**Files:**

- Modify: `lib/villas/card-image-config-admin.ts`
- Modify: `lib/villas/__tests__/card-image-config-admin.test.ts`
- Modify: `components/admin/villa-card-images/admin-villa-card-images-page.tsx`
- Modify: `components/admin/villa-card-images/__tests__/admin-villa-card-images-page.test.tsx`

- [ ] **Step 1: Add failing admin-helper tests**

Partially mock `@/lib/villas/images` so `validateCustomDisplayImageIds` retains its current implementation while `fetchVillaImages` is controllable. Extend the public DTO mock with `toPublicVillaImages`.

Add tests for:

- `GET ...?houseId=9` fetches villa `9` images and returns normalized `images`.
- Paginated list requests do not call `fetchVillaImages` and omit `images`.
- A gallery dependency failure returns a structured `500`, not `401`, and includes an error message.
- Existing config, house, pagination, and style fields remain unchanged.

Use a concrete expected image:

```ts
expect(body.images).toEqual([
  expect.objectContaining({
    id: 7,
    imageUrl: "/api/villas/9/images?imageId=7",
  }),
]);
```

- [ ] **Step 2: Run admin-helper tests red**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/card-image-config-admin.test.ts
```

Expected: the response has no `images` and the image helper is not called.

- [ ] **Step 3: Attach images only to the admin house-detail response**

In `card-image-config-admin.ts`:

- Import `fetchVillaImages`.
- Import `toPublicVillaImages` beside `toPublicVillaListings`.
- Read a positive `houseId` from the request.
- After the existing authorized helper has resolved the requested house and before returning JSON, fetch gallery images only when that exact house exists.
- Return `images: []` for a valid requested house that is not found; omit `images` when there is no valid `houseId` detail request.
- Normalize a successful result with `toPublicVillaImages(houseId, images)`.
- Map a gallery exception through `adminSupabaseErrorResponse` with fallback `"Unable to load villa images."`; do not convert it to an authentication response.

Build the response without serializing an `undefined` property:

```ts
return Response.json({
  configs,
  houses: housePage.houses,
  pagination: housePage.pagination,
  villaCardStyle,
  ...(images === undefined ? {} : { images }),
});
```

Do not move authorization into this helper; `app/(admin)/api/admin/villa-card-images/route.ts` must continue to call `requireHomeConfigAdmin` before invoking it.

- [ ] **Step 4: Run admin-helper tests green**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/card-image-config-admin.test.ts
```

Expected: detail, list, config save, cover upload/delete, and error-path tests all pass.

- [ ] **Step 5: Add failing admin-client tests**

In `admin-villa-card-images-page.test.tsx`, consolidate the old two-response setup:

- Put `images` in the first response from `/api/admin/villa-card-images?houseId=9`.
- Remove the mock response for `/api/villas/9/images`.
- Assert the protected request includes `{ Authorization: "Bearer admin-token" }`.
- Assert there is no request whose URL matches `/api/villas/9/images`.
- For the picker skeleton test, leave the protected admin request pending instead of waiting on a second public request.
- Include `images` in protected GET fixtures used by save, cover-upload, and cover-delete tests.

Expected request count for initial house detail: one authenticated GET.

- [ ] **Step 6: Run admin-client tests red**

Run:

```powershell
npm.cmd test -- components/admin/villa-card-images/__tests__/admin-villa-card-images-page.test.tsx
```

Expected: the component still makes the removed public fetch or remains in its separate image-loading state.

- [ ] **Step 7: Consume images in `useVillaCardConfigs`**

In `admin-villa-card-images-page.tsx`:

- Add `images?: PublicVillaImage[]` to `AdminVillaCardImagesResponse`.
- Delete `VillaImagesResponse`.
- Add `images` state to `useVillaCardConfigs` and return it.
- Clear `images` when starting a new house-detail request so stale images cannot cross house IDs.
- When `params.houseId` is set, require `payload.images` to be an array as part of the successful response shape.
- Filter it through the existing `isUsableImage` guard.
- For list requests, set/retain an empty image list without requiring the field.

The central validation should include:

```ts
const hasRequiredImages =
  !params.houseId || Array.isArray(payload.images);
```

- [ ] **Step 8: Remove the separate public image-loading effect**

In `AdminVillaCardHouseCustomPage`:

- Destructure `images` from `useVillaCardConfigs`.
- Delete local `images`, `isLoadingImages`, and their setters.
- Delete the effect that fetches `/api/villas/${houseId}/images`.
- Set the initial zone from the protected images:

```ts
useEffect(() => {
  setSelectedZone(getInitialImageZone(images));
}, [images]);
```

- Use the existing `isLoading` state for picker skeletons and disabled controls.

Preserve upload preview object-URL cleanup, selected image ordering, save behavior, admin login redirects for true auth failures, and visible non-auth errors.

- [ ] **Step 9: Run all admin-focused tests**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/card-image-config-admin.test.ts components/admin/villa-card-images/__tests__/admin-villa-card-images-page.test.tsx
```

Expected: all tests pass; the client performs one authenticated detail GET and no public manifest GET.

- [ ] **Step 10: Review the task diff**

Run:

```powershell
git diff -- lib/villas/card-image-config-admin.ts lib/villas/__tests__/card-image-config-admin.test.ts components/admin/villa-card-images
git diff --check
```

Search for public manifest consumers:

```powershell
rg -n '/api/villas/.*/images[`"]|/api/villas/\$\{.*\}/images' app components lib --glob '*.ts' --glob '*.tsx'
```

Expected: public consumers use `view=card` or `imageId`; no browser code requests the query-free manifest.

---

### Task 5: Update architecture documentation and perform end-to-end verification

**Files:**

- Modify: `docs/ai/structure.html`
- Verify: all files changed by Tasks 1–4

- [ ] **Step 1: Update the structure map**

Update the existing relevant entries in `docs/ai/structure.html`:

- Villa detail now receives the complete gallery from `fetchVillaImages`, not a four-image preview followed by a browser fetch.
- The public images route supports only exact card, validated display, and download modes; query-free/unknown shapes return private `404`.
- `publicImageManifest` and `publicImageDelivery` own separate budgets, with the documented development-only headerless bypass.
- Worker JSON caching includes only exact `view=card`, while image bytes retain the image cache.
- Admin house detail obtains images through the authenticated `villa-card-images` response.
- Targeted verification references the changed rate-limit, route, server gallery, admin, and Worker tests.

Do not add a full file-tree inventory or duplicate the approved design document.

- [ ] **Step 2: Run all focused suites together**

Run:

```powershell
npm.cmd test -- lib/api/__tests__/rate-limit.test.ts lib/villas/__tests__/images.test.ts lib/villas/__tests__/image-proxy.test.ts worker-cache-policy.test.ts
npm.cmd test -- lib/villas/__tests__/server.test.ts components/villas/detail/__tests__/detail-page-helpers.test.ts components/villas/detail/__tests__/page.test.tsx
npm.cmd test -- lib/villas/__tests__/card-image-config-admin.test.ts components/admin/villa-card-images/__tests__/admin-villa-card-images-page.test.tsx
```

Expected: every focused suite passes with no retries hidden by test changes.

- [ ] **Step 3: Run repository verification**

Run:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
```

Expected: full Vitest, ESLint, and Next production build pass. Review `git status --short` and distinguish this task's files from any pre-existing user changes.

- [ ] **Step 4: Start the production build for browser verification**

Run `npm.cmd start` on an available local port after the successful build. Keep it in a resumable/background process so output can be inspected. Do not use the development server for the production network assertions.

- [ ] **Step 5: Verify the public route contract directly**

Using the active local port, run equivalent requests with `curl.exe -i`:

```text
GET /api/villas/1757/images
GET /api/villas/1757/images?debug=1
GET /api/villas/1757/images?view=card
```

Expected:

- The first two return `404`, `{ "error": "Not found" }`, and `Cache-Control: private, no-store`.
- Exact `view=card` still returns `200` with no more than ten normalized images.
- A valid `imageId` request still returns image bytes.
- A valid download still returns an attachment.

- [ ] **Step 6: Verify the homepage network behavior**

At desktop and mobile viewport sizes:

- Load `/` and repeat normal reload/navigation behavior.
- Confirm legitimate card requests do not return `429`.
- Confirm card list requests are bounded `?view=card`.
- Confirm image bytes use `?imageId=...`.
- Confirm there is no query-free `/api/villas/:id/images`.
- Confirm there is no public `/_next/image` request.
- Confirm request counts remain bounded by rendered cards/images.

- [ ] **Step 7: Verify the villa detail experience**

Open `/villas/1757` at desktop and mobile sizes:

- Confirm the initial gallery renders from the document/server payload.
- Confirm all categories, overview, lightbox navigation, failed-image fallback, and download action still work.
- Confirm image bytes remain lazy rather than all downloading at document load.
- Confirm no query-free image-manifest request occurs.
- Activate a retry link in an error/empty-state fixture or test route and confirm it performs normal document navigation without an unexpected `_rsc` request.

- [ ] **Step 8: Verify the admin picker**

With an authorized admin session:

- Open the house image-picker page for a real villa.
- Confirm the protected `/api/admin/villa-card-images?houseId=...` request includes the existing Bearer authorization and contains normalized `images`.
- Confirm there is no separate public query-free manifest request.
- Confirm zone filtering, selection order, save, cover upload preview, and error display still behave correctly.
- Confirm a gallery/Supabase failure is shown as an admin data error and does not cause a false login redirect.

- [ ] **Step 9: Inspect final source and network invariants**

Run:

```powershell
rg -n 'fetch\(`/api/villas/.+/images|fetchVillaPreviewImages|publicDetail.*images' app components lib --glob '*.ts' --glob '*.tsx'
rg -n 'publicImageManifest|publicImageDelivery' app lib
git diff --stat
git diff --check
```

Expected:

- No browser query-free gallery fetch.
- No preview-only server helper.
- Both new policies are used by their intended routes.
- No whitespace errors.

- [ ] **Step 10: Final acceptance review**

Check every approved acceptance criterion:

1. Query-free and trivial unknown-query variants cannot return a complete list.
2. Public galleries, card galleries, image display, and downloads remain usable.
3. Admin users receive all picker images only after authorization.
4. Image delivery cannot exhaust detail, manifest, or download buckets.
5. Normal homepage traffic does not produce legitimate `429`.
6. Server failure preserves the rest of the detail page.
7. Worker caching cannot resurrect the removed query-free JSON contract.
8. No unrelated schema, auth, cache-duration, or image-optimization behavior changed.

Do not commit. Report the verification results and any remaining operational Cloudflare/WAF follow-up separately.
