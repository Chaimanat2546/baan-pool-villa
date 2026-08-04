# Local Client Deploy Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a manual Cloudflare deployment from building one client with another client's public environment values.

**Architecture:** Add a tracked PowerShell entry point that accepts one approved Wrangler target. It reads only the matching ignored `.env.<target>.local` file, temporarily sets the five build variables in the current process, validates, builds, deploys, prewarms, then restores the prior process environment values in `finally`.

**Tech Stack:** PowerShell 7+, npm, OpenNext Cloudflare, Vitest static-script contract tests.

## Global Constraints

- Never print environment or secret values.
- Never overwrite `.env`.
- Build once and deploy only the selected target.
- Preserve Cloudflare credentials from the caller process.

---

### Task 1: Add the isolated local deployment command

**Files:**
- Create: `scripts/deploy-client.ps1`
- Create: `scripts/deploy-client.test.ts`
- Modify: `docs/deployment.md`

- [ ] **Step 1: Write the failing test**

Assert the script reads `.env.$Target.local`, has the exact three-target allowlist, sets only the five build variables, validates before build, deploys with `--env $Target`, and restores variables in `finally`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- scripts/deploy-client.test.ts`

Expected: FAIL because the script does not yet exist.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/deploy-client.ps1` with strict mode, safe `.env.<target>.local` parsing, explicit validation, build/deploy/prewarm commands, and process-environment restoration.

- [ ] **Step 4: Update the runbook**

Replace the copy-paste helper with the tracked command and correct the file name to `.env.<target>.local`.

- [ ] **Step 5: Run verification**

Run: `npm.cmd test -- scripts/deploy-client.test.ts scripts/production-deploy-config.test.ts` and `npm.cmd run lint`.
