# TikTok oEmbed CORS fix

> **For agentic workers:** Use superpowers:executing-plans to implement this approved plan inline.

**Goal:** Replace direct browser oEmbed requests with a validated same-origin API.

**Architecture:** A thin `/api/tiktok/oembed` route uses a server-only helper in `lib/tiktok`. Reuse the existing TikTok video URL validator, CDN allowlist, public rate limiter, and 12-hour cache policy. Keep the existing client metadata shape, lazy activation, and player behavior.

**Tech Stack:** Next.js 16.3, TypeScript, Vitest, Playwright.

**Spec:** User-approved option 1 in this chat (2026-10-08).

## Constraints and review focus

- No commit, deployment, schema edits, or public path revalidation.
- Reject hostile URLs, credentials, ports, oversized and ambiguous queries before upstream fetch.
- Strip tracking parameters; never follow upstream redirects or return embed HTML.
- Handle upstream 503, timeout, invalid JSON, and unsafe thumbnails with a non-cached null fallback.
- Successful metadata uses the shared 43200-second policy; browser cache must not extend stored expiry.
- Check lazy request counts, fallback, long title, and click-to-load playback at mobile and desktop widths.

## Task 1: API and shared client fix

- [x] Write and run failing client regression and API tests.
- [x] Export the existing video URL predicate in `lib/site-settings/validation.ts`; implement `lib/tiktok/oembed.ts` and the thin public route.
- [x] Switch `components/villas/home/tiktok-client-oembed.ts` to the relative API, align its cache lifetime, and preserve its consumers.
- [x] Add the response cache policy and update `docs/ai/structure.html`.
- [x] Run targeted TikTok, validation, cache-policy, and request-budget tests.

## Task 2: Verification

- [x] Run lint and production build.
- [x] Inspect the production homepage on desktop/mobile, including network and fallback behavior.
- [x] Review the diff and report observed results and upstream limitations.

## Execution notes

- Working tree was clean on `feature/site-analytics`. Work stays in the user's current checkout for this scoped fix; no branch/worktree changes are needed.
- Verification is risk-based per AGENTS.md: focused regression suites plus lint/build and production browser checks.
- Review correction: cache validated metadata with the established `unstable_cache` API; raw HTTP 200 bodies must not be cached before validation. A regression using Next's real cache wrapper and an in-memory persistence adapter verifies recovery after invalid JSON and reuse of the subsequent valid result.
- Final checks: 119 targeted tests in 12 files, lint, and production build passed. Existing homepage production smoke passed in desktop/mobile Chromium.
- Browser checks: 9 cards / 9 same-origin metadata requests per fresh context, no direct browser oEmbed requests, no `_rsc` or `/_next/image`, no page errors, player mounted only on click. Desktop/mobile live data, delayed loading, long-title success, and null fallback were captured and visually inspected. No horizontal overflow.
- Both video URLs supplied in the error log returned HTTP 200 with validated metadata through the local production API. Upstream availability and individual thumbnail delivery remain external dependencies; fallback cards remain usable.
