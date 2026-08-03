# Home Rail Auto-Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins turn continuous auto-scroll on or off for each homepage villa rail without changing rails that remain disabled.

**Architecture:** Persist `auto_scroll_enabled` on `public.home_sections`, map it to `autoScrollEnabled` through the existing admin/public home-section contracts, and pass it from resolved sections to `VillaRail`. Add the animation lifecycle to `ScrollRail`, which already owns the scrollable DOM element and its horizontal controls.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase PostgreSQL/RPC, Vitest, Tailwind CSS.

## Global Constraints

- Use `auto_scroll_enabled boolean not null default false`; missing legacy/API values resolve to `false`.
- No new carousel dependency; use `requestAnimationFrame` only while an enabled rail is visible.
- Pause auto-scroll for hover, focus, pointer/touch interaction, hidden documents, and `prefers-reduced-motion: reduce`.
- Preserve the user’s manual scroll position; disabled rails must retain current behavior.
- Update `docs/ai/structure.html`; do not commit unless the user explicitly asks.

## File structure

- `supabase/migrations/20260803100000_add_home_section_auto_scroll.sql`: additive column and replacement snapshot RPC that persists it.
- `lib/home-sections/types.ts`, `validation.ts`, `server.ts`, `admin-route.ts`, `resolve.ts`: typed data contract, safe mapping, and public/admin propagation.
- `components/admin/sections/*`: draft mapping and the Thai per-rail switch.
- `components/ui/scroll-rail.tsx` and `components/villas/home/villa-rail.tsx`: client animation and homepage wiring.
- Existing focused tests plus a new `components/ui/__tests__/scroll-rail.test.tsx`: verify data persistence and accessible interaction behavior.

---

### Task 1: Persist and validate the per-rail setting

**Files:**
- Create: `supabase/migrations/20260803100000_add_home_section_auto_scroll.sql`
- Modify: `lib/home-sections/types.ts`, `lib/home-sections/validation.ts`, `lib/home-sections/admin-route.ts`, `lib/home-sections/server.ts`, `lib/home-sections/resolve.ts`
- Test: `lib/home-sections/__tests__/validation.test.ts`, `lib/home-sections/__tests__/route.test.ts`, `lib/home-sections/__tests__/resolve.test.ts`

**Interfaces:**
- Produces: `autoScrollEnabled: boolean` on `HomeSectionDraft`, `HomeSectionSavePayload`, `HomeSectionConfig`, and `ResolvedHomeSection`.
- Produces: snapshot JSON key `auto_scroll_enabled` consumed by `public.save_home_section_snapshot(snapshot jsonb)`.

- [ ] **Step 1: Write failing data-contract tests**

Add `autoScrollEnabled: false` to test factories and assert that normalization serializes it:

```ts
expect(normalizeHomeSectionDraftsForSave([validDraft({ autoScrollEnabled: true })]))
  .toEqual([expect.objectContaining({ autoScrollEnabled: true })]);
```

Add admin-route mapping coverage for `auto_scroll_enabled: true` and assert the RPC snapshot contains `auto_scroll_enabled: true`; add resolver coverage confirming the resolved rail retains the value.

- [ ] **Step 2: Run targeted tests to confirm the contract is missing**

Run: `npm.cmd test -- lib/home-sections/__tests__/validation.test.ts lib/home-sections/__tests__/route.test.ts lib/home-sections/__tests__/resolve.test.ts`

Expected: FAIL because the types/mappers do not yet expose `autoScrollEnabled`.

- [ ] **Step 3: Implement the schema and server contract**

Create an idempotent migration that adds the column and replaces the private snapshot function. The replacement insert must include the new column and preserve false for old payloads:

```sql
alter table public.home_sections
  add column if not exists auto_scroll_enabled boolean not null default false;

coalesce((section ->> 'auto_scroll_enabled')::boolean, false)
```

Keep the existing admin authorization, grants, wrapper, and `notify pgrst, 'reload schema'`. Add `auto_scroll_enabled` to both select strings and row shapes. Require a Boolean in explicit admin data, while the public database mapper treats an omitted field as false for legacy compatibility. Carry the property through `resolveHomeSections` to `ResolvedHomeSection` and serialize it in the save payload.

- [ ] **Step 4: Run targeted tests to confirm persistence and mapping**

Run: `npm.cmd test -- lib/home-sections/__tests__/validation.test.ts lib/home-sections/__tests__/route.test.ts lib/home-sections/__tests__/resolve.test.ts`

Expected: PASS; assertions show true survives admin payload → RPC snapshot → resolved rail contract.

### Task 2: Add the admin switch to the existing configuration group

**Files:**
- Modify: `components/admin/sections/section-draft-helpers.ts`, `components/admin/sections/section-config-form.tsx`, `components/admin/sections/admin-sections-page.tsx`
- Test: `components/admin/sections/__tests__/section-config-form.test.tsx`, `components/admin/sections/__tests__/section-draft-helpers.test.ts`

**Interfaces:**
- Consumes: `AdminSectionDraft.autoScrollEnabled` from Task 1.
- Produces: an admin draft patch `{ autoScrollEnabled: checked }`, included in the existing save request.

- [ ] **Step 1: Write failing admin UI tests**

Render a draft with `autoScrollEnabled: true` and assert the Thai switch is checked and named “เลื่อนอัตโนมัติ”. Add a draft-helper assertion that a newly created rail defaults to false and a mapped API response preserves true.

- [ ] **Step 2: Run the focused admin tests**

Run: `npm.cmd test -- components/admin/sections/__tests__/section-config-form.test.tsx components/admin/sections/__tests__/section-draft-helpers.test.ts`

Expected: FAIL because the draft property and switch do not exist.

- [ ] **Step 3: Implement the draft mapping and accessible switch**

Set `autoScrollEnabled: false` for newly added sections. In `SectionConfigForm`, add a checked checkbox below “จำนวนบ้านสูงสุดที่แสดง” with a concise description explaining continuous scrolling and interaction pause:

```tsx
<input
  checked={section.autoScrollEnabled}
  onChange={(event) => onChange({ autoScrollEnabled: event.target.checked })}
  type="checkbox"
/>
```

Keep the control inside the “วิธีเลือกและจำนวนบ้าน” group, use existing site color/focus styles, and make the displayed API-response shape validation require the Boolean.

- [ ] **Step 4: Run the focused admin tests**

Run: `npm.cmd test -- components/admin/sections/__tests__/section-config-form.test.tsx components/admin/sections/__tests__/section-draft-helpers.test.ts`

Expected: PASS; checked state, default false, and response mapping are covered.

### Task 3: Implement interaction-safe auto-scroll in the shared rail

**Files:**
- Modify: `components/ui/scroll-rail.tsx`, `components/villas/home/villa-rail.tsx`, `components/villas/home/page.tsx`
- Create: `components/ui/__tests__/scroll-rail.test.tsx`
- Test: `components/villas/home/__tests__/page.test.tsx` (if the existing rail-prop assertion is affected)

**Interfaces:**
- Consumes: optional `autoScroll?: boolean` on `ScrollRail` and `autoScrollEnabled?: boolean` on `VillaRail`.
- Produces: client-only horizontal advancement that cleanly stops when auto-scroll is disabled or interaction/accessibility rules require it.

- [ ] **Step 1: Write failing rail tests**

Mock `matchMedia`, `requestAnimationFrame`, and an overflow-capable scroller. Assert enabled rails schedule one frame while visible, pointer enter/focus/drag/touch and `visibilitychange` stop advancement, and reduced motion schedules none. Assert `autoScroll={false}` keeps the normal scroller markup and buttons.

- [ ] **Step 2: Run the new focused component test**

Run: `npm.cmd test -- components/ui/__tests__/scroll-rail.test.tsx`

Expected: FAIL because `ScrollRail` has no `autoScroll` behavior.

- [ ] **Step 3: Implement a bounded animation lifecycle**

Add `autoScroll = false` to `ScrollRailProps`. Track interaction, visibility, reduced-motion, overflow, and viewport intersection with refs/state. Each animation frame should only increment `scrollLeft` when active; when it reaches `scrollWidth - clientWidth`, reset to `0` and continue.

```ts
const advance = (timestamp: number) => {
  if (canAdvance()) {
    scroller.scrollLeft = scroller.scrollLeft >= maxScrollLeft
      ? 0
      : Math.min(maxScrollLeft, scroller.scrollLeft + elapsedMs * pixelsPerMs);
  }
  frameId = requestAnimationFrame(advance);
};
```

Use passive listeners where applicable, cancel the frame and disconnect observers/listeners during cleanup, and do not duplicate cards or alter the manual arrow controls. Pass the resolved property from `HomePageContent` → `VillaRail` → `ScrollRail`.

- [ ] **Step 4: Run focused component and home tests**

Run: `npm.cmd test -- components/ui/__tests__/scroll-rail.test.tsx components/villas/home/__tests__/page.test.tsx`

Expected: PASS; auto-scroll is opt-in and public rendering forwards the persisted setting.

### Task 4: Update the structure map and complete verification

**Files:**
- Modify: `docs/ai/structure.html`

**Interfaces:**
- Documents: `home_sections.auto_scroll_enabled` and the client-side rail lifecycle from Tasks 1–3.

- [ ] **Step 1: Update the relevant Home and home-section ownership entries**

Record that each configured rail can opt into auto-scroll, the setting is persisted through the existing snapshot API, and client behavior pauses for interaction/reduced-motion/hidden/out-of-viewport states.

- [ ] **Step 2: Run all focused tests**

Run: `npm.cmd test -- lib/home-sections/__tests__/validation.test.ts lib/home-sections/__tests__/route.test.ts lib/home-sections/__tests__/resolve.test.ts components/admin/sections/__tests__/section-config-form.test.tsx components/admin/sections/__tests__/section-draft-helpers.test.ts components/ui/__tests__/scroll-rail.test.tsx components/villas/home/__tests__/page.test.tsx`

Expected: PASS.

- [ ] **Step 3: Inspect the rendered page at desktop and mobile widths**

Start the local app, open the homepage with one enabled and one disabled rail, and verify: continuous motion only for the enabled rail, hover/focus pause on desktop, touch/drag pause on mobile, manual arrows still work, and no motion when reduced motion is enabled.

- [ ] **Step 4: Run production checks**

Run: `npm.cmd run lint` then `npm.cmd run build`

Expected: both commands exit 0.

## Self-review

- Spec coverage: Tasks 1–2 cover persistence, validation, and the requested admin placement; Task 3 covers animation, pause/resume, reduced motion, visibility, and cleanup; Task 4 covers documentation and required verification.
- Placeholder scan: no deferred work or undefined interfaces remain.
- Type consistency: `autoScrollEnabled` is the TypeScript property at every boundary; `auto_scroll_enabled` is used only for SQL/Supabase/RPC JSON.
