# Homepage Progressive Image Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make homepage images feel immediate without letting every homepage image compete during the initial page load.

**Architecture:** A reusable progressive image component renders a 64px blurred version of the same validated image while the full-resolution image is inactive or downloading. Homepage image activation is controlled through a near-viewport context, while the first villa rail adds a rolling four-card full-image window driven by the existing Embla rail.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, `next/image` with the project custom image loader, Embla Carousel, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-20-home-progressive-image-loading-design.md`

## Global Constraints

- Scope is homepage-only; do not change search, guide, or villa-detail image behavior.
- Use the existing public image proxy, custom loader, transform allowlists, image hosts, and cache policy; add none.
- Use the existing transformed preview floor: width `64`, quality `60`.
- Critical content is the first hero slide plus cards 1-4 of the first villa rail.
- Subsequent homepage image-heavy sections activate once within `1000px` of the viewport.
- Rail cover-image activation remains monotonic for the open page: once active, never deactivate it.
- Preserve fixed media dimensions, alt text, keyboard controls, safe URL behavior, and reduced-motion accessibility.
- Do not commit unless the user explicitly requests a commit.
- Run `npm.cmd run lint` and `npm.cmd run build` before reporting the frontend work complete.

## File Structure

- Create `components/ui/progressive-image.tsx`: render a preview at a bounded width, activate the full image only when permitted, and retain a preview/neutral fallback on failures.
- Create `components/ui/near-viewport-activation.tsx`: expose a client context whose value changes from inactive to active once its wrapper is within a configurable observer margin.
- Create `components/ui/__tests__/progressive-image.test.tsx`: verify request/DOM state contracts and error fallbacks.
- Create `components/ui/__tests__/near-viewport-activation.test.tsx`: verify the 1000px observer contract and the no-observer fallback.
- Modify `components/ui/scroll-rail.tsx`: add an optional `onActiveIndexChange(index: number)` callback based on Embla’s selected snap.
- Modify `components/ui/__tests__/scroll-rail-embla.test.tsx`: verify selected-index notifications and listener cleanup.
- Modify `components/villas/listing/villa-card.tsx`: pass card cover activation to the progressive image path without changing link, card, or gallery semantics.
- Modify `components/villas/home/villa-rail.tsx`: manage the four-card rolling activation window and report its selected rail snap through `ScrollRail`.
- Modify `components/villas/home/hero-carousel.tsx`: activate/preload only slide 0 on initial render and activate future slides on selection.
- Modify `components/villas/home/page.tsx`: wrap non-critical image-heavy homepage layout entries in the 1000px activation boundary while leaving the hero and first rail critical.
- Modify `components/villas/home/articles-section.tsx`, `components/villas/home/customer-review-section.tsx`, and `components/villas/home/tiktok-lazy-card.tsx`: use the progressive image primitive and the activation context for homepage-only non-critical imagery.
- Modify existing focused tests in `components/villas/home/__tests__/` and `components/villas/listing/__tests__/` to assert the new request budget and UI contract.
- Modify `tests/production-smoke.spec.ts` to assert the initial homepage image request budget without making timing-dependent assertions.
- Modify `docs/ai/structure.html`: record the homepage progressive-image ownership, 1000px behavior, and verification path.

---

### Task 1: Add progressive image and near-viewport activation primitives

**Files:**
- Create: `components/ui/progressive-image.tsx`
- Create: `components/ui/near-viewport-activation.tsx`
- Create: `components/ui/__tests__/progressive-image.test.tsx`
- Create: `components/ui/__tests__/near-viewport-activation.test.tsx`

**Interfaces:**
- Produces `ProgressiveImage`, which accepts the same layout/alt/source essentials as `CspSafeImage` plus `previewActive`, `fullImageActive`, `fullImagePreload`, and `fullImageLoading`.
- Produces `NearViewportActivation`, which accepts `children`, `initiallyActive`, and `rootMargin`, and provides `useImageActivation()` to nested client image components.
- `useImageActivation()` returns `true` outside a boundary so non-home callers retain their existing behavior.

- [ ] **Step 1: Write the failing primitive tests**

Create tests that mock `next/image` and assert these exact DOM contracts:

```tsx
render(
  <ProgressiveImage
    previewActive={true}
    fullImageActive={false}
    alt="พูลวิลล่าริมทะเล"
    fill
    sizes="290px"
    src="/api/houses/images/501"
  />,
);

expect(screen.getByTestId("progressive-preview")).toHaveAttribute(
  "data-maximum-width",
  "64",
);
expect(screen.queryByTestId("progressive-full")).toBeNull();
```

Add a full-active test that expects one full image, a preview, and only the
full image to carry `preload`. Add a fully inactive test that expects neither
image source in the DOM and the neutral fallback instead. Add error-event tests
proving preview failure shows the existing neutral fallback and full-image
failure leaves the preview in the document. Add a reduced-motion test that
asserts the full image has no transition class when
`matchMedia("(prefers-reduced-motion: reduce)")` matches.

For the activation wrapper, replace `IntersectionObserver` with a test double,
render `<NearViewportActivation initiallyActive={false} rootMargin="1000px">`,
and assert that it observes with exactly `{ rootMargin: "1000px" }`, turns its
context true only after an intersecting entry, disconnects, and does not turn
false again. Add a separate test with no `IntersectionObserver` that expects a
nested consumer to become active after the fallback effect.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```powershell
npm.cmd test -- components/ui/__tests__/progressive-image.test.tsx components/ui/__tests__/near-viewport-activation.test.tsx
```

Expected: FAIL because neither module exists.

- [ ] **Step 3: Implement `NearViewportActivation`**

Create a client component with this public surface:

```tsx
export const ImageActivationContext = createContext(true);

export function useImageActivation(): boolean {
  return useContext(ImageActivationContext);
}

export function NearViewportActivation({
  children,
  initiallyActive = false,
  rootMargin = "1000px",
}: {
  children: ReactNode;
  initiallyActive?: boolean;
  rootMargin?: string;
}): ReactNode;
```

Use a `ref` on a wrapping `div` with `data-near-viewport-activation`. Keep the
state true after the first intersection and disconnect the observer. If the
browser does not provide `IntersectionObserver`, schedule `setActive(true)` in
an effect, matching the project’s `LazyDetailBlock` progressive-enhancement
pattern without accessing browser APIs during render.

- [ ] **Step 4: Implement `ProgressiveImage`**

Use `CspSafeImage` only after `previewActive` is true: render the preview first
and render the full image only when `fullImageActive` is true. For the preview,
set `maximumWidth={64}`, `quality={60}`, and a blurred, scaled CSS class. For
the full image, forward `fullImageLoading` and `fullImagePreload` and fade it
in after `onLoad`.

Keep both images in the caller’s existing fixed-size parent. Do not construct
URLs manually: passing the existing proxy source through `CspSafeImage` with
`maximumWidth={64}` preserves `slide`, `imageId`, `w`, `q`, validation, and the
custom loader behavior. Use named data attributes:

```tsx
data-progressive-image
data-progressive-preview
data-progressive-full
data-progressive-image-fallback
```

If the preview errors, show the same neutral visual fallback as the old
component. If the full image errors, keep the preview and never restore the
skeleton overlay. Respect reduced motion by deriving a `motion-safe` class or
media-query state without disabling loading behavior.

- [ ] **Step 5: Run the primitive tests**

Run:

```powershell
npm.cmd test -- components/ui/__tests__/progressive-image.test.tsx components/ui/__tests__/near-viewport-activation.test.tsx
```

Expected: PASS.

### Task 2: Report active rails through the existing Embla wrapper

**Files:**
- Modify: `components/ui/scroll-rail.tsx`
- Modify: `components/ui/__tests__/scroll-rail-embla.test.tsx`

**Interfaces:**
- Consumes: existing `emblaApi.selectedScrollSnap()`.
- Produces: optional `onActiveIndexChange?: (index: number) => void` prop.
- Existing `ScrollRail` callers remain source-compatible because the prop is optional.

- [ ] **Step 1: Write the failing active-index test**

Add a test whose Embla mock provides `selectedScrollSnap`, `on`, and `off`.
Render:

```tsx
const onActiveIndexChange = vi.fn();
root.render(
  <ScrollRail label="บ้านพัก" onActiveIndexChange={onActiveIndexChange}>
    <div>Card</div>
  </ScrollRail>,
);
```

Assert it reports index `0` after mount, registers a `select` listener, reports
the changed mocked snap when that listener runs, and removes the same listener
on unmount. Keep the existing arrow, drag, hover, and auto-scroll assertions.

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```powershell
npm.cmd test -- components/ui/__tests__/scroll-rail-embla.test.tsx
```

Expected: FAIL because `onActiveIndexChange` is not in `ScrollRailProps` and
no listener is registered.

- [ ] **Step 3: Implement optional active-index reporting**

Add this prop to `ScrollRailProps`:

```ts
onActiveIndexChange?: (index: number) => void;
```

Create a memoized callback that reads `emblaApi?.selectedScrollSnap()`. In an
effect that runs only when both the API and callback exist, invoke it once,
subscribe it to Embla’s `select` event, and remove it on cleanup. Do not use
`scrollNext`/`scrollPrev` to infer state, because drag and auto-scroll also
change selection.

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```powershell
npm.cmd test -- components/ui/__tests__/scroll-rail-embla.test.tsx
```

Expected: PASS.

### Task 3: Make villa-card covers progressive and add the rolling rail window

**Files:**
- Modify: `components/villas/listing/villa-card.tsx`
- Modify: `components/villas/listing/villa-card-gallery-images.tsx`
- Modify: `components/villas/home/villa-rail.tsx`
- Modify: `components/villas/home/__tests__/request-budget.test.tsx`
- Create: `components/villas/home/__tests__/villa-rail-image-window.test.tsx`
- Modify: relevant `components/villas/listing/__tests__/villa-card*.test.tsx`

**Interfaces:**
- Consumes `ProgressiveImage`, `useImageActivation`, and `ScrollRail`’s
  `onActiveIndexChange` from Tasks 1-2.
- `VillaCard` gains `coverImageActive?: boolean`; default behavior is the
  current active behavior for every non-home caller, while its preview state
  comes from the near-viewport context.
- `VillaRail` owns `INITIAL_ACTIVE_CARD_COUNT = 4` and marks the index window
  `[selectedIndex, selectedIndex + 3]` active without clearing prior indices.

- [ ] **Step 1: Write failing card and rail-window tests**

Add a `VillaCard` test that renders an inactive card and asserts the cover has
a progressive preview but no full image. Render it again with
`coverImageActive` and assert the full cover is present. Add the equivalent
gallery-card assertion: the main cover obeys `coverImageActive`, while the
existing gallery-thumbnail observer is still responsible for the thumbnail
API request.

Create `villa-rail-image-window.test.tsx` with a mocked `ScrollRail` that
captures `onActiveIndexChange` and renders children. Use six test villas.
Assert all cards start with `coverImageActive` true only for indexes `0..3`.
Invoke the callback with `1`, then `3`, then `0`; assert the activated set is
respectively `{0,1,2,3,4}`, `{0,1,2,3,4,5}`, and unchanged after moving back.

Update the old request-budget assertion from:

```ts
expect(markup).toContain('data-loading="eager"');
```

to an explicit assertion that a twelve-card rail has four full-card image
activations and twelve preview image nodes, while it has no more than one
full-image preload per critical image policy.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```powershell
npm.cmd test -- components/villas/home/__tests__/request-budget.test.tsx components/villas/home/__tests__/villa-rail-image-window.test.tsx components/villas/listing/__tests__/villa-card.test.tsx
```

Expected: FAIL because cards have no cover activation prop and `VillaRail`
does not maintain an activated set.

- [ ] **Step 3: Implement card cover activation**

Add `coverImageActive?: boolean` to `VillaCardProps` with a default of `true`.
Call `const sectionImagesActive = useImageActivation()` unconditionally at the
top of `VillaCard`, then replace the main cover’s `ImageWithSkeleton` use with
`ProgressiveImage`, passing `previewActive={sectionImagesActive}` and
`fullImageActive={coverImageActive && sectionImagesActive}`. Preserve the
current cover `sizes`, quality `60`, links, alt text, placeholder when there
is no cover URL, and `navigationMode` behavior.

Pass the same activation state to `VillaCardGalleryImages` and use it only for
its main selected cover. Do not change the existing `view=card` API request,
gallery image selection, or its 240px observer. Thumbnail images remain lazy
except for the existing currently-visible thumbnail behavior once the card is
active.

- [ ] **Step 4: Implement the monotonic `VillaRail` window**

Make `VillaRail` a client component because it owns the selected snap and
activated-index state. Initialize:

```ts
const INITIAL_ACTIVE_CARD_COUNT = 4;
const [activatedIndexes, setActivatedIndexes] = useState(
  () => new Set(renderedVillas.slice(0, INITIAL_ACTIVE_CARD_COUNT).map((_, index) => index)),
);
```

On `onActiveIndexChange(selectedIndex)`, add every bounded index from
`selectedIndex` through `selectedIndex + INITIAL_ACTIVE_CARD_COUNT - 1` to a
new `Set`; return the old state object if nothing new was added. Pass
`coverImageActive={activatedIndexes.has(index)}` to each card. Do not change
the max of twelve rendered villas, CTA sanitation, document navigation, or
auto-scroll behavior.

- [ ] **Step 5: Run the focused tests to verify they pass**

Run:

```powershell
npm.cmd test -- components/villas/home/__tests__/request-budget.test.tsx components/villas/home/__tests__/villa-rail-image-window.test.tsx components/villas/listing/__tests__/villa-card.test.tsx
```

Expected: PASS.

### Task 4: Activate homepage sections near the viewport and migrate their image consumers

**Files:**
- Modify: `components/villas/home/page.tsx`
- Modify: `components/villas/home/articles-section.tsx`
- Modify: `components/villas/home/customer-review-section.tsx`
- Modify: `components/villas/home/tiktok-lazy-card.tsx`
- Create: `components/villas/home/__tests__/home-image-activation.test.tsx`
- Modify: `components/villas/home/__tests__/page.test.tsx`
- Modify: `components/villas/home/__tests__/tiktok-section.test.tsx`

**Interfaces:**
- Consumes `NearViewportActivation` and `ProgressiveImage` from Task 1.
- Produces a homepage layout where the first rail is immediately active and
  every later image-heavy layout entry inherits `active=false` until the
  wrapper’s `1000px` observer fires.

- [ ] **Step 1: Write failing homepage activation tests**

Render a homepage layout containing two rails, TikTok, customer reviews, and
articles. Assert the first `VillaRail` is not inside
`data-near-viewport-activation`, while each later image-heavy section is.
Stub `IntersectionObserver`, trigger each boundary, and assert its nested
`ProgressiveImage` exposes neither preview nor full image before activation,
then exposes the preview and permitted full images after activation.

Add a targeted TikTok test: an inactive poster keeps its preview/gradient and
does not request the full thumbnail; activation enables its full thumbnail;
clicking still mounts only one iframe. Add an article/review test that their
existing links/buttons and image alt labels remain present while their full
images are inactive.

- [ ] **Step 2: Run the homepage activation tests to verify they fail**

Run:

```powershell
npm.cmd test -- components/villas/home/__tests__/home-image-activation.test.tsx components/villas/home/__tests__/page.test.tsx components/villas/home/__tests__/tiktok-section.test.tsx
```

Expected: FAIL because `HomePageContent` has no near-viewport boundaries and
these image consumers render their existing image components directly.

- [ ] **Step 3: Add homepage boundaries in saved-layout order**

In `HomePageContent`, preserve the existing saved `layout.map()` ordering.
Wrap each non-first rail and every fixed image-heavy item (`tiktok`,
`customer_reviews`, and `articles`) in:

```tsx
<NearViewportActivation initiallyActive={false} rootMargin="1000px">
  {section}
</NearViewportActivation>
```

Do not wrap `why_choose`, `faq`, or `contact` solely for this feature. Keep
the first enabled rail immediately active even if enabled fixed sections appear
before it in a customized layout. If no rail exists, leave the hero critical
and apply the boundary to all eligible later sections.

- [ ] **Step 4: Migrate article, review, and TikTok poster images**

Replace homepage-only image uses in the three target components with
`ProgressiveImage`, setting both preview and full image active only when
`useImageActivation()` is true. Preserve all existing dimensions, `sizes`,
quality values, `referrerPolicy`, click behavior, lightbox behavior, TikTok
oEmbed behavior, and lazy iframe-on-play behavior.

Do not apply this migration to the review lightbox: it is user-triggered and
must remain an eager full-resolution image after the click.

- [ ] **Step 5: Run the homepage activation tests to verify they pass**

Run:

```powershell
npm.cmd test -- components/villas/home/__tests__/home-image-activation.test.tsx components/villas/home/__tests__/page.test.tsx components/villas/home/__tests__/tiktok-section.test.tsx
```

Expected: PASS.

### Task 5: Make Hero selection progressive without changing carousel controls

**Files:**
- Modify: `components/villas/home/hero-carousel.tsx`
- Modify: `components/villas/home/__tests__/hero-section.test.tsx`

**Interfaces:**
- Consumes `ProgressiveImage` from Task 1.
- Produces the same HeroCarousel props and controls, with slide 0 initially
  active and future slide full images activated monotonically after selection.

- [ ] **Step 1: Write the failing Hero tests**

Extend the Hero test mock so `next/image` exposes `data-progressive-preview`,
`data-progressive-full`, and preload state. For three slides, assert initial
markup contains three previews, exactly one full image, and exactly one full
preload. Invoke the mocked Embla `select` listener after changing
`selectedScrollSnap()` to `1`; assert slide 1 gains a full image, slide 0
remains active, and slides 2 remains preview-only. Retain current tests for
carousel controls, keyboard handling, and the one-image fallback.

- [ ] **Step 2: Run the Hero tests to verify they fail**

Run:

```powershell
npm.cmd test -- components/villas/home/__tests__/hero-section.test.tsx
```

Expected: FAIL because HeroCarousel renders `ImageWithSkeleton` for every
slide and only uses direct preload flags for the first slide.

- [ ] **Step 3: Implement monotonic Hero slide activation**

Initialize an activated slide-index set containing `0`. In the existing Embla
selection callback, add `selectedScrollSnap()` to that set. Render every slide
with `ProgressiveImage`, pass `active={activatedSlides.has(index)}`, and pass
`fullImagePreload={index === 0}` only for slide 0. Keep the aspect ratio,
`sizes="100vw"`, quality `75`, current aria labels, buttons, and selected-dot
state unchanged.

- [ ] **Step 4: Run the Hero tests to verify they pass**

Run:

```powershell
npm.cmd test -- components/villas/home/__tests__/hero-section.test.tsx
```

Expected: PASS.

### Task 6: Update structural documentation and verify the full change

**Files:**
- Modify: `docs/ai/structure.html`
- Modify: `tests/production-smoke.spec.ts`
- Modify: any focused tests from Tasks 1-5 needed to preserve current behavior

**Interfaces:**
- Consumes all finished homepage image behavior.
- Produces repository guidance and a stable production smoke request-budget
  regression check.

- [ ] **Step 1: Write the failing production smoke assertion**

In the existing public-home smoke test, collect successful initial document
image requests before user interaction. Assert that the homepage does not
request cover full-image URLs for more than the first four villa cards before
the test performs a rail interaction. Do not assert an elapsed-time threshold;
network timing is non-deterministic in CI.

Use URL pathname/query parsing rather than text matching, so the assertion
continues to work with the existing custom loader and proxy query parameters.

- [ ] **Step 2: Run the focused smoke test to verify it fails**

Run the production smoke command after building its production server:

```powershell
npm.cmd test:e2e
```

Expected: FAIL at the new homepage image-request assertion because current
homepage rails eagerly request all card covers.

- [ ] **Step 3: Document the implemented ownership**

Update the homepage row in `docs/ai/structure.html` to name the progressive
image primitive, the critical hero/first-rail policy, the four-card rolling
window, and the 1000px activation margin. Add the focused unit tests and the
production browser request-budget check to the recommended verification text.

- [ ] **Step 4: Run targeted regression tests**

Run:

```powershell
npm.cmd test -- components/ui/__tests__/progressive-image.test.tsx components/ui/__tests__/near-viewport-activation.test.tsx components/ui/__tests__/scroll-rail-embla.test.tsx components/villas/home/__tests__/request-budget.test.tsx components/villas/home/__tests__/villa-rail-image-window.test.tsx components/villas/home/__tests__/home-image-activation.test.tsx components/villas/home/__tests__/hero-section.test.tsx components/villas/home/__tests__/page.test.tsx components/villas/home/__tests__/tiktok-section.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run lint and production build**

Run:

```powershell
npm.cmd run lint
npm.cmd run build
```

Expected: both commands exit with code 0.

- [ ] **Step 6: Run production browser verification**

Run the existing production smoke server and Playwright suite, then manually
inspect the homepage at mobile and desktop widths with browser cache disabled:

```powershell
npm.cmd test:e2e
```

Expected: Hero preview appears before its full image completes; initial rail
only starts four full covers; normal rail swipes reveal already-started next
covers; and non-critical homepage sections begin their images inside the
1000px margin without unexpected `_rsc` or `/_next/image` requests.

## Plan Self-Review

- Spec coverage: Tasks 1 and 5 cover same-image 64px previews, preview/full
  error retention, and Hero priority. Tasks 2 and 3 cover four-card rolling
  rail activation. Task 4 covers the 1000px section boundary and all named
  homepage image-heavy sections. Task 6 covers documentation, mobile/desktop
  browser verification, request budget, lint, and build.
- Placeholder scan: this document contains no unfinished implementation steps;
  every task defines its inputs, output interfaces, test command, expected
  result, and implementation direction.
- Type consistency: `ProgressiveImage`, `NearViewportActivation`,
  `useImageActivation`, `onActiveIndexChange`, and `coverImageActive` are
  defined before their consuming tasks and use the same names throughout.
