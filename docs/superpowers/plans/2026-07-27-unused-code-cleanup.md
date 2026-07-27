# Unused Code Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove high-confidence unused code, assets, and direct dependencies without changing public behavior or deleting externally reachable APIs.

**Architecture:** Keep all 31 Next.js Route Handlers and their public contracts unchanged because repository references cannot prove that external consumers are absent. Remove only modules with no production import path, tests that exclusively cover those deleted modules, unused scaffold assets, and redundant direct dependencies. Finish with focused tests, full lint, production build, and a fresh import-graph check.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Vitest 4, ESLint 9, npm

## Global Constraints

- Preserve public API routes until production access logs confirm they are unused.
- Preserve Supabase migrations as source-controlled schema history.
- Preserve the active `.superpowers/worktrees/hide-villa-image-manifest` Git worktree.
- Do not expose or print values from `.env` files.
- Do not commit unless ภู explicitly asks.
- Use the local Next.js documentation under `node_modules/next/dist/docs/` for framework conventions.

---

### Task 1: Remove unreachable production modules

**Files:**
- Delete: `app/(admin)/api/admin/home-sections/auth.ts`
- Delete: `components/admin/guides/guide-list.tsx`
- Delete: `components/villas/detail/policy-section.tsx`
- Delete: `components/villas/listing/villa-amenities.tsx`
- Delete: `components/villas/listing/villa-stats.tsx`
- Delete: `lib/site-header-settings/server.ts`
- Delete: `lib/tiktok/oembed.ts`
- Delete: `components/villas/detail/__tests__/policy-section.test.tsx`
- Delete: `lib/site-header-settings/__tests__/server.test.ts`
- Delete: `lib/tiktok/__tests__/oembed.test.ts`

**Interfaces:**
- Consumes: the existing Next.js entry points and static import graph.
- Produces: the same runtime route/component graph with unreachable modules removed.

- [ ] **Step 1: Reconfirm no production imports**

Run:

```powershell
rg -n "guide-list|policy-section|villa-amenities|villa-stats|site-header-settings/server|tiktok/oembed|home-sections/auth" app components lib --glob '!**/*.test.*' --glob '!**/__tests__/**'
```

Expected: no production imports of the deletion targets.

- [ ] **Step 2: Delete the unreachable modules and their exclusive tests**

Delete exactly the ten files listed in this task. Do not delete `lib/aws-loader.ts`; Next.js loads it through `images.loaderFile` rather than an import.

- [ ] **Step 3: Check documentation references**

Run:

```powershell
rg -n "guide-list|policy-section|villa-amenities|villa-stats|site-header-settings/server|tiktok/oembed|home-sections/auth" docs README.md DEPLOY.md
```

Expected: update only references that claim a deleted module still owns runtime behavior.

### Task 2: Remove redundant direct dependencies and unused public assets

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete: `public/file.svg`
- Delete: `public/globe.svg`
- Delete: `public/next.svg`
- Delete: `public/vercel.svg`
- Delete: `public/window.svg`
- Delete: `public/site-icons/apple-icon.png`
- Delete: `public/site-icons/favicon.ico`

**Interfaces:**
- Consumes: `react-day-picker`'s declared `date-fns` dependency and current direct `@supabase/supabase-js` usage.
- Produces: a dependency manifest without unused `@supabase/ssr` or redundant direct `date-fns`.

- [ ] **Step 1: Remove direct dependency declarations**

Run:

```powershell
npm.cmd uninstall @supabase/ssr date-fns
```

Expected: `@supabase/ssr` disappears; `date-fns` remains installed transitively through `react-day-picker`.

- [ ] **Step 2: Delete unreferenced scaffold assets**

Delete exactly the seven public files listed above. Preserve `public/site-icons/icon.png`, which is the production-safe favicon fallback.

- [ ] **Step 3: Verify package and asset references**

Run:

```powershell
rg -n "@supabase/ssr|from ['\"]date-fns|/file.svg|/globe.svg|/next.svg|/vercel.svg|/window.svg|apple-icon.png|favicon.ico" app components lib scripts tests next.config.ts
```

Expected: no application references.

### Task 3: Remove small unused declarations and fix lint scope

**Files:**
- Modify: `lib/villas/images.ts`
- Modify: `eslint.config.mjs`
- Modify: `vitest.config.mts`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: `fetchVillaImagesFromSupabase(villaId, limit?)`.
- Produces: identical Supabase image queries without the unused string id argument; project tooling ignores tool-managed worktrees.

- [ ] **Step 1: Remove the unused image helper parameter**

Change:

```ts
fetchVillaImagesFromSupabase(id, villaId)
```

to:

```ts
fetchVillaImagesFromSupabase(villaId)
```

and change the helper signature to:

```ts
async function fetchVillaImagesFromSupabase(
  villaId: number,
  limit?: number,
): Promise<VillaImage[]>
```

- [ ] **Step 2: Exclude tool-managed worktrees from project tooling**

Add `".superpowers/**"` to `globalIgnores` in `eslint.config.mjs`, append it to Vitest's default excludes through `configDefaults.exclude`, and add `.superpowers` to `tsconfig.json`'s `exclude`. This prevents the active nested Git worktree from being linted, tested, or type-checked as part of the parent checkout while preserving coverage for the main source tree.

- [ ] **Step 3: Preserve local secret files**

Do not rewrite `.env` through shell text filters. Report that `IMAGE_INTERNAL_API_TOKEN` is stale so ภู can remove it safely without exposing its value.

### Task 4: Verify behavior and repository cleanliness

**Files:**
- Test: `lib/villas/__tests__/images.test.ts`
- Test: current full Vitest suite
- Verify: full ESLint and Next.js production build

**Interfaces:**
- Consumes: all changes from Tasks 1-3.
- Produces: evidence that the cleanup is behavior-preserving and build-safe.

- [ ] **Step 1: Run focused villa image tests**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/images.test.ts
```

Expected: all focused image tests pass.

- [ ] **Step 2: Run the full test suite**

Run:

```powershell
npm.cmd test
```

Expected: all Vitest files pass.

- [ ] **Step 3: Run full lint**

Run:

```powershell
npm.cmd run lint
```

Expected: zero ESLint errors; existing non-blocking warnings may remain.

- [ ] **Step 4: Run the production build**

Run:

```powershell
npm.cmd run build
```

Expected: Next.js production build exits successfully.

- [ ] **Step 5: Re-run dead-file and dependency checks**

Run the production import graph and package-reference scans from the audit.

Expected: the deleted modules and direct dependencies are absent; all public Route Handlers remain.

- [ ] **Step 6: Confirm the working-tree diff**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: only the planned cleanup appears and `git diff --check` exits successfully.
