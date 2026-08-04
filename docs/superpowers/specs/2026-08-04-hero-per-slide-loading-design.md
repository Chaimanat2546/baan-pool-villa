# Homepage Image Loading Skeleton Design

## Goal

Show image-area skeletons in the homepage Hero and horizontal rails until each image has loaded.

## Scope

- Each `ImageWithSkeleton` wrapper tracks its own load, error, and source-change completion state; `HeroCarousel` does not track loaded sources.
- Render a non-interactive skeleton in every Hero slide image area that has not loaded, keeping the image hidden until its own completion event or cached-image completion check.
- Apply the same loading treatment to homepage Villa, article, and TikTok rail images.
- Dismiss the skeleton when its image emits `onLoad` or `onError`; a source change returns that wrapper to loading unless the replacement is already cached.
- Preserve Hero dimensions, `object-fill`, controls, autoplay, preload, and image quality.
- Exception: `VillaCard` and `VillaCardGalleryImages` are shared listing-card components, so their image skeleton behavior applies in every context where those components render. Do not alter other galleries or listing renderers.
- Add focused tests for initial skeleton rendering and load completion.

## Expected result

The initial Hero, later Hero slides, and images in the three homepage rails show a stable skeleton instead of an empty image frame while their image bytes load. Once loaded, the overlay stops obscuring that image.

## Verification

Run focused Hero and rail tests, lint, build, and inspect initial and subsequent Hero slide loading plus each rail at desktop and mobile widths.
