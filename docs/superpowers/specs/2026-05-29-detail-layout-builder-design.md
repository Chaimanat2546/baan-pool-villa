# Detail Layout Builder V1 Design

## Status

Approved direction: use the detailed Row + Column Builder example as the default layout for villa detail pages.

This spec covers the design only. Implementation starts after this spec is reviewed and approved.

## Goal

Add an admin CMS setting that controls the shared layout of every villa detail page. Admins can add rows, choose 1, 2, or 3 columns, choose ratio presets for 2-column rows, and place approved content blocks into each slot.

The public detail page must keep the most important booking information predictable: Gallery and villa intro stay locked at the top for every villa.

## Non-Goals

- No per-villa layout override in V1.
- No freeform HTML or custom CSS input.
- No pixel-level spacing, width, height, or margin controls.
- No moving Gallery or villa intro below other sections.
- No new editorial CMS content blocks beyond data already available from the current villa data sources.
- No exposure of internal/private API fields such as `member_service` or bank/account data from villa detail APIs.

## Public Page Layout

The public villa detail page renders in this order:

1. Locked Gallery row.
2. Locked intro row with villa name, price, bedrooms, bathrooms, guest capacity, zone, and sea distance where available.
3. CMS-controlled layout rows.

Default V1 rows:

| Row | Columns | Ratio | Blocks |
| --- | --- | --- | --- |
| 1 | 2 | 70/30 | Details / Booking contact |
| 2 | 2 | 50/50 | Bedrooms / Pool |
| 3 | 3 | Equal | Kitchen / Amenities / Categorized images |
| 4 | 2 | 70/30 | Costs and promotions / Rules and pet policy |
| 5 | 2 | 60/40 | Map and nearby places / Review videos |
| 6 | 1 | Full | Recommended villas |

On mobile, every row becomes one column. V1 mobile order is left-to-right desktop slot order.

## Admin UX

The admin page uses the same CMS pattern as other admin tools:

- Left panel: Block Library.
- Center panel: Layout Canvas.
- Right panel: selected row or block settings.

Block Library contains only approved blocks. Admins drag blocks into slots or use accessible move/add controls. Each block can be removed from the canvas unless it is part of the locked top section. Booking contact is movable and can be disabled.

Layout Canvas shows:

- Locked Gallery row.
- Locked intro row.
- Editable rows below the locked top.
- Row controls: move up, move down, duplicate, hide, delete.
- Slot controls: choose block, remove block, move block between slots.

Selected Row Settings include:

- Column count: 1, 2, or 3.
- Ratio for 2-column rows: `50/50`, `60/40`, `70/30`, `40/60`, `30/70`.
- Mobile order: left-to-right.
- Visibility: enabled or hidden.
- Empty-data behavior: hide empty block; hide whole row if every block in that row is empty.

Selected Block Settings include:

- Display title, using a Thai human label by default.
- Enabled or disabled.
- Hide when empty.
- Block-specific supported settings, such as mobile placement behavior for Booking contact.

## Blocks And Data Sources

| Block | Source | Empty Data Behavior |
| --- | --- | --- |
| Gallery | Supabase image rows where `images.property_id` matches villa id; listing cover fallback | Locked; use cover fallback if Supabase images are empty |
| Intro | Listing API, detail facts, shared price commission logic | Locked; render available facts only |
| Details | Detail API parsed text such as `h_moredetail` | Hide block when empty |
| Bedrooms | Detail API bedroom detail | Hide block when empty |
| Pool | Detail API pool detail and normalized pool type | Hide block when empty |
| Kitchen | Detail API kitchen/ware detail | Hide block when empty |
| Amenities | Normalized amenities from listing/detail helpers | Hide missing amenities; hide block if none remain |
| Categorized images | Supabase image categories such as bedroom, pool, kitchen, outside, inside, review | Hide categories with no images; hide block if no usable images |
| Costs and promotions | Deposit, extra-person fee, additional costs, separated day pricing, notes | Hide empty sub-sections; hide block if all are empty |
| Rules and pet policy | House rules and pet details | Hide empty sub-sections; hide block if all are empty |
| Map and nearby places | Location, map URL, sea distance, `travel[]` nearby places | Show available location pieces; hide block if no useful location data exists |
| Review videos | Normalized video URLs from detail data | Hide block when empty |
| Booking contact | Shared site contact settings and villa price/facts | Movable and disableable |
| Recommended villas | Existing recommendation data and shared listing cards | Hide block when empty |

## Stored Layout Shape

The CMS stores a versioned JSON layout. The exact database shape can follow existing site settings patterns, but the saved value should be equivalent to:

```json
{
  "version": 1,
  "lockedTop": ["gallery", "intro"],
  "rows": [
    {
      "id": "row_about_booking",
      "columns": 2,
      "ratio": "70/30",
      "mobileOrder": "left-to-right",
      "enabled": true,
      "blocks": [
        { "type": "details", "title": "รายละเอียดบ้านพัก", "enabled": true, "hideWhenEmpty": true },
        { "type": "booking_contact", "title": "จอง / ติดต่อ", "enabled": true, "hideWhenEmpty": false }
      ]
    }
  ]
}
```

Validation rules:

- `version` must be `1`.
- `rows` must be an array.
- `columns` must be `1`, `2`, or `3`.
- 2-column rows must use an allowed ratio preset.
- 1-column and 3-column rows must not store a 2-column ratio.
- Every block type must be in the allowlist.
- A row cannot contain more blocks than columns.
- Unknown fields are ignored when rendering but should not be saved back from admin.
- Invalid CMS data falls back to the default V1 layout and shows an admin warning.

## Rendering Rules

Public rendering should use an allowlisted block registry. Each block receives normalized villa detail props and returns either a rendered section or `null` when empty and configured to hide.

When a row renders:

1. Filter disabled blocks.
2. Render each block through the registry.
3. Remove empty blocks when `hideWhenEmpty` is enabled.
4. Hide the whole row if no blocks remain.
5. Apply the row grid class from the allowed column/ratio map.

The renderer must not allow arbitrary class names from CMS data.

## Error Handling

Admin save errors should show the Supabase or route-handler error fields when available: `message`, `code`, `details`, and `hint`.

If the public page cannot load CMS layout settings, it should render the default V1 layout instead of breaking the villa detail page.

If the saved CMS layout is invalid, admin should show a warning and offer to restore the default layout.

## SEO

The layout builder must not remove route-level metadata, canonical URLs, sitemap behavior, or JSON-LD generation. Metadata and JSON-LD stay in the route/server data layer, not inside draggable blocks.

Blocks that contain meaningful villa content should render semantic headings in the same order as the layout. The locked intro remains high on the page so key villa information remains visible and crawlable.

## Performance

The default layout should reuse existing normalized data and avoid extra public fetches per block. The public page should load CMS layout once, then render all blocks from already-loaded villa/listing/image data.

Image blocks should use the existing image URL helpers and responsive image behavior. Recommended villas should reuse shared listing cards and keep existing pagination/incremental display patterns where relevant.

## Security

- CMS data is configuration, not executable content.
- No freeform HTML.
- No arbitrary Tailwind or CSS class names from CMS.
- Block types, ratios, and column counts are allowlisted.
- Private data from Deville APIs must not be exposed.
- Site contact data must continue using the shared contact source.

## Testing Plan

Unit tests:

- Default layout normalization.
- Invalid layout fallback.
- Row validation for columns and ratios.
- Block allowlist validation.
- Empty block and empty row hiding.

Component tests where practical:

- Admin row settings update column count and ratio correctly.
- Booking contact can be moved and disabled.
- Locked Gallery and intro cannot be moved or removed.

Build verification:

- `npm.cmd test`
- `npm.cmd run lint`
- `npm.cmd run build`

Browser verification:

- Admin layout builder desktop.
- Admin layout builder mobile/narrow viewport.
- Public detail page desktop.
- Public detail page mobile.
- A detail page with missing optional data to confirm empty blocks hide cleanly.

## Rollout

1. Add schema/storage for the shared detail layout setting.
2. Seed or default to the V1 layout when no setting exists.
3. Add admin UI for editing layout.
4. Add public renderer and block registry.
5. Verify current detail page content remains available through blocks.
6. Run tests, lint, build, and browser checks.
