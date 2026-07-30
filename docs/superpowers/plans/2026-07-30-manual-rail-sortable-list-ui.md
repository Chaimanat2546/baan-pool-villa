# Manual rail sortable-list UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the manual-rail ordering dialog a compact, familiar sortable list without changing ordering behaviour.

**Architecture:** Keep all behaviour inside `ManualHouseOrderDialog`. Change only each villa row's responsive Tailwind layout: rank, handle, image fallback, and text form the left identity group while the existing previous/next buttons form a right-aligned control group. Existing drag, focus-management, confirmation, and data contracts remain unchanged.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest, Testing Library, lucide-react.

## Global Constraints

- Only the presentation of `ManualHouseOrderDialog` changes; ordering payloads, APIs, and public rails are out of scope.
- Keep native HTML drag-and-drop and the paired previous/next buttons.
- Render each villa as one approximately 72px-high sortable-list row with a 56px cover or existing fallback.
- Preserve accessible button labels, disabled edge buttons, dialog focus trapping, cancel, and confirm behaviour.
- On narrow screens preserve one row, truncate long house text, and retain touch-sized controls.
- Render the house identifier as `DV-{id}` and use vertically oriented move-up/move-down controls with matching Thai accessible labels.
- Do not commit unless the user explicitly requests it.

---

### Task 1: Compact sortable row presentation

**Files:**
- Modify: `components/admin/sections/manual-house-order-dialog.tsx:163-260`
- Test: `components/admin/sections/__tests__/manual-house-order-dialog.test.tsx`

**Interfaces:**
- Consumes: existing `ManualHouseOrderOption`, `pendingHouseIds`, `moveId`, and native drag handlers.
- Produces: unchanged `onConfirm(nextHouseIds: string[])` behaviour with a compact row UI.

- [ ] **Step 1: Add focused structural assertions for the compact row**

Add a test that renders two houses, then assert the first row has the `data-house-id` marker, its cover image has `size-14`, and its arrow control wrapper uses a non-shrinking horizontal layout.

```tsx
const firstRow = screen.getByLabelText("SunKiss ลากเพื่อเปลี่ยนลำดับ");
expect(firstRow).toHaveAttribute("data-house-id", "1641");
expect(screen.getByAltText("รูปปก SunKiss")).toHaveClass("size-14");
expect(screen.getByLabelText("เลื่อนไปซ้าย SunKiss").parentElement).toHaveClass(
  "shrink-0",
);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm.cmd test -- components/admin/sections/__tests__/manual-house-order-dialog.test.tsx`

Expected: FAIL because the current cover has `size-12` and the arrow wrapper does not have `shrink-0`.

- [ ] **Step 3: Implement the compact sortable-list row**

In `PendingHouseOrder`, replace the current four-column card styling with a fixed-height flex row. Make the rank badge and drag handle non-shrinking, change covers and fallbacks from `size-12` to `size-14`, constrain the text container with `min-w-0 flex-1`, and give the existing arrow wrapper `shrink-0` plus a paired border treatment. Preserve each button's label, click handler, and disabled condition.

```tsx
className="flex min-h-[72px] min-w-0 items-center gap-3 rounded-xl border p-2"
// identity group: rank, image/fallback, then min-w-0 flex-1 text
// controls: className="flex shrink-0 overflow-hidden rounded-lg border"
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm.cmd test -- components/admin/sections/__tests__/manual-house-order-dialog.test.tsx`

Expected: PASS with the existing drag, arrow, cancel, and confirmation tests still passing.

- [ ] **Step 5: Verify responsive UI and project checks**

Open `/admin/sections`, select a manual rail, and open **เรียงลำดับบ้าน**. Inspect at 390px and 1440px: the list remains one compact row per home, long text truncates, image fallback remains legible, controls stay aligned right, drag reorders, and confirm preserves the new order. Then run:

```powershell
npm.cmd test -- components/admin/sections/__tests__/manual-house-order-dialog.test.tsx
npm.cmd run lint
npm.cmd run build
```

Record any pre-existing unrelated lint or build failure separately; do not weaken checks or modify unrelated code.

### Task 2: Vertical ordering controls and DV identifier

**Files:**
- Modify: `components/admin/sections/manual-house-order-dialog.tsx:3,278-305`
- Test: `components/admin/sections/__tests__/manual-house-order-dialog.test.tsx`

**Interfaces:**
- Consumes: `houseId`, `index`, `pendingHouseIds`, and `moveId`.
- Produces: the same order update behaviour through accessible **เลื่อนขึ้น** and **เลื่อนลง** buttons.

- [ ] **Step 1: Write the failing test**

Assert the identifier text is `DV-702`, the first house has a disabled `เลื่อนขึ้น` button, and clicking `เลื่อนลง` confirms the swapped IDs.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm.cmd test -- components/admin/sections/__tests__/manual-house-order-dialog.test.tsx`

Expected: FAIL because the current text reads `เลขบ้าน 702` and the current controls are labelled left/right.

- [ ] **Step 3: Implement the minimal control rename**

Replace `ArrowLeft` and `ArrowRight` imports with `ArrowUp` and `ArrowDown`; render `DV-{houseId}`; rename the button labels to `เลื่อนขึ้น` / `เลื่อนลง`; keep their move targets as `index - 1` / `index + 1` and their existing edge disabled conditions.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm.cmd test -- components/admin/sections/__tests__/manual-house-order-dialog.test.tsx`

Expected: PASS.
