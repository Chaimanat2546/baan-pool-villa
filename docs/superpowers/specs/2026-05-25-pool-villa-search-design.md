# Pool Villa Search Design

Date: 2026-05-25
Project: Baan Pool Villa

## Goal

Build a pool villa listing website with a premium single-bar search experience, house cards, and detail pages for each villa. The first implementation will support search by location, guest count, bedroom count, amenity selection, and maximum price.

The site will use the Deville house list API as the source of truth for all searchable listings:

`https://www.devillegroups.com/api/json/getHouse_deville.json`

## Approved Direction

The search UI should closely follow the provided reference image:

- A single horizontal search bar on desktop.
- White rounded container with a deep teal shadow.
- Icon-led controls for location, guest count, bedrooms, amenities, and search.
- Floating dropdown menus for location and amenities.
- Maximum price shown with a slider and formatted baht value.
- A deep green search button.
- Responsive behavior that stacks controls cleanly on mobile.

The route for house detail pages is:

`/villas/[id]`

Example:

`/villas/9`

## Architecture

Use an API-proxy architecture. The frontend will call only internal Next.js route handlers. External APIs and private tokens stay behind the server boundary.

Internal routes:

- `GET /api/houses`
- `GET /api/villas/[id]`
- `GET /api/villas/[id]/images`

External sources:

- House list: `https://www.devillegroups.com/api/json/getHouse_deville.json`
- House detail: `https://deville-central.com/api/getAccommodation.php?hid={house_id}`
- Supabase project: `https://rqizfiayvcbozlzuvbok.supabase.co`
- Supabase table: `images`

Environment variables:

- `DEVILLE_BEARER_TOKEN`: private server-only token for the house detail API.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key for read access to public image rows.

Even though the Supabase key is publishable, image queries will run through internal route handlers in the first implementation so the frontend has one consistent data access surface.

## Data Model

Normalize the list API response before returning data from `/api/houses`.

Raw list fields include:

- `h_id`
- `h_zone`
- `h_bedroom`
- `h_toilet`
- `h_farsea`
- `price`
- `people`
- `img_name`
- Amenity flags such as `wifi`, `grill`, `pet`, `snooker`, `discotech`, `fancyring`, `tabletennis`, `slider`, `billard`, `swimming_kid`, `karaoke`, `airhockey`, `jacuzzi`, and `bath`
- Pool type in `swim`

Normalized listing fields:

- `id`: string from `h_id`
- `zone`: string from `h_zone`
- `bedrooms`: number from `h_bedroom`
- `bathrooms`: number from `h_toilet`
- `distanceToSea`: string from `h_farsea`
- `price`: number from `price`
- `people`: number from `people`
- `coverImage`: URL from `https://devillegroups.com/imgs/profile_imgs_large/{img_name}`
- `amenities`: normalized amenity keys with Thai labels
- `poolType`: value from `swim`

If `img_name` is missing, return `coverImage: null` and let the card render a designed placeholder.

Supabase image rows use:

- `images.property_id` as the same identifier as `h_id` / `house_id`
- `cover_select` to prioritize cover images
- `image_url`, `image_name`, and `caption` for gallery display

## Pages And Components

### Search Page

The search page will load all houses through `/api/houses`, then apply interactive filtering on the client.

Main components:

- `SearchBar`: the premium search surface modeled after the reference image.
- `LocationSelect`: searchable dropdown for locations.
- `GuestInput`: numeric control for minimum guest count.
- `BedroomInput`: numeric control for minimum bedroom count.
- `AmenitySelect`: multi-select dropdown for amenity filters.
- `PriceSlider`: maximum price filter with baht formatting.
- `VillaCardGrid`: responsive listing grid.
- `VillaCard`: cover image, price, guest count, bedroom count, bathroom count, distance to sea, and key amenity badges.

Filter behavior:

- Location matches exact normalized zone.
- Guests means house `people >= selectedGuests`.
- Bedrooms means house `bedrooms >= selectedBedrooms`.
- Maximum price means house `price <= selectedMaxPrice`.
- Amenities require every selected amenity to be present.

### Detail Page

`/villas/[id]` will show detailed content for one villa.

The page will call:

- `/api/villas/[id]` for combined listing/detail information.
- `/api/villas/[id]/images` for gallery images.

Detail layout:

- Hero gallery with prioritized cover image.
- Summary block with price, guest count, bedrooms, bathrooms, location, and distance to sea.
- Amenities section.
- Detail content from the Deville accommodation API, displayed only for fields that are present.
- Contact or booking call-to-action area.

If `DEVILLE_BEARER_TOKEN` is missing or the detail API fails, the page still renders the list-derived summary and image gallery, with a short unavailable-state message for extended details.

## Route Handler Behavior

### `GET /api/houses`

Fetch the Deville house list API, normalize every item, and return JSON.

Failure behavior:

- Return `502` with a clear JSON error if the external API fails.
- Return an empty `items` array only when the external API returns a valid empty list.

### `GET /api/villas/[id]`

Fetch the selected villa detail from Deville Central with:

`Authorization: Bearer ${DEVILLE_BEARER_TOKEN}`

Also include the matching normalized listing from `/api/houses` data so the detail page can render basic information even when the detail API is unavailable.

Failure behavior:

- If token is missing, return listing data and `detail: null` with a `detailStatus` explaining `missing_token`.
- If the detail API fails, return listing data and `detail: null` with `detailStatus: "unavailable"`.
- If no listing exists for the id, return `404`.

### `GET /api/villas/[id]/images`

Query Supabase `images` where `property_id` equals the route id.

Sort order:

1. `cover_select` descending.
2. `id` ascending.

Return only public display fields:

- `id`
- `imageUrl`
- `imageName`
- `caption`
- `isCover`
- `zone`

Failure behavior:

- Return `502` with a clear JSON error if Supabase cannot be queried.
- Return an empty image list if the villa has no image rows.

## Image Handling

Listing cards use profile cover images from:

`https://devillegroups.com/imgs/profile_imgs_large/{img_name}`

Detail gallery uses Supabase image rows. If Supabase rows are empty, fall back to the list profile cover image.

Next image configuration should allow these hosts:

- `devillegroups.com`
- `www.devillegroups.com`
- `rqizfiayvcbozlzuvbok.supabase.co`

## Error And Loading States

Search page:

- Loading skeleton for search results.
- Empty state when filters return no matches.
- Error state when `/api/houses` fails.

Detail page:

- Gallery skeleton while images load.
- Designed placeholder when no images exist.
- Detail unavailable message when the Bearer token is missing or the detail API fails.
- 404 state when the villa id does not exist in the house list.

## Testing And Verification

Implementation should be verified with:

- TypeScript build.
- ESLint.
- Route handler checks for `/api/houses`, `/api/villas/9`, and `/api/villas/9/images`.
- Browser verification of the search page on desktop and mobile widths.
- Browser verification that filtering by guests, bedrooms, amenities, and max price updates the result list.
- Browser verification that `/villas/9` renders even when `DEVILLE_BEARER_TOKEN` is not configured.

## Scope Boundaries

Included in the first build:

- Search page.
- `/villas/[id]` detail page.
- API proxy routes.
- Supabase image query.
- Env-based token handling.
- Search UI matching the provided reference.

Deferred:

- Booking flow.
- Admin editing.
- Saved favorites.
- Availability calendar.
- Payment integration.
- Multi-location URL structures.
