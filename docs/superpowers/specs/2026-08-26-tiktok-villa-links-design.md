# TikTok Villa Links Design

## Goal

Allow each homepage TikTok video to optionally link to one villa. The public
link uses the villa's current name and routes to its existing `/villas/[id]`
page. Administrators can search for a villa by house number or house name when
editing a video.

## Data model and compatibility

`site_settings.tiktok_video_urls` remains the single ordered JSONB source for
TikTok videos. Each new entry is stored as:

```json
{ "url": "https://www.tiktok.com/@account/video/123", "houseId": "501" }
```

`houseId` is optional. A migration converts existing string entries to object
entries with only `url`, preserving their order and leaving them unlinked. The
normalizer must also continue to read legacy string entries during rollout.

The ID, not a copied villa title, is persisted. This prevents stale labels when
a villa name changes and keeps `/villas/[id]` as the sole public destination.

## Admin experience

Each TikTok row retains its URL, drag ordering, preview, and delete controls.
It gains an optional “บ้านพักที่เกี่ยวข้อง” picker:

1. The administrator types a house number or part of the villa title.
2. A bounded authenticated search returns matching `id` and `title` values.
3. Selecting a result stores its `houseId` in that row and presents the chosen
   villa label with a clear action.
4. Leaving the picker empty is valid for non-villa or general promotional
   videos.

The save route validates each nonempty house ID against the current villa
catalog. It rejects unknown IDs with a field-level Thai error and never trusts
browser-supplied villa titles.

## Public rendering

The homepage server resolves linked IDs against the current public villa
listings before passing TikTok data to the client. A resolved video displays a
small link below its card: `ดูบ้าน {villa title}`. The link uses normal document
navigation to `/villas/{id}`. Videos with no selection or an ID that no longer
resolves render normally without this link.

The existing TikTok player behavior, account-follow link, image loading,
ordering, homepage display limit, and cache durations remain unchanged.

## Caching and errors

Saving a TikTok configuration continues to revalidate only the site-settings
data tag and its existing public HTML cache version group. Villa lookup uses the
existing cached public villa source; no new public endpoint is added for the
homepage. Admin search is authenticated, validates its query, has a bounded
result count, and returns structured authorization and upstream errors.

## Verification

- Migration and normalizer tests cover legacy URL strings, new objects,
  optional IDs, and malformed data.
- Admin route tests cover search by numeric ID and title, unknown-ID rejection,
  and persistence of ordered links.
- Admin component tests cover search, selection, clearing, and save payloads.
- Homepage tests cover current villa titles, correct `/villas/[id]` links, and
  absence of a link for unassigned or unavailable villas.
- Run relevant TikTok, villa, site-settings, cache, and homepage tests; then
  run lint, production build, and desktop/mobile browser verification.
