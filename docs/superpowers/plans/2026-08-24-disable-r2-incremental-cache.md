# Disable OpenNext R2 Incremental Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop OpenNext from using R2 and Durable Objects for persistent incremental caching while retaining the existing low-volume R2 HTML edge-cache version store.

**Architecture:** Let `defineCloudflareConfig()` select OpenNext's dummy incremental cache, dummy tag cache, and dummy queue by omitting all cache overrides. Keep the existing Wrangler bindings unchanged so `worker-html-cache-version.js` can continue using `NEXT_INC_CACHE_R2_BUCKET` only for `html-cache-versions/` tokens.

**Tech Stack:** Next.js 16.3, OpenNext Cloudflare 1.19.11, Cloudflare Workers, Vitest, ESLint

**Spec:** `docs/superpowers/specs/2026-08-24-disable-r2-incremental-cache-design.md`

## Global Constraints

- Do not deploy any Worker.
- Do not delete any R2 bucket, R2 object, Durable Object namespace, binding, class, or migration history.
- Do not change public HTML, JSON, image, calendar, or browser cache-control policies.
- Preserve `NEXT_INC_CACHE_R2_BUCKET` in every Wrangler environment for HTML edge-cache version tokens.
- Preserve unrelated user changes in the working tree.
- Do not commit unless the user explicitly requests it.

---

### Task 1: Lock the no-persistent-cache configuration contract

**Files:**
- Modify: `open-next.config.test.ts`
- Test: `worker-html-cache-version.test.ts`

**Interfaces:**
- Consumes: `defineCloudflareConfig()` defaults from `@opennextjs/cloudflare`, where omitted cache overrides resolve to `"dummy"`.
- Produces: A runtime regression test requiring OpenNext to resolve its incremental cache, tag cache, and queue to the dummy implementations. The existing HTML version-store test continues to cover the retained R2 fallback behavior.

- [ ] **Step 1: Replace the current regional-cache expectation with a failing no-persistent-cache test**

```ts
import { describe, expect, it } from "vitest";

import openNextConfig from "./open-next.config";

describe("OpenNext cache configuration", () => {
  it("uses dummy OpenNext cache, tag cache, and queue implementations", () => {
    expect(openNextConfig.default?.override?.incrementalCache).toBe("dummy");
    expect(openNextConfig.default?.override?.tagCache).toBe("dummy");
    expect(openNextConfig.default?.override?.queue).toBe("dummy");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the current configuration fails the new contract**

Run: `npm.cmd test -- open-next.config.test.ts`

Expected: FAIL because `open-next.config.ts` still configures `withRegionalCache`, `doShardedTagCache`, and `doQueue`.

- [ ] **Step 3: Review the failure and confirm it is caused only by the intended cache configuration**

Expected failure signal: one or more resolved overrides are functions rather than `"dummy"`. Do not proceed if importing the configuration itself fails.

---

### Task 2: Disable the OpenNext persistent-cache stack

**Files:**
- Modify: `open-next.config.ts`
- Delete: `open-next-r2-incremental-cache-diagnostics.js`
- Delete: `open-next-r2-incremental-cache-diagnostics.test.ts`
- Test: `open-next.config.test.ts`

**Interfaces:**
- Consumes: The regression contract from Task 1.
- Produces: An OpenNext configuration with dummy incremental cache, tag cache, and queue; no runtime import of the custom R2 adapter or Durable Object cache implementations.

- [ ] **Step 1: Replace the OpenNext configuration with the minimal default configuration**

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

- [ ] **Step 2: Delete the now-unreachable R2 diagnostic adapter and its dedicated test**

Delete only:

```text
open-next-r2-incremental-cache-diagnostics.js
open-next-r2-incremental-cache-diagnostics.test.ts
```

Do not modify `wrangler.jsonc`, `worker-html-cache-version.js`, Durable Object exports, or migration history.

- [ ] **Step 3: Run the focused configuration test**

Run: `npm.cmd test -- open-next.config.test.ts`

Expected: PASS with one test and no missing-module error for the deleted adapter.

- [ ] **Step 4: Search for stale runtime references**

Run:

```powershell
rg -n "open-next-r2-incremental-cache-diagnostics|withRegionalCache|doShardedTagCache|doQueue" open-next.config.ts package.json docs/ai/structure.html
```

Expected: no code reference in `open-next.config.ts`; the documentation reference is addressed in Task 3.

- [ ] **Step 5: Inspect the task diff without committing**

Run: `git diff -- open-next.config.ts open-next.config.test.ts open-next-r2-incremental-cache-diagnostics.js open-next-r2-incremental-cache-diagnostics.test.ts`

Expected: only the minimal configuration, regression test, and deletion of the obsolete adapter/test. Do not commit.

---

### Task 3: Update cache ownership documentation

**Files:**
- Modify: `docs/ai/structure.html`
- Inspect: `docs/superpowers/specs/2026-08-24-disable-r2-incremental-cache-design.md`

**Interfaces:**
- Consumes: The dummy OpenNext cache behavior implemented in Task 2.
- Produces: Project documentation that distinguishes OpenNext incremental caching from the retained R2 HTML version-token store.

- [ ] **Step 1: Replace the OpenNext incremental-cache structure-map entry**

The entry must state all of the following exact behaviors:

```text
OpenNext uses dummy incremental, tag, and queue implementations and performs no persistent ISR/data-cache writes. Public HTML, JSON, and image caching remains owned by the Worker Cache API. NEXT_INC_CACHE_R2_BUCKET remains bound only for low-volume html-cache-versions/ tokens; existing Durable Object configuration and migration history are retained but unused by OpenNext.
```

- [ ] **Step 2: Update targeted verification guidance in the same table row**

Use this verification list:

```text
Run open-next.config.test.ts, worker-html-cache-version.test.ts, worker-cache-policy.test.ts, and lib/__tests__/next-config.test.ts, then run the OpenNext Cloudflare build.
```

- [ ] **Step 3: Run focused cache ownership tests**

Run:

```powershell
npm.cmd test -- open-next.config.test.ts worker-html-cache-version.test.ts worker-cache-policy.test.ts lib/__tests__/next-config.test.ts
```

Expected: all selected test files pass.

- [ ] **Step 4: Check documentation and source diffs**

Run: `git diff --check`

Expected: exit code 0. Line-ending notices are acceptable; whitespace errors are not.

---

### Task 4: Verify the complete production build surface

**Files:**
- Verify only: all changed files from Tasks 1–3

**Interfaces:**
- Consumes: Completed implementation and documentation.
- Produces: Fresh evidence that tests, linting, Next.js compilation, and OpenNext packaging all accept the no-persistent-cache configuration.

- [ ] **Step 1: Run the complete Vitest suite**

Run: `npm.cmd test`

Expected: exit code 0 and zero failed tests.

- [ ] **Step 2: Run ESLint**

Run: `npm.cmd run lint`

Expected: exit code 0. Record any warnings separately; do not claim they were introduced by this change without diff evidence.

- [ ] **Step 3: Run the Next.js production build**

Run: `npm.cmd run build`

Expected: exit code 0 after compilation, TypeScript checks, and static page generation.

- [ ] **Step 4: Run the OpenNext Cloudflare build**

Run: `npm.cmd run build:cf`

Expected: exit code 0 and no requirement to populate the remote R2 incremental cache.

- [ ] **Step 5: Inspect the final worktree**

Run:

```powershell
git diff --check
git status --short
git diff --stat
git diff -- open-next.config.ts open-next.config.test.ts docs/ai/structure.html
```

Expected: no whitespace errors, no unexpected files, no Wrangler binding removal, and no deployment or commit.

- [ ] **Step 6: Record the production follow-up without executing it**

After a separately authorized deployment, compare one-hour Cloudflare error counts and R2 Class A/Class B operations with the pre-change baseline. Do not claim production resolution before that comparison.
