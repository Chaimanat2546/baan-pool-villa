# Detail Layout Unified DnD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace native Canvas drag/drop with one accessible DnD Kit interaction that reorders rows, moves blocks, and copies blocks from the library.

**Architecture:** `AdminDetailLayoutPage` owns one DnD boundary around the library and Canvas. A typed ID/router helper interprets unified draggable and droppable IDs, then calls existing layout mutation callbacks without changing persistence or validation ownership.

**Tech Stack:** React, TypeScript, `@dnd-kit/core`, `@dnd-kit/sortable`, Tailwind CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-detail-layout-unified-dnd-design.md`

## Global Constraints

- Use one `DndContext` and one Canvas `SortableContext`.
- Preserve click-to-add in Block Library and draft-first page saving.
- Use Mouse, Touch, and Keyboard sensors, 44px handles, `touchAction: none`, and Thai screen-reader announcements.
- Do not commit without explicit user approval.

---

### Task 1: Typed DnD IDs and drop router

**Files:**
- Create: `components/admin/detail-layout/detail-layout-dnd.ts`
- Test: `components/admin/detail-layout/__tests__/detail-layout-dnd.test.ts`

**Interfaces:**
- Produces `parseDetailLayoutDndId(id: UniqueIdentifier)` and `resolveDetailLayoutDrop(activeId, overId)`.
- Produces a discriminated result for `moveWideRow`, `moveNarrowRow`, `moveWideBlock`, `moveNarrowBlock`, `moveWideToNarrow`, `moveNarrowToWide`, and `copyLibraryBlock`.

- [ ] **Step 1: Write failing route tests** with literal IDs such as `wide-row:row_a`, `wide-slot:row_b:1`, `narrow-row:row_c`, and `library:block:bedrooms`; assert each expected discriminated result and assert malformed/cross-type-invalid IDs return `null`.
- [ ] **Step 2: Run:** `npm.cmd test -- components/admin/detail-layout/__tests__/detail-layout-dnd.test.ts` **Expected:** failure because the module is absent.
- [ ] **Step 3: Implement** namespaced ID builders/parsers and the pure router; accept only explicit known prefixes and numeric wide-slot indexes.
- [ ] **Step 4: Run** the focused test; **Expected:** pass.

### Task 2: Unified Canvas and library DnD boundary

**Files:**
- Modify: `components/admin/detail-layout/admin-detail-layout-page.tsx`
- Modify: `components/admin/detail-layout/layout-canvas.tsx`
- Modify: `components/admin/detail-layout/block-library.tsx`
- Test: `components/admin/detail-layout/__tests__/layout-canvas.test.tsx`

**Interfaces:**
- Consumes Task 1’s router result.
- Produces one DnD boundary whose `onDragEnd` calls the existing page callbacks.

- [ ] **Step 1: Write failing component tests** asserting one Canvas sortable list, 44px `ลาก…` handles with `touchAction: none`, and a library draggable source while preserving its click add button.
- [ ] **Step 2: Run:** `npm.cmd test -- components/admin/detail-layout/__tests__/layout-canvas.test.tsx` **Expected:** failure against native `draggable` markup.
- [ ] **Step 3: Implement** Mouse/Touch/Keyboard sensors, Thai announcements, typed drag-end routing, sortable row/block handles, droppable Canvas slots, and valid-target styling; remove native `DragEvent`, `dataTransfer`, and `draggable` behavior.
- [ ] **Step 4: Run** the focused Canvas test; **Expected:** pass.

### Task 3: Regression verification and architecture map

**Files:**
- Modify: `docs/ai/structure.html`
- Test: `components/admin/detail-layout/__tests__/admin-detail-layout-page.test.tsx`

- [ ] **Step 1: Add failing regression tests** for a library copy drop, a wide-to-narrow move, a narrow-to-wide move, and no-op/invalid drops preserving the draft.
- [ ] **Step 2: Run:** `npm.cmd test -- components/admin/detail-layout/__tests__/admin-detail-layout-page.test.tsx components/admin/detail-layout/__tests__/layout-canvas.test.tsx` **Expected:** failures until every drag route is wired.
- [ ] **Step 3: Update** `docs/ai/structure.html` to name the unified DnD owner, preserved click add, and focused test guidance.
- [ ] **Step 4: Run:** `npm.cmd test -- components/admin/detail-layout; npm.cmd run lint; npm.cmd run build` **Expected:** tests pass, lint has no new errors, build succeeds.
