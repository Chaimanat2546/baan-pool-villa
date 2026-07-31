# Hero carousel design

## Goal

Allow admins to manage one to ten Hero images at `/admin/settings/hero`, with a separate alt text and order for each image. Render them as an accessible automatic carousel on the public homepage.

## Admin experience

- The editor displays a sortable list of up to ten slides.
- Each slide has an image upload/preview, a required separate alt-text field, and a remove action.
- Admins add slides until the ten-slide limit; at least one slide must remain.
- Saving persists the complete ordered snapshot. The former single Hero image becomes the first slide for existing settings.

## Public carousel

- The first saved slide is initially visible.
- If two or more slides exist, show previous/next controls and dot navigation.
- Advance automatically every five seconds; pause while the user interacts or focuses within the carousel, then resume after interaction ends.
- One slide renders like the existing Hero and hides carousel controls.
- Every rendered image uses that slide's saved alt text. Controls have Thai accessible names and keyboard operation.

## Data and safety

- Store at most ten validated Hero image records, each with path, public URL, alt text, and display order.
- Preserve the existing upload MIME, extension, size validation, conservative retained-asset cleanup, admin authorization, and settings cache invalidation.
- Update TypeScript types, defaults, normalization, settings API, admin form, public client payload, and tests together. Add an idempotent Supabase migration for the new persistent representation.

## Verification

Test validation, migration-compatible fallback from the legacy single image, admin add/reorder/remove/payload flow, and carousel controls/autoplay behaviour. Run focused tests, lint, build, and visually inspect `/admin/settings/hero` and `/` at mobile and desktop widths.
