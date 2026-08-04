# Customer Review Lightbox Scroll Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock background page scrolling while the homepage customer-review lightbox is open.

**Architecture:** `CustomerReviewSection` already owns whether the lightbox is mounted through `lightboxIndex`. Reuse the existing detail-gallery `useLockedBodyScroll` hook with that boolean so lock cleanup remains owned by React.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest with JSDOM.

## Global Constraints

- Reuse `components/villas/detail/use-locked-body-scroll.ts`; do not add a second scroll-lock implementation.
- Lock only while a review lightbox is open and restore scroll on close or unmount.
- Preserve review modal controls, navigation, image loading, and layout.
- Do not commit or push unless the user explicitly requests it.

---

### Task 1: Lock and restore review-lightbox background scrolling

**Files:**
- Modify: `components/villas/home/__tests__/customer-review-section.test.tsx`
- Modify: `components/villas/home/customer-review-section.tsx`

**Interfaces:**
- Consumes: `useLockedBodyScroll(active: boolean): void` from `components/villas/detail/use-locked-body-scroll.ts`.
- Produces: `body.body-scroll-locked` while `lightboxIndex !== null`.

- [x] **Step 1: Write the failing test**

Add a test that renders one review, clicks its image button, then asserts:

```ts
expect(document.body.classList.contains("body-scroll-locked")).toBe(true);
```

Click the `aria-label="ปิดรูปรีวิว"` button and assert:

```ts
expect(document.body.classList.contains("body-scroll-locked")).toBe(false);
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `npm.cmd test -- components/villas/home/__tests__/customer-review-section.test.tsx`

Expected: the new test fails because `CustomerReviewSection` does not call the lock hook.

- [x] **Step 3: Write minimal implementation**

Import and call the existing hook immediately after `lightboxIndex` state:

```tsx
useLockedBodyScroll(lightboxIndex !== null);
```

- [x] **Step 4: Run focused test to verify it passes**

Run: `npm.cmd test -- components/villas/home/__tests__/customer-review-section.test.tsx`

Expected: all tests in that file pass.

- [ ] **Step 5: Verify UI and repository checks**

Run:

```powershell
npm.cmd run lint
npm.cmd run build
```

On the home page at desktop and mobile widths, open a review image, attempt to scroll the background, close the modal, and confirm page scrolling returns. Do not commit or push unless explicitly requested.

Status: lint, production build, and manual desktop/mobile UI verification remain unconfirmed for this plan revision.
