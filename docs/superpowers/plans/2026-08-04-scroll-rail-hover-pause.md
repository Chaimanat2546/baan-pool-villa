# Scroll Rail Hover Pause Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pause enabled homepage rail auto-scroll on mouse hover and resume it four seconds after mouse leave.

**Architecture:** Keep the behavior in the shared `ScrollRail` client component. Reuse its existing `restartAutoScroll` callback so arrows, drag release, and hover exit all use the same four-second delay; attach handlers only to the Embla viewport and only for rails with auto-scroll enabled.

**Tech Stack:** React, TypeScript, Embla Carousel Auto Scroll, Vitest/jsdom

## Global Constraints

- Change only `ScrollRail` behavior when `autoScroll` is enabled.
- Preserve touch, reduced-motion, manual arrow, drag-release, and nested-gallery protections.
- Do not change global plugin interaction defaults or create an autoplay pause state outside the component.
- Do not commit unless the user explicitly requests it.

---

### Task 1: Add hover-pause regression coverage

**Files:**
- Modify: `components/ui/__tests__/scroll-rail-embla.test.tsx`

**Interfaces:**
- Consumes: `ScrollRail({ autoScroll: true, label, children })`
- Produces: a regression test for the Auto Scroll plugin `stop()`/`play(4_000)` lifecycle on the Embla viewport

- [ ] **Step 1: Write a failing hover lifecycle test**

Render an auto-scrolling rail, select the viewport via the element carrying `data-scroll-rail-viewport`, and dispatch hover events:

```tsx
const viewport = container.querySelector("[data-scroll-rail-viewport]");

await act(async () => {
  viewport?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
});
expect(stopAutoScroll).toHaveBeenCalledTimes(1);

await act(async () => {
  viewport?.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
});
expect(playAutoScroll).toHaveBeenCalledWith(4_000);
```

- [ ] **Step 2: Run the focused test to confirm RED**

```powershell
npm.cmd test -- components/ui/__tests__/scroll-rail-embla.test.tsx
```

Expected: the test fails because the viewport has neither the data attribute nor mouse handlers.

### Task 2: Implement the scoped hover controls

**Files:**
- Modify: `components/ui/scroll-rail.tsx`

**Interfaces:**
- Consumes: existing `restartAutoScroll(): void` and `emblaApi?.plugins().autoScroll`
- Produces: `onMouseEnter` and `onMouseLeave` behavior on the Embla viewport for enabled auto-scroll rails

- [ ] **Step 1: Create the hover pause callback**

```ts
const pauseAutoScroll = useCallback(() => {
  emblaApi?.plugins().autoScroll?.stop();
}, [emblaApi]);
```

- [ ] **Step 2: Bind viewport events conditionally**

On the element with `ref={emblaRef}`, add:

```tsx
data-scroll-rail-viewport="true"
onMouseEnter={autoScroll ? pauseAutoScroll : undefined}
onMouseLeave={autoScroll ? restartAutoScroll : undefined}
```

- [ ] **Step 3: Run the focused test to confirm GREEN**

```powershell
npm.cmd test -- components/ui/__tests__/scroll-rail-embla.test.tsx
```

Expected: all tests in the file pass; hover calls `stop()` once and `play(4_000)` after mouse leave.

### Task 3: Verify the public rail behavior

**Files:**
- Verify only; no planned source changes

**Interfaces:**
- Consumes: the completed `ScrollRail` interaction
- Produces: evidence that shared rails retain their expected behavior

- [ ] **Step 1: Run related rail tests**

```powershell
npm.cmd test -- components/ui/__tests__/scroll-rail.test.tsx components/ui/__tests__/scroll-rail-embla.test.tsx components/villas/home/__tests__/request-budget.test.tsx
```

Expected: all targeted tests pass.

- [ ] **Step 2: Run lint and the production build**

```powershell
npm.cmd run lint
npm.cmd run build
```

Expected: lint exits with no errors and the production build exits 0.

- [ ] **Step 3: Inspect desktop and mobile rails locally**

On desktop, hover an enabled homepage rail and verify it stops, then leaves and resumes after four seconds. On a touch viewport, verify horizontal rail dragging remains available and that no hover-only behavior is required.

