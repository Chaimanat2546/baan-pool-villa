# Admin Villa Reviews List-to-Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement task-by-task with review.

**Goal:** Replace the persistent three-pane review workspace with scalable URL-state list and full-page edit routes.

**Architecture:** `/admin/villa-reviews` owns a paginated list and serializes search/filter/sort/page state in its query string. `/admin/villa-reviews/[id]` owns one private review editor and returns to the preserved list URL. Existing authenticated review APIs, validation, image upload, audit log, CSP image, and lightbox remain the source of truth.

**Spec:** `C:/Users/USER/.codex/attachments/0991d489-1a9a-4d8b-b2fc-336dbd8b1b50/pasted-text.txt`

## Tasks

- [ ] Extend the admin review list query/types/service/API with server-side page metadata (`total`, `page`, `pageSize`), newest/oldest/highest/lowest sorting, date and image filters; add focused tests. Keep private data out of list results.
- [ ] Replace the existing client three-pane component with a list-route page that reads/writes URL state, renders responsive desktop table/mobile rows, preserves query state and scroll on review navigation, and links to `/admin/villa-reviews/[id]`.
- [ ] Add the `[id]` edit route and full-width client editor using existing save/delete/image/lightbox/history components; include back URL, history drawer/sheet, and sticky mobile save action. Update structure documentation and run focused tests, lint, build, and local browser checks.
