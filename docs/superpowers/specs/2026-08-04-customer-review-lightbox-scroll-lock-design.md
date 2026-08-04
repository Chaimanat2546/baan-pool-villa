# Customer Review Lightbox Scroll Lock Design

## Goal

Prevent the homepage from scrolling while a customer-review lightbox is open.

## Scope

- Reuse `components/villas/detail/use-locked-body-scroll.ts`.
- Enable its lock while the homepage review lightbox is rendered.
- Preserve modal navigation, image display, close behavior, and layout.
- Add a focused test that verifies the body lock is added on open and removed on close.

## Expected result

Opening a review image prevents background page scrolling. Closing the lightbox, or unmounting it, restores scrolling.

## Verification

Run the focused customer-review test, lint, build, and inspect opening/closing the modal on desktop and mobile.
