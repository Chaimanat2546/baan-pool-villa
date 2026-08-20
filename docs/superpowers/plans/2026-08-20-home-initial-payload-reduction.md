# Home Initial Payload Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the cold homepage document to the Hero, search controls, and first rail while retaining 1000px preloading for later content.

**Architecture:** The server renders the critical first rail only. A cached public homepage-deferred payload provides the remaining rails, reviews, and guide summaries after a client-side near-viewport boundary becomes active. Existing progressive image activation remains inside the loaded sections, and the public endpoint uses the shared cache/rate-limit policy.

**Tech Stack:** Next.js App Router 16.3, React 19, Vitest, existing public cache helpers.

**Spec:** `docs/superpowers/specs/2026-08-20-home-progressive-image-loading-design.md`

## Global Constraints

- Work on the user-selected current branch; do not commit.
- Keep Hero/search and the first enabled rail server-rendered and immediately visible.
- Keep public cache policy centralized in `lib/cache-policy.ts`; avoid unexpected `_rsc` and `/_next/image` requests.
- Public deferred content starts fetching at a 1000px boundary and must preserve a stable empty/loading layout.
- Use TDD: every behavioral production change starts with a focused failing test.

---

### Task 1: Add a cached public deferred-home payload

**Files:**
- Modify: `app/(public)/api/home-sections/route.ts` or create a focused public home-deferred route
- Modify: shared homepage server-data helper near `app/(public)/(home)/page.tsx`
- Test: focused route/server-data tests

- [ ] Write a failing test that the payload excludes the critical rail and contains public DTOs for later rails, guides, and customer reviews.
- [ ] Run the focused test and confirm it fails because no deferred payload owner exists.
- [ ] Implement a shared server helper and cached/rate-limited public response using existing DTO/cache helpers.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Render only critical content initially and fetch deferred content near the viewport

**Files:**
- Modify: `app/(public)/(home)/page.tsx`
- Modify: `components/villas/home/page.tsx`
- Create: `components/villas/home/deferred-home-content.tsx`
- Test: `components/villas/home/__tests__/page.test.tsx` and a focused deferred-content test

- [ ] Write failing tests that initial Home markup includes only the first enabled rail and no later card/article/review payload; after simulated activation it requests the public deferred endpoint once and renders the returned items.
- [ ] Run the focused test and confirm it fails because all content is currently passed in initial props.
- [ ] Implement a client boundary with `IntersectionObserver` rootMargin `1000px`, request cancellation/error handling, and skeleton/fallback that keeps layout stable.
- [ ] Change server data loading to pass only the critical rail plus small layout/settings metadata to initial markup.
- [ ] Re-run focused tests and confirm they pass.

### Task 3: Assert payload budget and verify production behavior

**Files:**
- Modify: `tests/production-smoke.spec.ts` and/or request-budget support tests
- Modify: `docs/ai/structure.html`

- [ ] Add a failing production-smoke/support assertion that the initial document does not contain data attributes or response events for deferred rails, guides, and reviews before the boundary activates.
- [ ] Run the test to observe the current eager payload failure.
- [ ] Update test support and structure documentation with the deferred content ownership and verification commands.
- [ ] Run focused homepage tests, lint, build, production request measurements, and browser smoke if Chromium is available.

## Plan Self-Review

- Coverage: dependency synchronization is completed; Tasks 1–3 remove deferred data/markup from initial HTML while preserving the approved critical rendering and image policy.
- No placeholders: each task names exact owners, behavior, and test progression.
- Consistency: `1000px` is the same proximity contract used by current image activation boundaries.
