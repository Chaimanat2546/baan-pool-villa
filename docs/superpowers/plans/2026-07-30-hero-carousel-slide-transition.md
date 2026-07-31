# Hero Carousel Slide Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Hero carousel cross-fade with directional horizontal slide transitions.

**Architecture:** `HeroCarousel` retains the outgoing image briefly while rendering the incoming image. It records whether the selected destination is forward or backward and selects static CSS keyframes for both layers. The existing 5-second interval and controls use the same selection path.

**Tech Stack:** React client component, Next Image wrapper, Tailwind arbitrary animation utilities, Vitest + jsdom.

## Global Constraints

- Right button and automatic advance move the incoming image from right to left.
- Left button moves the incoming image from left to right.
- Retain reduced-motion support and existing controls.
- Do not modify persistence, admin settings, or slide data contracts.

---

### Task 1: Verify directional slide layers

**Files:**
- Modify: `components/villas/home/__tests__/hero-section.test.tsx`
- Modify: `components/villas/home/hero-carousel.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `HeroCarouselSlide[]` and `selectSlide(index)` inside `HeroCarousel`.
- Produces: Incoming and outgoing image classes for `forward` and `backward` transitions.

- [ ] **Step 1: Write the failing test**

Render two Hero slides, click the next control, then assert both images exist while the first has `slide-out-to-left` and the second has `slide-in-from-right`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- components/villas/home/__tests__/hero-section.test.tsx`

Expected: FAIL because the current cross-fade classes do not describe directional slide movement.

- [ ] **Step 3: Write minimal implementation**

Store a `"forward" | "backward"` direction alongside the previous slide. Render static Tailwind arbitrary animation classes for outgoing and incoming layers, and add four matching keyframes in `app/globals.css`.

- [ ] **Step 4: Run focused tests and production build**

Run: `npm.cmd test -- components/villas/home/__tests__/hero-section.test.tsx`

Run: `npm.cmd run build`

Expected: all Hero tests and build pass.
