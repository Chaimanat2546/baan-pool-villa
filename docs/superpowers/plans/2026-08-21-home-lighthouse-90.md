# Homepage Lighthouse 90 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Reduce cold mobile homepage LCP/FCP and initial JavaScript while preserving CMS-driven Hero imagery and carousel controls.

**Architecture:** Cache only validated Hero image variants in the Worker Cache API and include the site-settings cache version in the cache key so CMS replacements cannot serve stale images. Keep the Hero image server-rendered; defer only its Embla controls until idle/interaction. Reduce route CSS only after inspecting the source ownership, avoiding global CSS changes that risk visual regressions.

**Tech Stack:** Next.js 16.3 App Router, React 19, Cloudflare Workers/OpenNext, Vitest, Tailwind CSS v4.

**Spec:** User-approved performance work on the production homepage (2026-08-21).

## Global Constraints

- Hero must remain visible in initial HTML and keep its CMS-derived image, alt text, and responsive quality.
- Cache only allowlisted Hero query variants; include the site-settings version in the cache key.
- Do not change the user-required image count or favicon.
- Keep carousel controls available after the deferred enhancement initializes.
- Validate every behavior through a failing test first, then targeted tests, lint, build, and browser checks.

### Task 1: Versioned Worker cache for Hero images

**Files:** `worker-cache-policy.js`, `worker-cache-policy.test.ts`, `worker.js`, `worker-html-cache-version.js`, `worker-html-cache-version.test.ts`

- [ ] Write failing tests for a Hero cache key which distinguishes `slide`, width, quality, and the site-settings cache version; reject unsupported Hero queries.
- [ ] Implement a narrow Hero cache decision and cache-key construction that preserves those fields and falls back safely if the version source is unavailable.
- [ ] Run cache-policy and version tests.

### Task 2: Move non-critical homepage CSS out of the initial route stylesheet

**Files:** exact files identified by CSS ownership inspection; their colocated tests if behavior changes.

- [ ] Inspect the source mapping for the 23KB production stylesheet and identify route-independent or interaction-only CSS that can be loaded later without moving global Tailwind base/theme rules.
- [ ] Write a failing behavior test when a component gains a deferred stylesheet or dynamic boundary.
- [ ] Implement the smallest scoped extraction; preserve the initial Hero/search layout.
- [ ] Run affected homepage component tests and inspect mobile/desktop rendering.

### Task 3: Defer carousel enhancement after initial Hero paint

**Files:** `components/villas/home/hero-section.tsx`, `components/villas/home/hero-carousel.tsx`, a new client enhancement component if needed, and `components/villas/home/__tests__/hero-section.test.tsx`.

- [ ] Write a failing test proving the initial Hero image remains in server markup while Embla-only controls are deferred.
- [ ] Implement a server-rendered static Hero shell plus an idle/interaction-loaded carousel enhancement, retaining keyboard and button controls after it loads.
- [ ] Run Hero and progressive-image tests.

### Task 4: Verification and documentation

**Files:** `docs/ai/structure.html` if cache or feature ownership changes.

- [ ] Run all cache and focused homepage image tests.
- [ ] Run `npm.cmd run lint` and `npm.cmd run build`.
- [ ] Check homepage mobile/desktop; confirm no unexpected `_rsc` or `/_next/image` requests and bounded image requests.
- [ ] Run a local Lighthouse baseline and production Lighthouse after deployment.
