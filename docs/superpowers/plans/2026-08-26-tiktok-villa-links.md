# TikTok Villa Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins optionally associate every homepage TikTok video with a villa and render a current-name link to that villa below the public video card.

**Architecture:** The ordered `site_settings.tiktok_video_urls` JSONB column stores video objects with an optional normalized `houseId`; legacy strings remain readable. A focused TikTok-villa helper owns house-ID normalization, catalog search, and public link resolution. The authenticated admin route searches the existing cached villa catalog, while the public homepage resolves selected IDs server-side and passes only a safe `villa` link projection to the client card.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Supabase JSONB migrations, Vitest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-08-26-tiktok-villa-links-design.md`

## Global Constraints

- Persist `{ url, houseId? }` entries in `site_settings.tiktok_video_urls`; preserve existing ordering and accept legacy URL strings while rolling out.
- `houseId` is optional; never persist a copied house title and never trust one submitted by the browser.
- Use existing cached villa data; do not introduce a public search endpoint or shorten cache policy.
- Keep public villa navigation as a normal anchor to `/villas/[id]`.
- Admin-facing new copy and validation messages must be Thai.
- Preserve existing working-tree changes and do not commit unless the user explicitly requests it.

---

## File Structure

- `supabase/migrations/20260826000000_add_tiktok_video_house_ids.sql` — idempotently convert legacy TikTok URL strings to objects with optional `houseId`.
- `supabase/site-settings-migrations/home-config-fresh-install.sql` and `supabase/site-settings-migrations/20260623000000_bootstrap_site_settings_project.sql` — embed the compatible JSONB migration in bootstrap scripts.
- `lib/tiktok/villa-links.ts` — house-ID normalization, bounded matching, and safe video-to-villa public resolution.
- `lib/tiktok/__tests__/villa-links.test.ts` — pure behavior coverage for the new helper.
- `lib/site-settings/types.ts`, `lib/site-settings/validation.ts`, `lib/site-settings/admin-tiktok-route.ts` — TikTok object shape, legacy normalization, validation, and persistence.
- `app/(admin)/api/admin/tiktok/villas/route.ts` — authenticated bounded villa search endpoint.
- `lib/site-settings/__tests__/tiktok-route.test.ts` and `app/(admin)/api/admin/tiktok/villas/route.test.ts` — persistence and search route coverage.
- `components/admin/tiktok/types.ts`, `tiktok-helpers.ts`, `tiktok-form.tsx`, `admin-tiktok-page.tsx` — per-video picker state, API search, selection/clear UI, and form serialization.
- `components/admin/tiktok/__tests__/*` — admin picker and save-payload coverage.
- `components/villas/home/client-payload.ts`, `tiktok-section.tsx`, `tiktok-lazy-card.tsx` — safe linked-villa client payload and the link under the public card.
- `app/(public)/(home)/page.tsx` and `app/(public)/(home)/page.test.tsx` — server-side resolution from existing villas before public rendering.
- `components/villas/home/__tests__/tiktok-section.test.tsx` and `components/villas/home/__tests__/request-budget.test.tsx` — public-link rendering and request-budget regression coverage.
- `docs/ai/structure.html` — record the TikTok object shape, admin villa search route, and targeted verification guidance.

### Task 1: Store and normalize optional TikTok house IDs

**Files:**
- Create: `supabase/migrations/20260826000000_add_tiktok_video_house_ids.sql`
- Modify: `supabase/site-settings-migrations/home-config-fresh-install.sql`
- Modify: `supabase/site-settings-migrations/20260623000000_bootstrap_site_settings_project.sql`
- Modify: `lib/site-settings/types.ts`
- Modify: `lib/site-settings/validation.ts`
- Test: `lib/site-settings/__tests__/validation.test.ts`

**Interfaces:**
- Produces `SiteTikTokVideoSettings { url: string; videoId: string; houseId: string | null }`.
- Produces `TikTokSettingsDraftInput { accountUrl: string; videos: Array<{ url: string; houseId?: string | null }> }`.
- Consumes legacy `string[]` or object JSONB values from `tiktok_video_urls`.

- [ ] **Step 1: Write failing normalization tests**

```ts
it("normalizes legacy strings and object rows with an optional house id", () => {
  const settings = normalizeSiteSettingsRow({
    ...row,
    tiktok_video_urls: [
      "https://www.tiktok.com/@baanpool/video/7370000000000000001",
      { houseId: " 501 ", url: "https://www.tiktok.com/@baanpool/video/7370000000000000002" },
    ],
  });

  expect(settings.tiktok.videos).toEqual([
    { houseId: null, url: "https://www.tiktok.com/@baanpool/video/7370000000000000001", videoId: "7370000000000000001" },
    { houseId: "501", url: "https://www.tiktok.com/@baanpool/video/7370000000000000002", videoId: "7370000000000000002" },
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd test -- lib/site-settings/__tests__/validation.test.ts`

Expected: FAIL because `houseId` is not yet part of the normalized TikTok video contract.

- [ ] **Step 3: Add the idempotent JSONB data migration**

```sql
update public.site_settings
set tiktok_video_urls = coalesce(
  (
    select jsonb_agg(
      case
        when jsonb_typeof(video) = 'string' then jsonb_build_object('url', video #>> '{}')
        when jsonb_typeof(video) = 'object' then jsonb_strip_nulls(
          jsonb_build_object('url', video->>'url', 'houseId', nullif(trim(video->>'houseId'), ''))
        )
        else null
      end
      order by ordinal
    ) filter (where jsonb_typeof(video) in ('string', 'object'))
    from jsonb_array_elements(coalesce(tiktok_video_urls, '[]'::jsonb)) with ordinality as videos(video, ordinal)
  ),
  '[]'::jsonb
);
notify pgrst, 'reload schema';
```

Place the same guarded conversion in both fresh-install SQL bundles after their existing TikTok-settings migration block.

- [ ] **Step 4: Implement the TypeScript normalization**

```ts
export interface SiteTikTokVideoSettings {
  houseId: string | null;
  url: string;
  videoId: string;
}

function readTikTokVideoInput(item: unknown): { houseId: string | null; url: string } | null {
  if (typeof item === "string") return { houseId: null, url: item };
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const row = item as { houseId?: unknown; url?: unknown };
  if (typeof row.url !== "string") return null;
  return { houseId: normalizeTikTokHouseId(row.houseId), url: row.url };
}
```

Normalize only positive numeric IDs to their canonical decimal string; invalid IDs become `null` when reading persisted historical data. Preserve current URL validation and the 15-video display behavior.

- [ ] **Step 5: Re-run normalization tests**

Run: `npm.cmd test -- lib/site-settings/__tests__/validation.test.ts`

Expected: PASS, including existing TikTok URL cases.

### Task 2: Add a single villa-link helper and authenticated villa search

**Files:**
- Create: `lib/tiktok/villa-links.ts`
- Create: `lib/tiktok/__tests__/villa-links.test.ts`
- Create: `app/(admin)/api/admin/tiktok/villas/route.ts`
- Create: `app/(admin)/api/admin/tiktok/villas/route.test.ts`
- Modify: `lib/site-settings/admin-tiktok-route.ts`
- Test: `lib/site-settings/__tests__/tiktok-route.test.ts`

**Interfaces:**
- Produces `TikTokVillaOption { id: string; title: string }` and `searchTikTokVillaOptions(villas, query): TikTokVillaOption[]`.
- Produces `resolveTikTokVillaLinks(videos, villas)` with `villa: TikTokVillaOption | null` per video.
- `GET /api/admin/tiktok/villas?q=<text>` returns `{ villas: TikTokVillaOption[] }` after `requireHomeConfigAdmin`.
- `saveAdminTikTokSettings` calls `validateTikTokVideoHouseIds(videos, villas)` before updating Supabase.

- [ ] **Step 1: Write failing pure-helper tests**

```ts
it("finds a villa by numeric id or a case-insensitive title fragment", () => {
  const villas = [villa("501", "Glass House B8"), villa("502", "Villa Port Sand")];

  expect(searchTikTokVillaOptions(villas, "501")).toEqual([{ id: "501", title: "Glass House B8" }]);
  expect(searchTikTokVillaOptions(villas, "port")).toEqual([{ id: "502", title: "Villa Port Sand" }]);
});

it("omits a public villa link when the saved id no longer exists", () => {
  expect(resolveTikTokVillaLinks([{ houseId: "999", url: "https://www.tiktok.com/@a/video/7370000000000000001", videoId: "7370000000000000001" }], [villa("501", "Glass House B8")])[0]?.villa).toBeNull();
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run: `npm.cmd test -- lib/tiktok/__tests__/villa-links.test.ts`

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement bounded, safe matching**

```ts
export const TIKTOK_VILLA_SEARCH_LIMIT = 10;

export function searchTikTokVillaOptions(villas: VillaListing[], query: string): TikTokVillaOption[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  return villas
    .filter((villa) => villa.id.includes(needle) || villa.title?.toLocaleLowerCase().includes(needle))
    .slice(0, TIKTOK_VILLA_SEARCH_LIMIT)
    .map(({ id, title }) => ({ id, title: title?.trim() || `บ้านพัก #${id}` }));
}
```

Use an explicit normalized-ID lookup map to validate saved IDs. Do not use a user-controlled regular expression.

- [ ] **Step 4: Write failing route and save-validation tests**

```ts
it("returns only bounded title-or-id matches to an authenticated admin", async () => {
  fetchHouseListingsMock.mockResolvedValue([villa("501", "Glass House B8")]);
  const response = await GET(new Request("https://example.test/api/admin/tiktok/villas?q=glass"));
  await expect(response.json()).resolves.toEqual({ villas: [{ id: "501", title: "Glass House B8" }] });
});

it("rejects a saved TikTok house id that is absent from the catalog", async () => {
  fetchHouseListingsMock.mockResolvedValue([villa("501", "Glass House B8")]);
  const response = await saveAdminTikTokSettings(requestWithVideos([{ houseId: "999", url: validUrl }]), supabase);
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({ errors: [expect.stringContaining("ไม่พบบ้านพักหมายเลข 999")] });
});
```

- [ ] **Step 5: Implement the route and validation**

```ts
export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);
  if (!admin.ok) return admin.response;
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const villas = await fetchHouseListings();
  return Response.json({ villas: searchTikTokVillaOptions(villas, query) });
}
```

Reject query values longer than 80 characters with a `400` structured error. In the save route, obtain the catalog only when at least one normalized `houseId` is present, then use the helper validation before `update`. Keep the existing site-settings cache revalidation exactly as it is.

- [ ] **Step 6: Run focused helper and route tests**

Run: `npm.cmd test -- lib/tiktok/__tests__/villa-links.test.ts lib/site-settings/__tests__/tiktok-route.test.ts "app/(admin)/api/admin/tiktok/villas/route.test.ts"`

Expected: PASS.

### Task 3: Serialize TikTok video objects through the admin editor

**Files:**
- Modify: `components/admin/tiktok/types.ts`
- Modify: `components/admin/tiktok/tiktok-helpers.ts`
- Modify: `components/admin/tiktok/tiktok-form.tsx`
- Modify: `components/admin/tiktok/admin-tiktok-page.tsx`
- Test: `components/admin/tiktok/__tests__/tiktok-helpers.test.ts`
- Test: `components/admin/tiktok/__tests__/tiktok-form.test.tsx`
- Test: `components/admin/tiktok/__tests__/admin-tiktok-page.test.tsx`

**Interfaces:**
- Produces `AdminTikTokVideoDraft { rowId: string; url: string; houseId: string | null; houseTitle: string | null }`.
- `buildTikTokFormData` sends `tiktokVideos` as an array of `{ url, houseId }` objects.
- `TikTokForm` receives `onSearchVillas(query): Promise<TikTokVillaOption[]>` and updates only the row selected by the admin.

- [ ] **Step 1: Write failing form-data and UI tests**

```tsx
it("serializes the selected villa id with its video URL", () => {
  const data = buildTikTokFormData({ accountUrl: validAccountUrl, videos: [{ houseId: "501", houseTitle: "Glass House B8", rowId: "row-1", url: validUrl }] });
  expect(JSON.parse(String(data.get("tiktokVideos")))).toEqual([{ houseId: "501", url: validUrl }]);
});

it("selects and clears a searched villa without changing the video URL", async () => {
  render(<TikTokForm {...props} />);
  await user.type(screen.getByLabelText("ค้นหาบ้านพักสำหรับวิดีโอ TikTok 1"), "glass");
  await user.click(await screen.findByRole("button", { name: "Glass House B8 (#501)" }));
  expect(screen.getByText("Glass House B8 (#501)")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "ล้างบ้านพักสำหรับวิดีโอ TikTok 1" }));
  expect(screen.queryByText("Glass House B8 (#501)")).toBeNull();
  expect((screen.getByLabelText("ลิงก์วิดีโอ TikTok 1") as HTMLInputElement).value).toBe(validUrl);
});
```

- [ ] **Step 2: Run admin TikTok tests to verify failure**

Run: `npm.cmd test -- components/admin/tiktok/__tests__/tiktok-helpers.test.ts components/admin/tiktok/__tests__/tiktok-form.test.tsx components/admin/tiktok/__tests__/admin-tiktok-page.test.tsx`

Expected: FAIL because drafts contain URL strings only and no house picker exists.

- [ ] **Step 3: Implement row-local search and selection**

```ts
async function searchVillas(query: string) {
  const response = await fetch(`/api/admin/tiktok/villas?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await readJsonPayload(response) as { villas?: TikTokVillaOption[] } | null;
  return response.ok && Array.isArray(payload?.villas) ? payload.villas : [];
}
```

Debounce input by 250ms, cancel the prior request with `AbortController`, and do not search blank queries. Render selected house title and ID as a chip, plus a clearly labelled clear button. Search/load errors remain inline per row; authentication failures keep the current redirect handling.

- [ ] **Step 4: Update draft helpers and snapshots**

```ts
export function makeTikTokSnapshot(draft: AdminTikTokDraft): string {
  return JSON.stringify({
    accountUrl: draft.accountUrl,
    videos: draft.videos.map(({ houseId, url }) => ({ houseId, url })),
  });
}
```

Map API `settings.videos` to stable row IDs and optional selected labels. Preserve add, delete, keyboard movement, drag movement, preview selection, and empty-row behavior.

- [ ] **Step 5: Re-run the admin TikTok test suite**

Run: `npm.cmd test -- components/admin/tiktok/__tests__`

Expected: PASS.

### Task 4: Resolve and render public villa links below TikTok cards

**Files:**
- Modify: `app/(public)/(home)/page.tsx`
- Modify: `components/villas/home/client-payload.ts`
- Modify: `components/villas/home/tiktok-section.tsx`
- Modify: `components/villas/home/tiktok-lazy-card.tsx`
- Test: `app/(public)/(home)/page.test.tsx`
- Test: `components/villas/home/__tests__/tiktok-section.test.tsx`
- Test: `components/villas/home/__tests__/request-budget.test.tsx`

**Interfaces:**
- `resolveTikTokVillaLinks(settings.tiktok.videos, villas)` produces client-safe video items with `villa: { id, title } | null`.
- `HomePageSettings["tiktok"]` contains only URL, video ID, preview metadata, and an optional `{ id, title }` destination.
- `TikTokLazyCard` renders its optional `villa` as a normal public anchor below the video frame.

- [ ] **Step 1: Write failing homepage and component tests**

```tsx
it("renders a linked villa title below its TikTok video", () => {
  const markup = renderToStaticMarkup(<TikTokSection tiktok={{ accountUrl: "", videos: [{ houseId: "501", url: validUrl, videoId, villa: { id: "501", title: "Glass House B8" } }] }} />);
  expect(markup).toContain('href="/villas/501"');
  expect(markup).toContain("ดูบ้าน Glass House B8");
});

it("does not render a villa anchor for an unassigned TikTok video", () => {
  const markup = renderToStaticMarkup(<TikTokSection tiktok={{ accountUrl: "", videos: [{ houseId: null, url: validUrl, videoId, villa: null }] }} />);
  expect(markup).not.toContain('href="/villas/');
});
```

- [ ] **Step 2: Run the public TikTok tests to verify failure**

Run: `npm.cmd test -- components/villas/home/__tests__/tiktok-section.test.tsx components/villas/home/__tests__/request-budget.test.tsx "app/(public)/(home)/page.test.tsx"`

Expected: FAIL because public TikTok payloads and cards have no villa field.

- [ ] **Step 3: Resolve only selected villas in the homepage server component**

```ts
const linkedIds = settings.tiktok.videos.flatMap((video) => video.houseId ? [video.houseId] : []);
const linkedVillas = await Promise.all(linkedIds.map((id) => getListingById(id)));
const linkedTikTok = resolveTikTokVillaLinks(settings.tiktok.videos, linkedVillas.filter((villa): villa is VillaListing => villa !== null));
```

Run this in parallel with site/contact/style settings where possible. A failed or missing listing resolves to `villa: null`; it must not make the homepage degraded or hide the video.

- [ ] **Step 4: Render the accessible link below each card**

```tsx
{video.villa ? (
  <a className="block border-t border-[var(--site-border)] px-3 py-2 text-sm font-semibold text-[var(--site-primary)] hover:bg-[var(--site-primary-soft)]" href={`/villas/${video.villa.id}`}>
    ดูบ้าน {video.villa.title}
  </a>
) : null}
```

Keep the TikTok play control a button and the house navigation a sibling anchor, so clicking the link never starts the video. Preserve the same layout in rail and grid modes.

- [ ] **Step 5: Re-run public TikTok and homepage tests**

Run: `npm.cmd test -- components/villas/home/__tests__/tiktok-section.test.tsx components/villas/home/__tests__/request-budget.test.tsx "app/(public)/(home)/page.test.tsx"`

Expected: PASS, including no duplicate public requests and no `_rsc` navigation behavior for villa links.

### Task 5: Document, integrate, and verify the completed flow

**Files:**
- Modify: `docs/ai/structure.html`
- Test: `lib/site-settings/__tests__/validation.test.ts`
- Test: `lib/site-settings/__tests__/tiktok-route.test.ts`
- Test: `lib/tiktok/__tests__/villa-links.test.ts`
- Test: `app/(admin)/api/admin/tiktok/villas/route.test.ts`
- Test: `components/admin/tiktok/__tests__`
- Test: `components/villas/home/__tests__/tiktok-section.test.tsx`
- Test: `components/villas/home/__tests__/request-budget.test.tsx`
- Test: `app/(public)/(home)/page.test.tsx`

**Interfaces:**
- Documents the persistent `{ url, houseId? }` contract, authenticated search route, and public resolution behavior.
- Produces evidence that invalid IDs are rejected on save and stale IDs safely disappear from public links.

- [ ] **Step 1: Update the structure map**

Add the optional `houseId` TikTok JSONB contract to the site-settings and TikTok ownership rows. Add `/api/admin/tiktok/villas` as an authenticated bounded title-or-ID search route. Update TikTok verification guidance to include the new focused helper, route, admin UI, and public card tests.

- [ ] **Step 2: Run all focused automated checks**

Run: `npm.cmd test -- lib/site-settings/__tests__/validation.test.ts lib/site-settings/__tests__/tiktok-route.test.ts lib/tiktok/__tests__/villa-links.test.ts "app/(admin)/api/admin/tiktok/villas/route.test.ts" components/admin/tiktok components/villas/home/__tests__/tiktok-section.test.tsx components/villas/home/__tests__/request-budget.test.tsx "app/(public)/(home)/page.test.tsx"`

Expected: PASS with zero failed tests.

- [ ] **Step 3: Run project quality checks**

Run: `npm.cmd run lint`

Expected: zero ESLint errors; report any pre-existing warnings separately.

Run: `npm.cmd run build`

Expected: successful Next.js production build and type check.

- [ ] **Step 4: Verify the real UI**

Start the local app, then inspect `/admin/tiktok` at desktop and mobile widths: type a house number, type a title fragment, select a result, clear it, save, and confirm validation feedback for a nonexistent ID. Inspect `/` at desktop and mobile widths: a linked video shows the current house title below its card; an unlinked video does not; clicking the house link reaches `/villas/[id]` without starting the TikTok player. Confirm browser networking has no unexpected `/_next/image` or `_rsc` request caused by the new public links.

