# Hide Query-Free Villa Image List Design

## Status

Approved by the user on 2026-07-27.

This is the current, deliberately narrower design for the requested change.
The earlier broader private-image-manifest proposal was removed at the user's
request.

## Goal

Make a direct request such as `GET /api/villas/1757/images` stop returning the
complete villa image manifest while preserving the public villa gallery, the
admin image picker, card galleries, image display, and downloads.

The endpoint must not be bypassable by adding an unrelated query parameter.
Any request shape that is not an explicitly supported card, display, or
download variant must not return a manifest.

## Security Boundary

This change removes the convenient standalone full-gallery JSON endpoint. It
does not make public images secret. A browser must receive the same-origin
image paths and metadata needed to render a public gallery, so a determined
scraper can still inspect the rendered page or request displayed images.

This scope does not add a browser token, internal Bearer token, Turnstile,
Cloudflare WAF rule, or Supabase schema change.

## Existing 429 Root Cause

The current villa image route applies the `publicDetail` policy to every
non-download request before distinguishing between a manifest and image-byte
request. That puts all of the following in one 90-request fixed-window bucket:

- Villa detail JSON
- `?view=card` manifests
- `?imageId=...` image delivery
- Legacy `?url=...` image delivery

In local development, browser requests do not carry the trusted
`CF-Connecting-IP` header, so every request shares the `unknown` client key. A
gallery-style card makes one `view=card` request and can render up to ten image
requests. Normal homepage activity can therefore exhaust the shared bucket;
the 91st request returns `429`.

This is a request-classification and budget problem, not a Supabase or image
source failure.

## Public Route Contract

`app/(public)/api/villas/[id]/images/route.ts` and
`lib/villas/public-image-route.ts` will classify requests by an explicit
allowlist.

Supported public variants remain:

- Exactly `?view=card` for the existing bounded card gallery of at most ten
  images.
- One `imageId` or legacy `url` selector, with only the supported `w` and `q`
  transform parameters, for validated image delivery.
- `download=1` with exactly one `imageId` or legacy `url` selector and only the
  existing optional `name` and `zone` metadata.

Mixed selectors, duplicate security-relevant parameters, unsupported values,
and extra parameter names are rejected rather than falling through to a list
response.

The query-free full manifest and unknown or incomplete query shapes return:

- HTTP `404`
- A generic `Not found` JSON error
- `Cache-Control: private, no-store`

The rejection happens before loading villa images from Supabase. Invalid villa
IDs retain the existing `400` behavior, while malformed recognized display or
download requests retain their current validation errors.

Keeping `?view=card` public is an explicit product decision for this scope. It
is bounded and required by public gallery-style villa cards, but it means this
change removes only the complete gallery manifest, not every public image-list
response.

## Rate-Limit Classification

Request validation and mode classification happen before rate limiting. A
query-free manifest or unsupported query shape is rejected without consuming a
rate-limit bucket.

Valid requests use separate fixed-window policies:

| Request class | Policy | Limit |
| --- | --- | ---: |
| Villa detail JSON | `publicDetail` | 90/IP/minute |
| Exact `view=card` manifest | `publicImageManifest` | 120/IP/minute |
| Validated `imageId` or legacy `url` display | `publicImageDelivery` | 600/IP/minute |
| Image attachment download | `publicDownload` | 20/IP/minute |

The dedicated `/api/villas/:id/images/proxy` route also uses
`publicImageDelivery`. Existing house-cover, guide, and site-asset routes retain
their current policies.

The higher image-delivery budget is intentionally limited to validated image
bytes. It does not raise the villa detail, catalog, manifest, or download
budgets. Source URL validation, villa/image ownership checks, bounded transform
parameters, and the Worker image cache remain in place.

In development only, a request without `CF-Connecting-IP` bypasses the
in-process limiter. A request that supplies the trusted header can still be
used to exercise rate limiting locally. Test and production environments do
not receive this bypass: a production request missing the Cloudflare header
retains the fail-safe `unknown` bucket.

`X-Forwarded-For` remains untrusted and is not restored as a client identity.
The application limiter remains defense in depth rather than a distributed
abuse-control system; serious cross-isolate bot control remains a future
Cloudflare WAF or Rate Limiting concern.

## Villa Detail Data Flow

`fetchVillaPageData` will load the complete normalized gallery through the
existing cached `fetchVillaImages` helper instead of loading only the four-image
preview for later browser hydration. It will convert the images through
`toPublicVillaImages`, so serialized client data contains same-origin,
ID-addressed image paths rather than upstream source hosts.

The villa detail component will receive a complete gallery prop. Its gallery
state will begin in a completed state and will not schedule the current
query-free browser fetch during idle time or user interaction. Image metadata
is present in the server-rendered payload, but image bytes remain lazy and are
requested only when the UI renders them.

If the server gallery dependency fails, the rest of the villa detail page
continues to render with its existing cover or empty-gallery fallback. The UI
must not retry through the removed public manifest endpoint; a retry, if shown,
reloads the document so the server data path runs again.

## Admin Data Flow

The admin image picker must not call the public manifest route.

Its existing authenticated request to
`/api/admin/villa-card-images?houseId=:id` will also return the normalized image
list for that house after the existing origin and Supabase Bearer checks pass.
The admin client will initialize its picker from this protected response and
remove the separate unauthenticated fetch to `/api/villas/:id/images`.

Admin authentication failures retain the existing login behavior. Image-data
or Supabase failures remain visible as admin errors and must not be converted
into false authentication failures.

## Cache and Worker Behavior

- Full gallery reads retain the shared 12-hour Next data-cache policy and
  existing villa-image tags.
- Query-free `/api/villas/:id/images` requests are removed from the Cloudflare
  JSON edge-cache allowlist.
- The exact `?view=card` variant remains eligible for its current JSON edge
  cache.
- Rejected manifest requests are private and non-cacheable.
- Valid image-byte responses retain the Worker image cache and transform-aware
  keys.
- Existing villa-image invalidation continues to cover server-rendered gallery
  data.

The deployment-versioned Worker cache prevents a new deployment from serving a
previous query-free manifest cache entry. No manual broad cache purge is part
of this design.

## Files and Ownership

Expected owners include:

- `app/(public)/api/villas/[id]/images/route.ts`
- `lib/villas/public-image-route.ts`
- `lib/villas/server.ts`
- `components/villas/detail/use-villa-gallery.ts` and its prop/state owners
- `lib/villas/card-image-config-admin.ts`
- `components/admin/villa-card-images/admin-villa-card-images-page.tsx`
- `worker-cache-policy.js`
- Focused route, gallery, admin, and Worker tests
- `docs/ai/structure.html`

No new abstraction layer is required. Existing villa image, public DTO, admin
authorization, cache, and revalidation owners remain the source of truth.

## Verification

Focused tests will verify:

- Query-free and unknown-query requests return `404`, `no-store`, and do not
  query Supabase or consume an image rate-limit bucket.
- `?view=card`, validated image-ID delivery, legacy validated delivery, and
  downloads continue to work.
- Manifest, delivery, detail, and download counters are isolated from one
  another.
- A representative bounded homepage workload remains below the manifest and
  delivery budgets, while the first request over each limit returns `429`.
- Headerless development requests bypass the limiter, but production/test
  requests remain limited and never trust `X-Forwarded-For`.
- Villa detail renders the complete gallery from server props and issues no
  query-free image-manifest fetch.
- The admin picker receives images only through its authenticated admin
  response and sends no public manifest request.
- The Worker does not JSON-cache the query-free route but still caches the
  exact card variant.
- Server gallery failure preserves the rest of the detail page.

Repository verification will include the relevant targeted Vitest files,
`npm.cmd run lint`, and `npm.cmd run build`.

Browser verification will cover desktop and mobile villa detail behavior,
gallery categories/lightbox, lazy image loading, download behavior, and the
admin image picker. The production-style network check must show:

- No query-free `/api/villas/:id/images` request from public or admin pages.
- No unexpected `/_next/image` or `_rsc` requests.
- Only bounded, ID-addressed image delivery requests.
- The direct query-free URL returns `404`.
- Normal homepage gallery-card loading and repeated development reloads produce
  no legitimate `429` responses.

## Acceptance Criteria

The change is complete when:

1. `/api/villas/1757/images` and trivial unknown-query variants cannot return
   an image list.
2. Public villa galleries and downloads remain usable without login.
3. Admin users can still view and select all house images after authorization.
4. Public gallery-style cards retain their bounded `view=card` behavior.
5. Manifest, image delivery, detail, and download traffic cannot exhaust one
   another's rate-limit buckets.
6. Normal homepage gallery-card traffic does not receive `429`.
7. Existing cache, source-host hiding, and request-budget guarantees remain
   intact.
