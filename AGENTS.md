<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Guide

## Stack

- Next.js `16.2.6` App Router with React `19.2.4`.
- Tailwind CSS v4.
- Vitest for unit tests.
- Supabase client is used for villa image data.
- External villa APIs are used for listings and detail data.

## Required Commands

- `npm.cmd run lint` checks ESLint.
- `npm.cmd run build` checks the production Next.js build.
- `npm.cmd test` runs the full Vitest suite.
- For targeted tests, use `npm.cmd test -- <path>`.

Run lint and build before saying frontend or Next.js work is complete. Run targeted tests when touching shared filtering, normalization, pricing, image, or detail helpers.

## Environment

Use `.env` locally and keep secrets out of git.

Required keys:

- `DEVILLE_BEARER_TOKEN` for `https://deville-central.com/api/getAccommodation.php?hid={house_id}`.
- `SUPABASE_PUBLISHABLE_KEY` for public Supabase image reads.
- `NEXT_PUBLIC_SITE_URL` for production canonical URLs and sitemap host.

Never print real env values in responses or logs.

## App Structure

- `app/page.tsx` imports the home implementation from `components/villas/home/page`.
- `app/search/page.tsx` imports the search implementation from `components/villas/search/page`.
- `app/villas/[id]/page.tsx` imports the detail implementation from `components/villas/detail/page`.
- Keep route files focused on metadata, server data loading, JSON-LD, and passing props.
- Keep UI components inside their feature folders:
  - `components/villas/home`
  - `components/villas/search`
  - `components/villas/detail`
  - `components/villas/listing`
  - `components/layout`

Avoid adding top-level re-export wrapper files under `components/villas`; import from the real feature folder instead.

## Data Rules

- Main house listings come from `https://www.devillegroups.com/api/json/getHouse_deville.json`.
- Listing cover images use `https://devillegroups.com/imgs/profile_imgs_large/{img_name}`.
- Detail data comes from the Deville Central accommodation API and requires bearer token.
- Detail gallery images use Supabase image rows where `images.property_id` matches `h_id` / `house_id`.
- Public image URLs are built from `image_name` using the configured image host.

## UI Rules

- Reuse shared listing cards from `components/villas/listing` for home, search, and recommendations.
- Reuse `VillaRail` for horizontal villa sections.
- Keep mobile bottom contact actions backed by `lib/site-contact.ts`.
- Keep contact icons in `components/layout/contact-icons.tsx`.
- Do not reintroduce mock badges on actions that already work.
- Preserve the Prompt font setup.

## Search Rules

- Search supports filters for zone, guests, bedrooms, amenities, max price, house id, sort order, and near-sea URL param.
- The near-sea toggle button is intentionally not shown on the search page, but `nearSea=1` must still work for links from home sections.
- Search results should remain paginated/incrementally displayed instead of rendering all houses at once.

## Pricing

Use the shared villa price commission logic in `lib`; do not calculate displayed villa prices ad hoc in components.

## Git

- Do not commit unless the user explicitly asks.
- Preserve user changes in the working tree.
- Do not use destructive git commands unless explicitly requested.
