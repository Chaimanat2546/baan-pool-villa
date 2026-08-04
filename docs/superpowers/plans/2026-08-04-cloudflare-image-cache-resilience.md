# Cloudflare Image Download and Cache Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make villa image downloads work through the existing WebP loader and keep public routes available when Cloudflare edge-cache bindings fail transiently.

**Architecture:** Replace the gallery download route's direct source fetch with the already-authorized public image proxy fetch path, preserving the attachment response. Extract repeatable bounded Worker cache operations into a small JavaScript helper so HTML, JSON, and image edge caches bypass safely after one transient retry. Wrap OpenNext's supported R2 incremental cache in its long-lived regional layer to reduce duplicate R2 operations.

**Tech Stack:** Next.js 16.2.9, TypeScript, Vitest 4, Cloudflare Workers Cache API/R2, OpenNext Cloudflare 1.19.11.

## Global Constraints

- Do not add AWS/S3 credentials, signed source URLs, or public source URLs.
- Gallery download output is WebP through the existing AWS image loader, at width `1920` and quality `90`.
- Keep request classification, rate-limit policies, URL shapes, and cache durations unchanged.
- Use a `1500` millisecond operation timeout, a `50` millisecond delay, and one retry only for transient cache-binding errors.
- Cache failures must bypass the custom edge cache; application and database errors must not be swallowed.
- Never log secrets, cookies, client IPs, raw query strings, or full image source URLs.
- Do not commit or deploy: the repository requires explicit user authorization for both.
- Update `docs/ai/structure.html` with ownership and verification changes.

---

## File Structure

- `lib/villas/public-image-route.ts` — retains image authorization and produces no-store WebP attachment responses using the shared proxy fetcher.
- `lib/villas/__tests__/image-download.test.ts` — covers loader-backed gallery downloads and preserved safe rejection paths.
- `worker-cache-resilience.js` — owns transient-error classification, bounded cache operations, sanitized logging, and background write retries.
- `worker-cache-resilience.test.ts` — verifies retry, timeout, bypass, and log sanitization behavior without importing the full Worker bundle.
- `worker.js` — coordinates the existing HTML, JSON, and image edge caches through the resilience helper.
- `open-next.config.ts` — enables OpenNext's supported long-lived regional wrapper around R2 incremental cache.
- `open-next.config.test.ts` — asserts the regional wrapper configuration from source-level behavior.
- `docs/ai/structure.html` — records WebP download delivery, fail-open edge caches, regional incremental cache, and verification guidance.

### Task 1: Loader-backed gallery download

**Files:**

- Modify: `lib/villas/public-image-route.ts:1-310`
- Modify: `lib/villas/__tests__/image-download.test.ts:1-410`

**Interfaces:**

- Consumes: `fetchPublicImageProxyResponse(targetUrl, { quality: 90, width: 1920 })` from `lib/public-image-proxy-server.ts`.
- Produces: the existing `downloadVillaImage(...)` response contract: `200` image attachment, `404` for non-member image URLs, `502` for unavailable/non-image upstream bytes.

- [ ] **Step 1: Write the failing WebP download regression test**

Add a test with an S3 source row and mock `fetch` so the AWS loader URL returns a WebP stream. Assert that the first fetch target is the loader URL and that the response remains an attachment.

```ts
it("downloads an authorized private S3 gallery image through the WebP loader", async () => {
  fetchVillaImagesMock.mockResolvedValue([
    { ...imageRows[0], imageUrl: "https://s3.ap-southeast-1.amazonaws.com/poolvillas.co.ltd/pool.jpg" },
  ]);
  const fetchMock = vi.fn().mockResolvedValue(
    new Response("webp bytes", { headers: { "Content-Type": "image/webp" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const { GET } = await import("../../../app/(public)/api/villas/[id]/images/download/route");

  const response = await GET(
    new Request("https://example.com/api/villas/9/images/download?url=https%3A%2F%2Fs3.ap-southeast-1.amazonaws.com%2Fpoolvillas.co.ltd%2Fpool.jpg&zone=pool&name=pool.jpg"),
    { params: Promise.resolve({ id: "9" }) },
  );

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/pool.jpg?w=1920&q=90"),
    expect.objectContaining({ cache: "no-store", redirect: "manual", signal: expect.any(AbortSignal) }),
  );
  expect(response.headers.get("Content-Type")).toBe("image/webp");
  expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="villa-9-pool-pool.webp"');
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
```

- [ ] **Step 2: Run the focused regression test and verify it fails**

Run: `npm.cmd test -- lib/villas/__tests__/image-download.test.ts`

Expected: FAIL because the current direct fetch requests the S3 URL and produces a JPEG-oriented filename.

- [ ] **Step 3: Update the shared download response implementation**

Replace the direct `fetchAllowedVillaImageDownload` call in `downloadVillaImage` with the existing `fetchPublicImageProxyResponse`. Keep `isAllowedVillaImageUrl` before the fetch, call the proxy fetcher with `{ width: 1920, quality: 90 }`, validate its body/content type, and retain `Content-Disposition` plus `Cache-Control: no-store` on the response.

```ts
const upstreamResponse = await fetchPublicImageProxyResponse(targetUrl, {
  quality: 90,
  width: 1920,
});

const contentType = upstreamResponse?.headers.get("Content-Type") ?? "";
if (!upstreamResponse?.ok || !upstreamResponse.body || !contentType.toLowerCase().startsWith("image/")) {
  return Response.json({ error: "Unable to download image" }, { status: 502 });
}
```

Use the returned content type in `buildImageDownloadFilename` so the MIME type determines `.webp`.

- [ ] **Step 4: Update rejection and timeout tests**

Adjust existing direct-fetch expectations to assert loader behavior. Retain tests for invalid IDs, non-member URLs, non-image responses, and a 10-second abort. Add a non-S3 source test that confirms the existing validated proxy behavior is retained.

- [ ] **Step 5: Run focused image tests**

Run: `npm.cmd test -- lib/villas/__tests__/image-download.test.ts lib/villas/__tests__/image-proxy.test.ts lib/__tests__/public-image-proxy-server.test.ts`

Expected: PASS.

### Task 2: Bounded custom Worker cache operations

**Files:**

- Create: `worker-cache-resilience.js`
- Create: `worker-cache-resilience.test.ts`
- Modify: `worker.js:1-210`
- Modify: `worker-html-cache-version.js:1-80` only if it needs a narrow injected reader interface for tests; otherwise preserve its exported API.

**Interfaces:**

- Produces `runCacheRead({ cacheKind, operation, routeKind, run })` returning `{ ok: true, value } | { ok: false }`.
- Produces `scheduleCacheWrite(ctx, { cacheKind, operation, routeKind, run })` which calls `ctx.waitUntil` and never rejects to the request path.
- Consumes a zero-argument `run(): Promise<T>` for Cache API reads, R2 version-token reads, and Cache API writes.

- [ ] **Step 1: Write failing helper tests**

Create tests with fake timers and injected operations for success, one transient failure followed by success, timeout, permanent failure, and sanitized warnings.

```ts
it("retries a transient cache read once", async () => {
  const run = vi.fn()
    .mockRejectedValueOnce(new Error("Network connection lost"))
    .mockResolvedValueOnce("cached response");

  await expect(runCacheRead({ cacheKind: "html", operation: "match", routeKind: "html", run }))
    .resolves.toEqual({ ok: true, value: "cached response" });
  expect(run).toHaveBeenCalledTimes(2);
});

it("returns a bypass result when a cache read exceeds 1500ms", async () => {
  vi.useFakeTimers();
  const resultPromise = runCacheRead({ cacheKind: "json", operation: "match", routeKind: "api", run: () => new Promise(() => {}) });
  await vi.advanceTimersByTimeAsync(1500);
  await expect(resultPromise).resolves.toEqual({ ok: false });
});
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run: `npm.cmd test -- worker-cache-resilience.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the resilience helper**

Implement constants `CACHE_OPERATION_TIMEOUT_MS = 1500`, `CACHE_RETRY_DELAY_MS = 50`, and `MAX_CACHE_ATTEMPTS = 2`. Race each operation with a timeout, retry only normalized transient error messages, and return `{ ok: false }` after the final failed attempt. Use `console.warn` with an object containing only `cacheKind`, `operation`, `routeKind`, `attempt`, and `errorCategory`.

```js
export async function runCacheRead({ cacheKind, operation, routeKind, run }) {
  for (let attempt = 1; attempt <= MAX_CACHE_ATTEMPTS; attempt += 1) {
    try {
      return { ok: true, value: await withTimeout(run, CACHE_OPERATION_TIMEOUT_MS) };
    } catch (error) {
      logCacheFailure({ cacheKind, operation, routeKind, attempt, error });
      if (attempt === MAX_CACHE_ATTEMPTS || !isTransientCacheError(error)) return { ok: false };
      await delay(CACHE_RETRY_DELAY_MS);
    }
  }
  return { ok: false };
}
```

- [ ] **Step 4: Route HTML, JSON, and image edge-cache reads through the helper**

In `worker.js`, use the helper around `cache.match` for every custom cache. For HTML/JSON version reads, wrap `getHtmlEdgeCacheVersionToken`; when it returns `{ ok: false }`, call `fetchOpenNext` and apply the existing `BYPASS` header. Do not create a cache key from a default/stale version token after a failed version read.

For each existing `ctx.waitUntil(cache.put(...).catch(...))`, replace the inline call with `scheduleCacheWrite`. Preserve cache hits, normal misses, response cloning, and the existing header names.

- [ ] **Step 5: Add Worker integration tests for fail-open behavior**

Mock `caches.default.match` and `getHtmlEdgeCacheVersionToken` in a focused Worker test. Assert that a timeout or two transient failures calls `openNextWorker.fetch` exactly once and returns `x-bpv-*-cache: BYPASS`; assert cache hits still do not call OpenNext.

- [ ] **Step 6: Run Worker tests**

Run: `npm.cmd test -- worker-cache-resilience.test.ts worker-cache-policy.test.ts worker-html-cache-version.test.ts worker-cache-policy.js`

Expected: PASS. If the test runner rejects `worker-cache-policy.js` as a target, run the three `.test.ts` paths only.

### Task 3: OpenNext regional incremental cache configuration and docs

**Files:**

- Modify: `open-next.config.ts:1-18`
- Create: `open-next.config.test.ts`
- Modify: `docs/ai/structure.html:727-729,796-799`

**Interfaces:**

- Consumes: `withRegionalCache` from `@opennextjs/cloudflare/overrides/incremental-cache/regional-cache`.
- Produces: the existing Cloudflare config with `incrementalCache` set to `withRegionalCache(r2IncrementalCache, { mode: "long-lived" })`.

- [ ] **Step 1: Write a failing configuration test**

Create a source-level test that reads `open-next.config.ts` and asserts the regional-cache import plus long-lived wrapper are present without enabling `bypassTagCacheOnCacheHit`.

```ts
it("wraps the R2 incremental cache in the long-lived regional cache", async () => {
  const source = await readFile("open-next.config.ts", "utf8");
  expect(source).toContain('from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache"');
  expect(source).toMatch(/incrementalCache:\s*withRegionalCache\(r2IncrementalCache,\s*\{\s*mode:\s*"long-lived"/s);
  expect(source).not.toContain("bypassTagCacheOnCacheHit: true");
});
```

- [ ] **Step 2: Run the configuration test and verify it fails**

Run: `npm.cmd test -- open-next.config.test.ts`

Expected: FAIL because `incrementalCache` currently references `r2IncrementalCache` directly.

- [ ] **Step 3: Enable the OpenNext regional wrapper**

Update `open-next.config.ts` as follows while leaving the queue and sharded tag cache unchanged.

```ts
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";

incrementalCache: withRegionalCache(r2IncrementalCache, {
  mode: "long-lived",
}),
```

- [ ] **Step 4: Update architecture documentation**

In `docs/ai/structure.html`, update the Worker/cache row and Villa images row to state that gallery downloads return high-quality WebP through the AWS loader, custom cache binding failures are bounded and fail open to OpenNext, and OpenNext uses a long-lived regional cache above R2. Add the four focused test files to the existing verification guidance.

- [ ] **Step 5: Run configuration and documentation-adjacent tests**

Run: `npm.cmd test -- open-next.config.test.ts lib/__tests__/next-config.test.ts worker-cache-policy.test.ts`

Expected: PASS.

### Task 4: End-to-end verification

**Files:**

- Modify only if verification reveals a concrete defect: files from Tasks 1-3.

**Interfaces:**

- Consumes: completed image download, Worker resilience, and configuration changes.
- Produces: verified local production build; no deployment or commit.

- [ ] **Step 1: Run targeted regression suite**

Run: `npm.cmd test -- lib/villas/__tests__/image-download.test.ts lib/villas/__tests__/image-proxy.test.ts lib/__tests__/public-image-proxy-server.test.ts worker-cache-resilience.test.ts worker-cache-policy.test.ts worker-html-cache-version.test.ts open-next.config.test.ts`

Expected: PASS.

- [ ] **Step 2: Run the full unit suite**

Run: `npm.cmd test`

Expected: PASS.

- [ ] **Step 3: Run static and production checks**

Run: `npm.cmd run lint`

Expected: PASS with no ESLint errors.

Run: `npm.cmd run build`

Expected: successful Next.js production build.

- [ ] **Step 4: Render and inspect the affected public flow**

Start the local production server, inspect a villa detail page at desktop and mobile widths, open the gallery lightbox, and trigger download. Confirm the response is an image/WebP attachment and that display requests remain same-origin `/api/villas/:id/images?...` without `/_next/image` or unexpected `_rsc` requests.

- [ ] **Step 5: Report deployment boundary**

Do not deploy. State that production verification of the live worker requires a separately authorized deployment, then check the live download endpoint and cache diagnostics only after that authorization.

## Plan Self-Review

### Spec coverage

- WebP loader download, source authorization, response headers, and safe errors: Task 1.
- Bounded retry/timeout, fail-open cache behavior, and sanitized observability: Task 2.
- OpenNext regional R2 cache and unchanged cache policy: Task 3.
- Documentation, focused tests, full suite, lint, build, and visual/network checks: Tasks 3 and 4.
- No new secrets, no deployment, and no commit: Global Constraints and Task 4.

### Placeholder scan

The plan has no unresolved markers, deferred implementation steps, or undefined interfaces. Every task defines files, inputs/outputs, concrete test assertions, commands, and expected results.

### Type consistency

`runCacheRead` consistently returns `{ ok: true, value } | { ok: false }`; `scheduleCacheWrite` is intentionally fire-and-forget through `ctx.waitUntil`; all Worker changes remain JavaScript and all application/test changes remain TypeScript.
