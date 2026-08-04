# Cloudflare Image Download and Cache Resilience Design

## Summary

Production logs from `baan-pool-villa02` on 2026-08-04 exposed three related reliability problems:

1. Villa gallery downloads returned `502` because the download route fetched private S3 object URLs directly, while normal image display succeeded through the existing AWS image loader.
2. Cloudflare emitted transient `Network connection lost` errors, including requests that the Workers runtime later classified as unable to generate a response.
3. OpenNext's R2 incremental cache logged concurrent-write and internal write failures while attempting to populate cache objects.

The approved solution keeps the current public URLs and UI, changes gallery downloads to high-quality WebP through the existing image loader, makes the custom Worker edge caches fail open under transient binding failures, and reduces direct R2 traffic with OpenNext's regional incremental cache.

## Goals

- Make valid gallery downloads succeed when the stored S3 object is private but the existing AWS image loader can render it.
- Return a high-quality WebP download up to 1920 pixels wide without adding an S3 credential or exposing a signed source URL.
- Prevent custom HTML, JSON, and image edge-cache failures from taking down the underlying public route.
- Bound transient cache reads with a timeout and one retry before bypassing the custom edge cache.
- Reduce duplicate OpenNext R2 incremental-cache reads and writes.
- Add diagnostic logs that identify the failed cache stage without recording secrets, cookies, client IP addresses, or full image URLs.
- Preserve all existing request classification, rate limits, villa/image authorization, public cache policy, and attachment filename behavior.

## Non-goals

- Returning the original S3 bytes or original image dimensions.
- Making the source S3 bucket public or adding AWS credentials to the Next.js Worker.
- Replacing OpenNext's incremental-cache implementation with a custom adapter.
- Deploying automatically or changing Cloudflare account resources.
- Retrying mutations or other non-idempotent application operations.

## Confirmed Causes and Boundaries

### Download failures

The current download flow resolves a known villa image and calls `fetchAllowedVillaImageDownload` with its stored `image_url`. For the affected villa, that URL points to `s3.ap-southeast-1.amazonaws.com/poolvillas.co.ltd/...` and returns `403`. The display flow succeeds because `fetchPublicImageProxyResponse` converts the same source to the configured AWS image-loader URL before fetching it.

The download fix therefore belongs at the shared server-side image delivery boundary, after the villa/image allowlist check and before response headers are constructed.

### Network failures

The logs do not identify one binding as the source of every `Network connection lost` event. The custom Worker performs Cache API reads and R2-backed HTML-version reads before OpenNext. Either may prevent OpenNext from being reached. The safe behavior for these acceleration layers is to bypass them when they are unavailable; they must not become availability dependencies.

Application database errors remain application errors and are not silently converted into cache misses by this design.

### Incremental-cache writes

The exact `Failed to set to cache` message originates in OpenNext's `R2IncrementalCache.set`. OpenNext catches and logs the failure, so replacing that adapter solely to suppress the log would add maintenance risk without improving the response path. The selected mitigation wraps the R2 incremental cache with OpenNext's supported long-lived regional cache, reducing repeated direct R2 operations while retaining the Durable Object revalidation queue.

## Architecture

### 1. WebP gallery downloads

`buildVillaImagesRouteResponse` continues to classify `download=1` requests and apply the `publicDownload` rate limit. It resolves the target by `imageId` or validated legacy URL exactly as today and verifies that the source belongs to the requested villa.

The byte-fetching step changes as follows:

1. Pass the authorized source URL to the existing public image proxy fetcher.
2. Request a width of 1920 and quality of 90. For the known Poolvilla S3 host, `buildAwsImageUrl` converts this to the configured AWS loader URL.
3. Accept only a successful response with a readable body and an `image/*` content type.
4. Build the attachment filename from the returned content type. A WebP response therefore receives a `.webp` extension even when the stored image name ends in `.jpg`.
5. Return the stream with `Content-Disposition`, `Content-Type`, and `Cache-Control: no-store`.

The existing source allowlist remains authoritative. Arbitrary external URLs cannot use the download route as an open proxy.

The legacy direct-download helper remains available only if another tested caller still needs it. If the gallery download route is its sole production caller after the change, it may be removed together with obsolete tests rather than retained as dead code.

### 2. Worker edge-cache resilience

A focused Worker-side helper will own bounded, idempotent cache operations used by the repeated HTML, JSON, and image edge-cache flows.

For cache reads and HTML version-token reads:

- Allow each attempt 1,500 milliseconds before treating it as timed out.
- Retry once only when the error is classified as transient, including `Network connection lost`, `daemonDown`, or a Cloudflare internal binding error.
- Wait 50 milliseconds before the single retry; no unbounded loop is allowed.
- If the operation still fails or times out, return a bypass decision to the caller.
- The caller then invokes OpenNext and labels an otherwise eligible response `BYPASS` rather than failing the request.

For cache writes:

- Keep writes in `ctx.waitUntil`.
- Give each write attempt 1,500 milliseconds and retry an idempotent Cache API `put` at most once after a 50-millisecond delay for a transient failure.
- Never delay or replace the already-generated client response because a cache write failed.

Structured warnings contain only an operation name, cache kind, route category, attempt count, and normalized error category. They do not include raw request URLs, query strings, cookies, authorization headers, environment values, or source image URLs.

The resilience helper does not catch errors thrown by the actual page/API implementation after OpenNext begins processing. Those continue through the existing public error responses so Supabase, validation, and upstream failures remain visible.

### 3. OpenNext regional cache

`open-next.config.ts` wraps `r2IncrementalCache` with `withRegionalCache` in `long-lived` mode. It keeps tag-cache checking enabled on regional hits to preserve current revalidation correctness. The existing Durable Object queue and sharded tag cache remain in place.

The sharded tag-cache configuration does not change in this task. Its failures did not produce the observed `Failed to set to cache` message, so changing it would expand scope without addressing the confirmed cause.

No cache duration in `lib/cache-policy.ts` changes. Public 12-hour data caching, route ISR values, and the custom HTML/JSON/image edge-cache policies remain aligned with the current request budget.

## Data Flow

### Download

```text
browser download link
  -> route classification and publicDownload limiter
  -> cached villa image lookup
  -> villa/image membership check
  -> AWS image loader (1920px, quality 90)
  -> validated image response
  -> no-store WebP attachment
```

### Public cacheable request

```text
request
  -> bounded custom edge-cache/version lookup
     -> hit: return cached response
     -> miss: call OpenNext and populate cache in background
     -> timeout/transient failure: call OpenNext and mark BYPASS
  -> OpenNext regional incremental cache
  -> R2 only when the regional layer cannot satisfy the operation
```

## Error Handling

- Invalid villa ids retain `400` responses.
- Unsupported image query shapes retain private, non-cacheable `404` responses.
- Unknown or unauthorized image ids retain `404` responses.
- Loader responses that are unsuccessful, lack a body, or are not `image/*` return the existing sanitized `502` download error.
- Download timeouts remain bounded and return a sanitized `502`; no upstream response body is leaked.
- Custom edge-cache read failures bypass the cache and do not change the underlying route status.
- Custom edge-cache write failures are logged in sanitized form and never change the client response.
- Non-transient programming errors are not repeatedly retried. They are logged once and use the same safe bypass behavior at the cache boundary.
- The `/api/.git/config` entry in the incident log is treated as an external probe, not evidence of repository exposure. It must continue to receive no sensitive content; no special application route is introduced for it.

## Testing Strategy

Implementation follows test-driven development.

### Focused image tests

- Reproduce an authorized S3-backed gallery image whose direct source returns `403` while the loader returns WebP.
- Verify the download route fetches the loader URL, not the private S3 URL.
- Verify width 1920 and quality 90 are requested.
- Verify `Content-Type: image/webp`, a `.webp` attachment filename, and `Cache-Control: no-store`.
- Verify invalid ids, non-member URLs, redirects outside the allowed image resource, timeouts, and non-image responses retain their safe error behavior.
- Verify the display proxy behavior is unchanged.

### Worker cache tests

- Cache hit returns without invoking OpenNext.
- Normal cache miss invokes OpenNext and schedules a write.
- A transient read failure retries exactly once.
- A timed-out read bypasses cache and still returns the OpenNext response.
- A failed background write does not change the response.
- Logs contain normalized stage metadata and omit raw URLs and sensitive headers.
- Existing HTML, JSON, image, RSC, cookie, query, admin, API, and static-asset cache decisions remain unchanged.

### Configuration and regression verification

- Update the existing OpenNext configuration test to require the supported regional incremental-cache wrapper.
- Run targeted villa image/download, public image proxy, worker cache policy, HTML cache version, and OpenNext configuration tests.
- Run the full Vitest suite.
- Run `npm.cmd run lint` and `npm.cmd run build` before completion.
- Render and inspect the affected villa detail download flow locally at desktop and mobile widths.
- Run a production-mode local network check confirming no unexpected `_rsc` or `/_next/image` requests and bounded route/API counts.
- A post-deploy production check is reported separately because implementation does not authorize deployment.

## Documentation Updates

Update `docs/ai/structure.html` to record:

- high-quality WebP attachment delivery through the AWS image loader;
- bounded fail-open behavior for custom Worker edge caches;
- the regional OpenNext incremental-cache layer; and
- the targeted tests and production verification expectations for these paths.

## Acceptance Criteria

- The formerly failing villa `3059` image shape is covered by a regression test and produces a downloadable WebP in the implemented flow.
- No new AWS or S3 secret is required.
- A custom Cache API or HTML-version R2 failure cannot by itself prevent OpenNext from serving a public request.
- Retry counts and operation timeouts are bounded.
- OpenNext uses its supported regional wrapper around the existing R2 incremental cache.
- Existing authorization, request classification, rate limits, cache durations, and public URL shapes remain unchanged.
- Targeted tests, the full suite, lint, and production build pass.
- No deployment or commit is performed without separate user authorization.
