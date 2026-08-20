# Homepage Progressive Image Loading Design

**Date:** 2026-08-20  
**Status:** Proposed and user-approved design; implementation pending review

## Goal

Make the homepage feel immediate for visitors without a browser cache: show a
recognizable hero image immediately, keep the hero search responsive, and make
rail cards appear ready as a visitor scrolls or swipes. The page must not start
downloading every homepage image at once.

This design targets the homepage only. It does not change image behavior on
search, guide, or villa-detail routes.

## Current State and Problem

- The first hero image is preloaded, but it displays a skeleton while the image
  loads.
- Homepage villa rails pass `imageLoading="eager"` to every rendered card.
  With up to twelve cards per rail, this starts many competing image requests
  on initial navigation.
- Gallery cards already use an IntersectionObserver with a 240px root margin to
  load gallery thumbnails. That behavior is separate from cover-image loading
  and remains separate in this design.
- Public image proxies and the custom loader already support a 64px transformed
  image at quality 60, and their responses use the existing shared image cache.

## User-Approved Product Decisions

1. A visitor swiping a rail at a normal, card-by-card pace should see the next
   cover image without waiting for a load state.
2. The initial rail should load four card cover images immediately; later
   cards are loaded in a rolling lookahead window.
3. Homepage sections below the initial viewport should activate when they are
   within 1,000px of the viewport.
4. Before a full image is available, show a blurred low-resolution version of
   the same image rather than a generic skeleton.
5. The first release uses a 64px transformed request from the existing image
   source. It does not add a database column, migration, upload-time blur-data
   generation, or asset backfill.

## Architecture

### Progressive image primitive

Introduce a shared client-side progressive-image primitive under `components/ui`.
It receives a preview source, a full-resolution source, alt text, sizing, a
preview activation state, and a full-image activation state.

1. The preview source is the same validated image origin transformed to 64px
   wide at quality 60 and styled with a CSS blur.
2. Neither source is requested until the caller activates its preview state;
   the full-resolution source additionally waits for full-image activation.
3. Once the full-resolution image loads, it fades over the preview.
4. If the preview fails, preserve the established fixed-size neutral fallback.
5. If the full image fails, retain the preview instead of returning to a
   skeleton or empty space.

The primitive must retain the current public image loader/proxy validation,
transform allowlists, and cache policy. It must not add image hosts or accept
unvalidated URLs.

### Hero behavior

- The first hero slide activates its preview and full-resolution image on the
  initial render, with the full image as the sole image preload/priority.
- Other hero slides may display a preview but do not request the full image at
  initial load. They activate after an explicit slide interaction or when they
  become the imminent slide.
- The hero always reserves its existing dimensions, preventing layout shift.

### Rail behavior

Add an optional active-index callback to `ScrollRail`. It reports the selected
Embla snap without changing existing callers.

`VillaRail` uses the callback to maintain a monotonic activated-cover set:

| Rail position | Newly activated full images |
| --- | --- |
| Initial render | Cards 1-4 |
| Move to card 2 | Card 5 |
| Move to card 3 | Card 6 |
| Continue moving | Next card that extends the four-card window |

Cards that have activated remain active while the page is open, so reverse
swipes do not repeat work. On desktop, the initial window may be raised only
when necessary to cover every simultaneously visible card; the fixed baseline
is four cards.

Gallery thumbnail fetching remains a separate interaction-near-card concern.
The rail cover strategy applies to the main card cover only.

### Below-the-fold homepage sections

Introduce a homepage near-viewport activation wrapper. It observes each
non-critical homepage section with `rootMargin: "1000px"`.

- Before activation, the section has stable reserved geometry and a neutral
  fallback, but makes no image request.
- On first intersection inside the 1,000px margin, the section permanently
  activates its preview images, initial rail window, and full images.
- The observer disconnects after activation.
- If IntersectionObserver is unavailable, activate as a safe progressive
  enhancement fallback.

The first rail remains critical content and is active immediately. Subsequent
rails and image-heavy homepage sections (including reviews, TikTok posters,
and article covers) use near-viewport activation. SEO-relevant server markup,
semantic text, links, and alt text remain available in the rendered route;
this design only controls client image request timing.

## Failure Handling and Accessibility

- Fixed image containers remain in place for preview, loading, and error
  states, preventing CLS.
- A failed preview falls back to the current neutral placeholder.
- A failed full image leaves the preview visible.
- Reduced-motion users receive the final image without a decorative fade.
- Existing image alt text, keyboard carousel controls, and accessible rail
  button labels remain unchanged.

## Planned File Ownership

- `components/ui/`: progressive-image primitive and homepage near-viewport
  helper.
- `components/ui/image-with-skeleton.tsx`: compose or migrate safely to the
  new preview/fallback behavior without changing unrelated callers.
- `components/ui/scroll-rail.tsx`: optional active-index reporting.
- `components/villas/home/hero-carousel.tsx`: critical hero activation.
- `components/villas/home/villa-rail.tsx`: rolling card-cover activation.
- `components/villas/listing/villa-card.tsx`: accept the card cover activation
  strategy.
- Existing focused component tests plus homepage production smoke coverage.
- `docs/ai/structure.html`: document the homepage image-loading ownership and
  verification guidance after implementation.

## Verification

Automated tests will cover:

1. Rail activation starts with cards 1-4 and extends as the selected snap
   advances.
2. Rail cards do not deactivate after a reverse swipe.
3. The 1,000px observer activates exactly once and has a no-observer fallback.
4. Hero initial markup prioritizes only the first full-resolution slide.
5. Preview and full-image error paths preserve a non-empty, fixed-size visual
   fallback.

Manual production-browser verification will cover mobile and desktop cold
loads:

1. Hero preview appears immediately and its full image is among the first
   image requests.
2. Initial navigation does not request all homepage card images together.
3. Swiping normally through the first rail does not expose a blank/skeleton
   card in the configured rolling window.
4. A section within 1,000px begins its full-image requests before entering the
   viewport.
5. Public navigation makes no unexpected `_rsc` or `/_next/image` requests,
   consistent with existing project checks.

Lint, targeted tests, and a production build are required before completion.

## Non-Goals

- No database migrations or `blurDataURL` persistence.
- No changes to image-host allowlists, cache durations, or public API contracts.
- No homepage visual redesign.
- No guarantee that a full-resolution image arrives instantly on an extremely
  slow network; the same-image preview is the durable no-blank fallback.
