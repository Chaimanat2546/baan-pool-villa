# Hero carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single Hero image with an ordered, accessible 1–10 image carousel managed in admin settings.

**Architecture:** Add a normalized ordered Hero-slide setting with legacy single-image fallback. Keep setting validation/persistence in `lib/site-settings`, reuse asset validation/upload ownership, and render a focused client carousel within the existing Hero section.

**Tech Stack:** Next.js, React, TypeScript, Tailwind, Supabase, Vitest.

## Global Constraints

- Each Hero slide has its own image and required alt text; maximum is ten slides.
- Existing single Hero settings migrate/fallback as slide one.
- Carousel auto-advances every five seconds and pauses on interaction/focus; controls are hidden for one slide.
- Keep existing admin authorization, storage validation, conservative cleanup, and settings cache policy.

---

### Task 1: Persist and validate Hero slides

**Files:** `supabase/migrations/*hero_slides*.sql`, `lib/site-settings/{types,defaults,validation,admin-section-contracts}.ts`, relevant site-settings tests.

- [ ] Write failing normalization and validation tests for legacy fallback, separate alt texts, and the ten-slide maximum.
- [ ] Add the minimal idempotent schema/contract/default/validation changes.
- [ ] Run focused `lib/site-settings` tests.

### Task 2: Build admin slide editor

**Files:** `components/admin/settings/{hero-settings-page,settings-helpers,types,settings-validation}.ts(x)` and Hero settings tests.

- [ ] Write failing tests for add, reorder, remove, per-slide alt text, and snapshot payload.
- [ ] Implement the 1–10 slide editor using existing upload controls and persisted ordered payload.
- [ ] Run Hero admin tests.

### Task 3: Render public carousel

**Files:** `components/villas/home/{hero-section,client-payload}.ts(x)`, Hero tests, and route consumers if types require them.

- [ ] Write failing tests for first slide, controls, auto-advance, pause, and single-slide fallback.
- [ ] Implement the keyboard-accessible carousel without changing Hero search behaviour.
- [ ] Run focused home tests, lint, build, and desktop/mobile browser checks.
