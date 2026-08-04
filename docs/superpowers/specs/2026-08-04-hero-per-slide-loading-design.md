# Homepage Image Loading Skeleton Design

## Goal

Show shimmer skeletons in the homepage Hero and horizontal rails until each image has loaded.

## Scope

- Track loaded Hero image sources inside `HeroCarousel`.
- Render a non-interactive shimmer overlay for every Hero slide image that has not loaded.
- Apply the same loading treatment to homepage Villa, article, and TikTok rail images.
- Fade each overlay away when its image emits `onLoad`.
- Preserve Hero dimensions, `object-fill`, controls, autoplay, preload, and image quality.
- Do not alter galleries, listing grids, or non-homepage card behavior.
- Add focused tests for initial skeleton rendering and load completion.

## Expected result

The initial Hero, later Hero slides, and images in the three homepage rails show a stable skeleton instead of an empty image frame while their image bytes load. Once loaded, the overlay stops obscuring that image.

## Verification

Run focused Hero and rail tests, lint, build, and inspect initial and subsequent Hero slide loading plus each rail at desktop and mobile widths.
