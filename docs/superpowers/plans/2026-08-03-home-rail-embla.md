# Home Rail Embla Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken native homepage rail with Embla while keeping per-rail auto-scroll configuration and the current card design.

**Architecture:** `ScrollRail` becomes the sole client wrapper around `embla-carousel-react` and `embla-carousel-auto-scroll`. It exposes the existing `autoScroll` prop; `VillaRail` and the saved `autoScrollEnabled` setting remain unchanged. Embla?s API drives previous/next buttons.

**Tech Stack:** Next.js 16, React 19, TypeScript, Embla Carousel React 8.6, Embla Auto Scroll, Vitest, Tailwind CSS.

## Global Constraints

- Preserve the `autoScrollEnabled` data contract, migration, and existing Thai admin setting; omit the removed interaction-support wording.
- Use `embla-carousel-react` plus the official `embla-carousel-auto-scroll` package; add no other carousel library.
- Rails with auto-scroll disabled remain draggable and their previous/next buttons must work.
- Auto-scroll respects `prefers-reduced-motion` and pauses for hover, focus, and pointer interaction.
- Keep the current visible card sizing and desktop-only side controls.
- Update `docs/ai/structure.html`; do not commit unless the user explicitly asks.

---

### Task 1: Add the official Auto Scroll dependency and failing component tests

**Files:** `package.json`, `package-lock.json`, `components/ui/__tests__/scroll-rail.test.tsx`

- [ ] Write tests that mock the Embla hook and assert that arrows call `scrollPrev`/`scrollNext`, and `autoScroll={true}` supplies the plugin while false does not.
- [ ] Run `npm.cmd test -- components/ui/__tests__/scroll-rail.test.tsx` and confirm it fails because native `scrollBy` is still used.
- [ ] Run `npm.cmd install embla-carousel-auto-scroll@^8.6.0` so the official plugin version matches the installed Embla major version.

### Task 2: Replace native scrolling with Embla

**Files:** `components/ui/scroll-rail.tsx`, `components/ui/__tests__/scroll-rail.test.tsx`

**Interface:** keeps `ScrollRailProps`, including the optional `autoScroll` Boolean; provides an Embla viewport and API-driven controls.

- [ ] Initialize `useEmblaCarousel` with horizontal drag, retain the outer controls, and make the existing children container the Embla slide container without changing card sizing.
- [ ] Use `loop: autoScroll` and configure Auto Scroll with low speed, `stopOnMouseEnter: true`, `stopOnFocusIn: true`, and interaction resume only after visitor release; skip the plugin for reduced motion.
- [ ] Subscribe to Embla select/reInit events to keep control availability correct, then remove subscriptions during cleanup.
- [ ] Run `npm.cmd test -- components/ui/__tests__/scroll-rail.test.tsx` and verify it passes.

### Task 3: Verify integration and update structure documentation

**Files:** `components/villas/home/villa-rail.tsx` (only if container classes need adjustment), `components/villas/home/__tests__/page.test.tsx`, `docs/ai/structure.html`

- [ ] Confirm an enabled resolved rail passes `autoScrollEnabled` through `VillaRail` to `ScrollRail`, while disabled rails keep the same cards and CTA.
- [ ] Record that the saved per-rail setting is rendered through the shared Embla rail with drag and official auto-scroll behavior.
- [ ] Run `npm.cmd test -- components/ui/__tests__/scroll-rail.test.tsx components/villas/home/__tests__/page.test.tsx components/admin/sections/__tests__/section-config-form.test.tsx`, then `npm.cmd run lint`, then `npm.cmd run build`.
- [ ] At desktop and mobile widths, verify drag, both arrows, enabled auto-scroll pause/resume, and stationary disabled rails.

## Self-review

The plan preserves the existing database/admin contract and limits the replacement to one shared UI component plus its focused tests and documentation.

