# Disable OpenNext R2 Incremental Cache

## Goal

Stop using R2, Durable Object tag cache, and the Durable Object ISR queue for OpenNext incremental caching. This removes the high-volume R2 incremental-cache read/write path that is producing Cloudflare internal error `10001`, while preserving the existing Cloudflare Cache API layers for public HTML, JSON, and images.

## Scope

- Configure OpenNext to use its default dummy incremental cache, dummy tag cache, and dummy queue.
- Remove the custom R2 incremental-cache diagnostic adapter and its focused tests.
- Keep each environment's `NEXT_INC_CACHE_R2_BUCKET` binding because the Worker still uses it as a low-volume store for HTML edge-cache version tokens.
- Keep existing Durable Object bindings, exports, and migration history in Wrangler configuration. They become unused by OpenNext, but retaining them avoids a risky infrastructure migration in this change.
- Do not delete R2 buckets or their existing objects.
- Do not change the current public HTML, JSON, image, calendar, or browser cache-control policies.

## Runtime Data Flow

On an OpenNext request, `unstable_cache` and ISR reads will use the dummy incremental cache and therefore will not persist values between Worker invocations. When the Cloudflare Cache API has a public HTML, JSON, or image hit, the existing Worker cache continues to serve it without reaching the application data source. On an edge-cache miss, the application reads Supabase or the relevant external API and renders the response normally.

Admin saves continue to call the existing Next tag-revalidation helpers, but there is no persistent OpenNext tag cache to update. The existing HTML/JSON version-bump flow remains responsible for changing Cloudflare Cache API keys. HTML version tokens continue to use the R2 binding with the existing 15-second in-isolate memory cache, producing only small, bounded reads and writes rather than incremental-cache traffic.

## Expected Behavior and Trade-offs

- OpenNext no longer issues R2 operations under the `incremental-cache/` prefix.
- OpenNext no longer queries the Durable Object tag cache, so `Error while checking revalidation` from that path should stop.
- Cloudflare Cache API behavior and its existing TTLs remain unchanged.
- An edge-cache miss performs fresh upstream reads instead of using a persistent Next data cache. This increases Supabase/external API traffic on misses but avoids R2 incremental-cache failures and stale persistent entries.
- R2 may still receive low-volume `html-cache-versions/` reads and writes. Therefore the project is removing R2 as an incremental-cache backend, not removing all R2 usage.
- Existing R2 objects remain recoverable and can be cleaned up separately after production behavior is verified.

## Error Handling

If the retained HTML version-token store or object is unavailable, the version helper uses the default token. If a version read still fails after the Worker retry policy, the Worker safely bypasses its edge cache and fetches OpenNext instead. Version writes, including admin version bumps, remain best-effort. Application data loading and the Cloudflare Cache API keep their current error handling.

## Files and Documentation

- Simplify `open-next.config.ts` to `defineCloudflareConfig()` with no cache, tag-cache, or queue overrides.
- Delete `open-next-r2-incremental-cache-diagnostics.js` and its test.
- Update `open-next.config.test.ts` to assert the resolved dummy OpenNext incremental-cache, tag-cache, and queue values.
- Update `docs/ai/structure.html` to describe the new cache ownership and targeted verification.

## Verification

- Run the focused OpenNext configuration test.
- Run the complete Vitest suite.
- Run ESLint.
- Run the Next.js production build.
- Run the OpenNext Cloudflare build.
- Inspect the final diff and confirm the R2 binding remains present only for HTML cache-version storage.
- After a separately authorized deployment, compare new one-hour Cloudflare logs and R2 operation metrics against the pre-change baseline. Historical errors are not expected to disappear.

## Out of Scope

- Deploying any Worker.
- Deleting R2 objects, buckets, Durable Object namespaces, bindings, classes, or migration history.
- Replacing the incremental cache with Workers KV or another backend.
- Changing public cache TTLs or data freshness policies.
