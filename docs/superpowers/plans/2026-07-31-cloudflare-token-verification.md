# Cloudflare API Token Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each production CD matrix target verify its Cloudflare Bearer API token before validation, build, or Worker deployment.

**Architecture:** Add a credential-scoped GitHub Actions step that makes a quiet failing `curl` request to Cloudflare's token verification endpoint. Expand the existing text-based workflow test to pin down the endpoint, authorization format, credentials scope, and execution order; update the deployment runbook to document the gate.

**Tech Stack:** GitHub Actions YAML, Bash, curl, Vitest, Markdown.

## Global Constraints

- Use `GET https://api.cloudflare.com/client/v4/user/tokens/verify` with `Authorization: Bearer $CLOUDFLARE_API_TOKEN`.
- Do not write `CLOUDFLARE_API_TOKEN` at job scope or expose it to the build step.
- Do not print token values or API response bodies.
- Preserve the existing three-target non-fail-fast deployment matrix.
- Do not change Cloudflare token permissions.

---

### Task 1: Lock the workflow contract with a focused failing test

**Files:**
- Modify: `scripts/production-deploy-workflow.test.ts`

**Interfaces:**
- Consumes: `.github/workflows/deploy-production.yml` as UTF-8 text via `readWorkflow()`.
- Produces: a test requiring a `Verify Cloudflare API token` step before `Validate target configuration`.

- [ ] **Step 1: Add a failing test after the credential-scope test**

```ts
  it("verifies the Cloudflare Bearer token before target validation", async () => {
    const workflow = await readWorkflow();
    const tokenVerificationStep = extractNamedStep(
      workflow,
      "Verify Cloudflare API token",
    );

    expect(tokenVerificationStep).toContain(
      "CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}",
    );
    expect(tokenVerificationStep).not.toContain("CLOUDFLARE_ACCOUNT_ID:");
    expect(tokenVerificationStep).toContain(
      "https://api.cloudflare.com/client/v4/user/tokens/verify",
    );
    expect(tokenVerificationStep).toContain(
      'Authorization: Bearer $CLOUDFLARE_API_TOKEN',
    );
    expect(workflow.indexOf("- name: Verify Cloudflare API token")).toBeLessThan(
      workflow.indexOf("- name: Validate target configuration"),
    );
  });
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm.cmd test -- scripts/production-deploy-workflow.test.ts`

Expected: FAIL because the token verification step does not yet exist.

### Task 2: Add the token verification CD gate

**Files:**
- Modify: `.github/workflows/deploy-production.yml`
- Test: `scripts/production-deploy-workflow.test.ts`

**Interfaces:**
- Consumes: repository secret `CLOUDFLARE_API_TOKEN`.
- Produces: `Verify Cloudflare API token`, a deploy-job step that exits non-zero when Cloudflare rejects the token or the request fails.

- [ ] **Step 1: Add the verification step immediately before `Validate target configuration`**

```yaml
      - name: Verify Cloudflare API token
        shell: bash
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          curl --fail --silent --show-error --output /dev/null \
            --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            https://api.cloudflare.com/client/v4/user/tokens/verify
```

- [ ] **Step 2: Run the focused test to verify it passes**

Run: `npm.cmd test -- scripts/production-deploy-workflow.test.ts`

Expected: PASS.

### Task 3: Document and verify the deployment gate

**Files:**
- Modify: `docs/deployment.md`
- Test: `scripts/production-deploy-workflow.test.ts`

**Interfaces:**
- Consumes: the deployment workflow's `Verify Cloudflare API token` step.
- Produces: a runbook statement that token verification occurs before target validation, build, and deploy.

- [ ] **Step 1: Add this paragraph to `## Normal Release` after the deployment-matrix description**

```md
For each deployment target, CD verifies `CLOUDFLARE_API_TOKEN` through
Cloudflare's `/client/v4/user/tokens/verify` endpoint before target validation,
build, or Worker deployment. The workflow sends the value only as a Bearer
credential and does not print the token or API response.
```

- [ ] **Step 2: Run the focused test**

Run: `npm.cmd test -- scripts/production-deploy-workflow.test.ts`

Expected: PASS.

- [ ] **Step 3: Run full required verification**

Run: `npm.cmd test`

Expected: PASS.

Run: `npm.cmd run lint`

Expected: PASS.

- [ ] **Step 4: Check the final diff**

Run: `git diff --check` and `git diff -- .github/workflows/deploy-production.yml scripts/production-deploy-workflow.test.ts docs/deployment.md`

Expected: no whitespace errors; only the verification gate, its test, and runbook documentation change.
