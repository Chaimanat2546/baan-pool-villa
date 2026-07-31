# Manual Rail Cover DnD Implementation Plan

**Goal:** Show resolved covers and allow drag ordering in the Manual rail dialog.

1. Extend `app/(admin)/api/admin/home-sections/houses/route.ts` and its tests to return `coverImage`, resolving custom card cover first and legacy cover second.
2. Extend `ManualHouseOrderOption` and `manual-house-order-dialog.tsx` to render cover cards or a placeholder, using native draggable cards while retaining arrow buttons; add dialog tests for drag order and image fallback.
3. Wire the enriched house options through `admin-sections-page.tsx`, run focused route/component tests, lint, build, and desktop/mobile inspection.

Constraints: authenticated minimal response; no dependency, migration, or save-contract change; preserve Thai accessible controls and existing focus behavior.
