# Homepage Image Loading Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide blank image areas with per-image skeletons in the homepage Hero and its Villa, article, and TikTok rails.

**Architecture:** Create one client-side `ImageWithSkeleton` wrapper around `CspSafeImage`; each instance tracks its own load/error completion and overlays the shared `Skeleton` component until completion. Replace only homepage Hero and rail image consumers, including the gallery-style VillaCard rail image, leaving all gallery and grid consumers unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest/JSDOM.

## Global Constraints

- Hero and the three homepage horizontal rails only: Villas, articles, and TikTok.
- Keep the existing dimensions, source URLs, image quality, loading policy, preload behavior, `object-fill`, and controls.
- An image error must dismiss its skeleton so it does not mask existing fallbacks forever.
- Do not change galleries, listing grids, or non-homepage card behavior.
- Do not commit or push unless explicitly requested.

---

### Task 1: Add reusable per-image skeleton wrapper

**Files:**
- Create: `components/ui/image-with-skeleton.tsx`
- Create: `components/ui/__tests__/image-with-skeleton.test.tsx`

**Interfaces:**
- Consumes: `CspSafeImage` props and `Skeleton`.
- Produces: `ImageWithSkeleton`, with `className`, `skeletonClassName`, and normal image props; its overlay has `data-image-loading-skeleton` only before image load/error.

- [ ] **Step 1: Write failing tests**

Render `ImageWithSkeleton` with a mocked image that exposes its `onLoad` callback. Assert the loading marker initially exists, dispatch load, and assert it no longer exists. Repeat with error to assert dismissal.

- [ ] **Step 2: Run focused test and verify failure**

Run: `npm.cmd test -- components/ui/__tests__/image-with-skeleton.test.tsx`

Expected: failure because `ImageWithSkeleton` does not exist.

- [ ] **Step 3: Implement the wrapper**

Use `useState(false)` for completion, pass `onLoad` and `onError` to `CspSafeImage`, and conditionally render:

```tsx
{!isComplete ? <Skeleton aria-hidden="true" className={`pointer-events-none absolute inset-0 ${skeletonClassName}`} data-image-loading-skeleton /> : null}
```

Call any consumer-supplied callbacks after marking completion.

- [ ] **Step 4: Run focused test and verify pass**

Run: `npm.cmd test -- components/ui/__tests__/image-with-skeleton.test.tsx`

Expected: all wrapper tests pass.

### Task 2: Apply skeletons to homepage Hero and rails

**Files:**
- Modify: `components/villas/home/hero-carousel.tsx`
- Modify: `components/villas/listing/villa-card.tsx`
- Modify: `components/villas/listing/villa-card-gallery-images.tsx`
- Modify: `components/villas/home/articles-section.tsx`
- Modify: `components/villas/home/tiktok-lazy-card.tsx`
- Modify: `components/villas/home/__tests__/hero-section.test.tsx`

**Interfaces:**
- Consumes: `ImageWithSkeleton` from Task 1.
- Produces: a per-image `data-image-loading-skeleton` overlay for Hero, rail Villa cards (classic and gallery), article cards, and TikTok posters.

- [ ] **Step 1: Write failing rendering tests**

Update Hero static markup to expect `data-image-loading-skeleton`. Add focused static-markup assertions in VillaCard, ArticlesSection, and TikTok card tests for the same marker.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm.cmd test -- components/villas/home/__tests__/hero-section.test.tsx components/villas/home/__tests__/request-budget.test.tsx components/villas/listing/__tests__/villa-card-navigation.test.tsx components/villas/listing/__tests__/villa-card-gallery-images.test.tsx`

Expected: marker assertions fail before consumers use the wrapper.

- [ ] **Step 3: Replace only scoped image elements**

Replace `CspSafeImage` with `ImageWithSkeleton` in the Hero, VillaCard classic cover, VillaCard gallery main image, article cover, and TikTok poster. Retain every existing prop and class; pass an absolute, frame-filling skeleton class where the image parent is already relative.

- [ ] **Step 4: Run focused tests and verify pass**

Run the command from Step 2 plus `components/ui/__tests__/image-with-skeleton.test.tsx`.

Expected: all targeted tests pass.

- [ ] **Step 5: Document shared UI ownership**

Update `docs/ai/structure.html` to list `ImageWithSkeleton` under `components/ui` as the homepage image-load overlay owner.

- [ ] **Step 6: Run repository and UI verification**

Run:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Inspect the home page on mobile and desktop: initial Hero, next unloaded Hero slide, Villa rail, article rail, and TikTok rail must show a frame-aligned skeleton only until their respective image loads.
