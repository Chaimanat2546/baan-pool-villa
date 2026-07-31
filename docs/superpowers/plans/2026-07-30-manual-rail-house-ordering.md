# Manual Rail House Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin reorder the selected houses of a Manual homepage rail through a card-image-style modal with left/right controls.

**Architecture:** Keep `AdminSectionsPage` as the only draft-state owner. A focused dialog receives ordered house ids and their display labels, keeps a local pending order until confirmation, and returns the confirmed id sequence; the existing manual selection and save paths translate that array to persisted `position` values.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Lucide React, Vitest, Testing Library.

## Global Constraints

- Only `manual` rails expose the ordering control; `near_sea` and `slice` remain unchanged.
- Preserve the existing **บ้านพักในชุดนี้** search, selected-chip, add, and remove UI.
- Use Thai accessible names; disable the first card's left and last card's right button.
- Reuse the page-level save flow and existing `position` persistence; add no migration, dependency, or API contract.
- Do not commit unless the user explicitly requests it.

---

### Task 1: Build an isolated Manual-house ordering dialog

**Files:**
- Create: `components/admin/sections/manual-house-order-dialog.tsx`
- Create: `components/admin/sections/__tests__/manual-house-order-dialog.test.tsx`

**Interfaces:**
- Consumes: `houses: Array<{ id: string; title: string }>` and `open: boolean` from the admin page.
- Produces: `ManualHouseOrderDialog` with `onConfirm(nextHouseIds: string[]): void` and `onOpenChange(open: boolean): void`.

- [ ] **Step 1: Write failing dialog tests**

```tsx
render(
  <ManualHouseOrderDialog
    houses={[{ id: "702", title: "Villa DV-702" }, { id: "105", title: "Villa DV-105" }]}
    open
    onConfirm={onConfirm}
    onOpenChange={onOpenChange}
  />,
);
expect(screen.getByRole("heading", { name: "เรียงลำดับบ้าน" })).toBeTruthy();
expect(screen.getByRole("button", { name: "เลื่อนไปซ้าย Villa DV-702" })).toBeDisabled();
fireEvent.click(screen.getByRole("button", { name: "เลื่อนไปขวา Villa DV-702" }));
fireEvent.click(screen.getByRole("button", { name: "เสร็จสิ้น" }));
expect(onConfirm).toHaveBeenCalledWith(["105", "702"]);
```

Also assert cancel closes through `onOpenChange(false)` without calling `onConfirm`, and the final card's right control is disabled.

- [ ] **Step 2: Run the targeted test to confirm it fails**

Run: `npm.cmd test -- components/admin/sections/__tests__/manual-house-order-dialog.test.tsx`

Expected: FAIL because `ManualHouseOrderDialog` does not exist.

- [ ] **Step 3: Implement the dialog with local pending order**

```tsx
function moveId(ids: string[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= ids.length) return ids;
  const nextIds = [...ids];
  const [movedId] = nextIds.splice(fromIndex, 1);
  nextIds.splice(toIndex, 0, movedId);
  return nextIds;
}
```

Render a `role="dialog"` modal titled **เรียงลำดับบ้าน**, ordered cards labelled `#1`, `#2`, etc., and left/right buttons using `ArrowLeft` and `ArrowRight`. Derive the card labels from the supplied `houses` map, reset pending order whenever the dialog opens or source ids change, and only call `onConfirm` when **เสร็จสิ้น** is clicked.

- [ ] **Step 4: Re-run the targeted dialog test**

Run: `npm.cmd test -- components/admin/sections/__tests__/manual-house-order-dialog.test.tsx`

Expected: PASS.

### Task 2: Connect the dialog to Manual rail drafts

**Files:**
- Modify: `components/admin/sections/admin-sections-page.tsx`
- Modify: `components/admin/sections/__tests__/admin-sections-page.test.tsx`

**Interfaces:**
- Consumes: `ManualHouseOrderDialog` from Task 1 and the active section's `items: Array<{ houseId: string }>`.
- Produces: a Manual-only **เรียงบ้าน** button and an ordered replacement sequence routed through the existing manual-selection state update.

- [ ] **Step 1: Write failing page tests**

```tsx
expect(screen.getByRole("button", { name: "เรียงบ้าน" })).toBeTruthy();
fireEvent.click(screen.getByRole("button", { name: "เรียงบ้าน" }));
fireEvent.click(screen.getByRole("button", { name: "เลื่อนไปขวา Villa DV-702" }));
fireEvent.click(screen.getByRole("button", { name: "เสร็จสิ้น" }));
expect(container.querySelectorAll("[data-manual-house-chip]")[0]).toHaveAttribute(
  "data-manual-house-chip",
  "105",
);
```

Add a separate automatic-rail fixture and assert it has no **เรียงบ้าน** button.

- [ ] **Step 2: Run the targeted page test to confirm it fails**

Run: `npm.cmd test -- components/admin/sections/__tests__/admin-sections-page.test.tsx`

Expected: FAIL because the button and dialog integration do not exist.

- [ ] **Step 3: Add the Manual-only launch button and confirmation handler**

Add dialog-open state to `AdminSectionsPage`. Beside the existing `ManualIdsEditor`, render a disabled-when-empty **เรียงบ้าน** button only when `activeSection.mode === "manual"`. Pass `activeSection.items` in their current sequence to the dialog. On confirmation, replace only that active draft's `items` with:

```tsx
nextHouseIds.map((houseId, position) => ({
  houseId,
  isActive: true,
  position,
}))
```

Use existing fetched `manualHouses` labels where available and a deterministic `บ้าน ${id}` fallback. Do not change the search request or item validation behavior.

- [ ] **Step 4: Re-run page tests**

Run: `npm.cmd test -- components/admin/sections/__tests__/admin-sections-page.test.tsx components/admin/sections/__tests__/manual-ids-editor.test.tsx`

Expected: PASS.

### Task 3: Confirm persisted and public order contracts

**Files:**
- Modify: `lib/home-sections/__tests__/validation.test.ts`
- Modify: `lib/home-sections/__tests__/resolve.test.ts` only if it lacks an explicit non-source-order Manual position assertion.

**Interfaces:**
- Consumes: reordered `AdminSectionDraft.items` from Task 2.
- Produces: regression coverage that item array order serializes to sequential `position` values and manual resolution sorts by persisted position.

- [ ] **Step 1: Write failing focused contract assertions**

```ts
expect(normalizeHomeSectionDraftsForSave([draft])[0].items).toEqual([
  { houseId: "105", isActive: true, position: 0 },
  { houseId: "702", isActive: true, position: 1 },
]);
```

Use an input catalog ordered `702`, then `105`, with manual positions `105: 0` and `702: 1`; assert `resolveHomeSections(...)[0].villas.map(({ id }) => id)` is `["105", "702"]`.

- [ ] **Step 2: Run focused contract tests**

Run: `npm.cmd test -- lib/home-sections/__tests__/validation.test.ts lib/home-sections/__tests__/resolve.test.ts`

Expected: PASS if the pre-existing contracts already satisfy the assertion; otherwise FAIL and make the smallest behavior-preserving correction.

- [ ] **Step 3: Preserve or minimally correct the existing mapping**

Do not add a new persistence path. If a correction is required, keep `normalizeHomeSectionDraftsForSave` as the sole owner assigning zero-based sequential `position`, and keep `resolveManualVillas` as the sole owner sorting by `position`.

- [ ] **Step 4: Re-run focused contract tests**

Run: `npm.cmd test -- lib/home-sections/__tests__/validation.test.ts lib/home-sections/__tests__/resolve.test.ts`

Expected: PASS.

### Task 4: Full verification and responsive inspection

**Files:**
- Modify only if verification exposes a defect: the specific owner and its focused test from Tasks 1–3.

**Interfaces:**
- Consumes: complete Manual ordering flow.
- Produces: verified admin dialog, saved order, and unchanged automatic rails.

- [ ] **Step 1: Run all home-section and admin-section tests**

Run: `npm.cmd test -- lib/home-sections components/admin/sections`

Expected: PASS.

- [ ] **Step 2: Run static checks**

Run: `npm.cmd run lint`

Expected: exit code 0; record any pre-existing warnings separately.

- [ ] **Step 3: Run production build**

Run: `npm.cmd run build`

Expected: successful compile and type check; if environment-only Supabase prerender configuration blocks it, record that exact external blocker without changing product code.

- [ ] **Step 4: Inspect `/admin/sections` locally**

At desktop and mobile widths: select a Manual rail, open **เรียงบ้าน**, verify left/right boundary disabling, cancel, confirm, then use the existing save action. Switch to `near_sea` and `slice` rails and confirm no ordering control appears.
