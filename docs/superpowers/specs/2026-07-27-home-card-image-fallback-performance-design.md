# Home Card Image Fallback and Loading Design

**Date:** 2026-07-27  
**Status:** Confirmed design, pending implementation plan

## Goal

Keep up to ten scrollable images on every homepage villa card while:

- filling incomplete manual image selections from system-ranked images;
- allowing a two-image card to use the gallery slider;
- avoiding unnecessary Supabase rows and browser image downloads; and
- keeping the private image manifest and its Bearer token server-only.

## Current Problems

The card selector currently treats any non-empty `cover_select` result as a
complete fallback. If it contains only one or two usable images, the selector
does not append default images. The gallery component also requires at least
three images, so a card with two usable images falls back to a single cover.

The homepage also resolves card images for every villa returned by every
section, even though each rail renders at most twelve cards. The current batch
read can load all image rows for those villas before selecting at most ten per
card. Finally, the browser receives thumbnail image elements before a card is
near the viewport.

## Selection Contract

The server builds one ordered, deduplicated list per villa using this priority:

1. uploaded cover override;
2. valid admin-selected images in saved order;
3. valid `cover_select` images in ascending configured order;
4. `outside` images ordered by image id;
5. `inside` images ordered by image id;
6. every other valid non-cover image ordered by image id.

Each later source fills remaining positions instead of replacing an incomplete
earlier source. Old cover rows are excluded when an uploaded cover override is
active. Duplicate image ids and duplicate normalized URLs are removed.

The final list contains at most ten images:

- zero images: render the existing no-image placeholder;
- one image: render a single image without gallery controls;
- two through ten images: render the gallery slider and thumbnail rail.

An invalid or unavailable configured image does not consume a position.

## Server Data Flow

The homepage collects ids only from cards that can render:

- at most twelve villas from each enabled rail;
- duplicate villa ids across rails are queried once;
- invalid villa ids are removed before querying;
- each database request contains at most 48 villa ids.

A Supabase RPC joins active card configuration, configured image items, and
villa image rows, then returns the final ordered selection rather than every
image row for every villa. It returns no more than ten selections per villa.
An uploaded cover override is returned as the special cover selection already
represented publicly by the existing per-villa cover proxy path.

The RPC is introduced through a source-controlled migration plus a minimal
idempotent patch suitable for existing online projects. It validates the input
array, caps request size, performs no writes, and receives only the grants
needed by the existing publishable-key server client.

The resolved result continues to use the shared twelve-hour villa-card-image
cache and existing villa/card-image cache tags. Page consumers receive only
same-origin image-id proxy URLs.

If the bounded RPC is unavailable during a staged deployment, the loader
degrades to the existing bounded batch reader for compatibility. A read
failure must not fail the homepage; cards retain their listing cover or
placeholder.

## Browser Loading

The server payload may contain up to ten same-origin URLs for a card, but the
gallery component does not create thumbnail image elements until the card is
within the `IntersectionObserver` root margin `600px 0px`.

Before activation:

- the listing cover remains visible;
- no thumbnail image elements are mounted;
- no private manifest request occurs.

After activation:

- all available two-to-ten gallery images become selectable;
- the current arrow and thumbnail interactions remain unchanged;
- thumbnail images retain lazy loading;
- the selected full-size card image loads when selected.

If `IntersectionObserver` is unavailable, the gallery activates immediately so
functionality is preserved.

## Security and Cache Boundaries

- `IMAGE_INTERNAL_API_TOKEN` remains server-only.
- The browser never calls query-free `/api/villas/:id/images` or
  `/api/villas/:id/images?view=card`.
- Public browser requests remain limited to same-origin image-id proxy and
  download routes.
- Existing Worker image-byte caching remains active.
- No new public image-manifest endpoint or browser token is introduced.

## Error Handling

- Missing configured images are skipped and filled from later sources.
- Fewer than ten real images is valid and does not produce an error.
- A villa with two real images still receives gallery controls.
- A villa with one real image receives no inactive or misleading controls.
- RPC or image-metadata failures degrade per batch to listing covers without
  failing the homepage.
- Failed browser image bytes continue through the existing image-error path.

## Verification

Focused tests must prove:

1. one configured image is filled from recommended and default sources;
2. incomplete recommended images are filled from default and remaining images;
3. uploaded covers stay first and suppress old cover rows;
4. duplicate ids and URLs are removed;
5. selection stops at ten images;
6. one image renders without gallery controls;
7. two images render slider and thumbnails;
8. offscreen cards do not mount thumbnail images;
9. entering the viewport activates all available thumbnails;
10. homepage lookup ids are capped to twelve per rail and deduplicated;
11. database batches never exceed 48 villa ids;
12. the RPC returns no more than ten final rows per villa;
13. RPC failure degrades without failing the homepage; and
14. production components contain no browser private-manifest fetch.

Run targeted tests during implementation, followed by the full Vitest suite,
ESLint, the Next.js production build, and a production browser network check
for homepage image/API request counts.

## Out of Scope

- Reducing the maximum below ten images.
- Changing homepage rail layout or card count.
- Making the private manifest public.
- Adding signed browser manifest tokens.
- Changing admin image-management UX.
