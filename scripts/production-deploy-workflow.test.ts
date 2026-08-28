import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = fileURLToPath(
  new URL("../.github/workflows/deploy-production.yml", import.meta.url),
);

async function readWorkflow() {
  return (await readFile(WORKFLOW_PATH, "utf8")).replaceAll("\r\n", "\n");
}

const CLOUDFLARE_CREDENTIALS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
];

const BUILD_VARIABLES = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL",
  "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
];

const BUILD_SECRETS = ["SUPABASE_PUBLISHABLE_KEY"];

function extractDeployJobHeader(workflow: string) {
  return extractJobHeader(workflow, "deploy");
}

function extractJobHeader(workflow: string, jobName: string) {
  const jobStart = workflow.indexOf(`\n  ${jobName}:\n`);
  const stepsStart = workflow.indexOf("\n    steps:\n", jobStart);

  expect(jobStart).toBeGreaterThanOrEqual(0);
  expect(stepsStart).toBeGreaterThan(jobStart);

  return workflow.slice(jobStart, stepsStart);
}

function extractNamedStep(workflow: string, name: string) {
  const stepStart = workflow.indexOf(`\n      - name: ${name}\n`);
  const nextStepStart = workflow.indexOf("\n      - name: ", stepStart + 1);

  expect(stepStart).toBeGreaterThanOrEqual(0);

  return workflow.slice(
    stepStart,
    nextStepStart >= 0 ? nextStepStart : workflow.length,
  );
}

describe("production deployment workflow", () => {
  it("runs on pushes and pull requests targeting master with read-only permissions", async () => {
    const workflow = await readWorkflow();

    expect(workflow).toContain(
      "on:\n  push:\n    branches:\n      - master",
    );
    expect(workflow).toContain(
      "  pull_request:\n    branches:\n      - master",
    );
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("group: production-deploy");
    expect(workflow).toContain("cancel-in-progress: false");
  });

  it("pins the official checkout and setup-node actions", async () => {
    const workflow = await readWorkflow();

    expect(workflow).toContain(
      "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6",
    );
    expect(workflow).toContain(
      "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6",
    );
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("node-version: 24");
  });

  it("detects source migration changes only from a reliable pushed commit range", async () => {
    const workflow = await readWorkflow();
    const migrationsStep = extractNamedStep(
      workflow,
      "Detect changed source migrations",
    );

    expect(workflow).toContain(
      "migrations_changed: ${{ steps.migrations.outputs.migrations_changed }}",
    );
    expect(workflow).toContain("fetch-depth: 0");
    expect(migrationsStep).toContain('if [ "$GITHUB_EVENT_NAME" != "push" ]');
    expect(migrationsStep).toContain("migrations_changed=false");
    expect(migrationsStep).toContain('before_sha="${{ github.event.before }}"');
    expect(migrationsStep).toContain('git rev-parse "$after_sha^"');
    expect(migrationsStep).toContain(
      'git diff --name-only "$before_sha" "$after_sha" -- supabase/migrations',
    );
    expect(migrationsStep).toContain(
      "Cannot determine a reliable commit range for migration detection.",
    );
  });

  it("runs the Supabase migration gate per protected target with only migration credentials", async () => {
    const workflow = await readWorkflow();
    const migrateJobHeader = extractJobHeader(workflow, "migrate");
    const migrationStep = extractNamedStep(
      workflow,
      "Link and apply source migrations",
    );
    const migrationSummaryStep = extractNamedStep(
      workflow,
      "Write migration summary",
    );

    expect(migrateJobHeader).toContain("needs: verify");
    expect(migrateJobHeader).toContain(
      "github.event_name == 'push' && needs.verify.outputs.migrations_changed == 'true'",
    );
    expect(migrateJobHeader).toContain("fail-fast: false");
    expect(migrateJobHeader).toContain("max-parallel: 2");
    expect(migrateJobHeader).toContain(
      "matrix: ${{ fromJSON(needs.verify.outputs.matrix) }}",
    );
    expect(migrateJobHeader).toContain("name: ${{ matrix.target }}");
    expect(migrateJobHeader).toContain("timeout-minutes: 30");
    expect(workflow).toContain(
      "supabase/setup-cli@46f7f98c7f948ad727d22c1e67fab04c223a0520 # v3.0.0",
    );
    expect(workflow).toContain("version: 2.115.0");
    expect(migrationStep).toContain(
      "SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}",
    );
    expect(migrationStep).toContain(
      "SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}",
    );
    expect(migrationStep).toContain(
      "BPV_SUPABASE_PROJECT_REF: ${{ matrix.projectRef }}",
    );
    expect(migrationStep).toContain(
      'supabase link --project-ref "$BPV_SUPABASE_PROJECT_REF"',
    );
    expect(migrationStep).toContain("supabase db push --linked --include-all");
    expect(
      [...migrationStep.matchAll(/^          ([A-Z_]+):/gm)].map(
        ([, name]) => name,
      ),
    ).toEqual([
      "SUPABASE_ACCESS_TOKEN",
      "SUPABASE_DB_PASSWORD",
      "BPV_SUPABASE_PROJECT_REF",
    ]);
    expect(migrationStep.match(/secrets\.[^}\s]+/g)).toEqual([
      "secrets.SUPABASE_ACCESS_TOKEN",
      "secrets.SUPABASE_DB_PASSWORD",
    ]);
    expect(migrationSummaryStep).not.toMatch(/secrets\./);
    expect(migrationSummaryStep).not.toContain("SUPABASE_ACCESS_TOKEN");
    expect(migrationSummaryStep).not.toContain("SUPABASE_DB_PASSWORD");
  });

  it("isolates all five deployments through a non-fail-fast matrix", async () => {
    const workflow = await readWorkflow();

    expect(workflow).toContain("matrix: ${{ steps.matrix.outputs.matrix }}");
    expect(workflow).toContain(
      "matrix: ${{ fromJSON(needs.verify.outputs.matrix) }}",
    );
    expect(workflow).toContain("fail-fast: false");
    expect(workflow).toContain("max-parallel: 3");
    expect(workflow).toContain("name: ${{ matrix.target }}");
    expect(workflow).toContain("url: ${{ matrix.siteUrl }}");
  });

  it("uses public variables and the environment-scoped Supabase secret", async () => {
    const workflow = await readWorkflow();

    expect(workflow).toContain(
      "CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}",
    );
    expect(workflow).toContain(
      "CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    );
    expect(workflow).toContain(
      "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL }}",
    );
    expect(workflow).toContain(
      "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY: ${{ vars.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY }}",
    );
    expect(workflow).toContain(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY: ${{ vars.NEXT_PUBLIC_TURNSTILE_SITE_KEY }}",
    );
    expect(workflow).toContain(
      "SUPABASE_PUBLISHABLE_KEY: ${{ secrets.SUPABASE_PUBLISHABLE_KEY }}",
    );
    expect(workflow).not.toContain("CALENDAR_INTERNAL_API_TOKEN:");
    expect(workflow).not.toContain("TURNSTILE_SECRET_KEY:");
    expect(workflow).not.toContain(".env.");
  });

  it("limits deployment credentials and build variables to their named steps", async () => {
    const workflow = await readWorkflow();
    const deployJobHeader = extractDeployJobHeader(workflow);
    const validationStep = extractNamedStep(
      workflow,
      "Validate target configuration",
    );
    const buildStep = extractNamedStep(workflow, "Build OpenNext");
    const deployStep = extractNamedStep(workflow, "Deploy Worker");

    for (const variable of [
      ...CLOUDFLARE_CREDENTIALS,
      ...BUILD_VARIABLES,
      ...BUILD_SECRETS,
    ]) {
      expect(deployJobHeader).not.toContain(`${variable}:`);
    }

    for (const variable of [
      ...CLOUDFLARE_CREDENTIALS,
      ...BUILD_VARIABLES,
      ...BUILD_SECRETS,
    ]) {
      expect(validationStep).toContain(`${variable}:`);
    }

    for (const variable of [...BUILD_VARIABLES, ...BUILD_SECRETS]) {
      expect(buildStep).toContain(`${variable}:`);
    }
    for (const credential of CLOUDFLARE_CREDENTIALS) {
      expect(buildStep).not.toContain(`${credential}:`);
    }

    for (const credential of CLOUDFLARE_CREDENTIALS) {
      expect(deployStep).toContain(`${credential}:`);
    }
    for (const variable of [...BUILD_VARIABLES, ...BUILD_SECRETS]) {
      expect(deployStep).not.toContain(`${variable}:`);
    }
  });

  it("verifies the Cloudflare Bearer token before target validation", async () => {
    const workflow = await readWorkflow();
    const tokenVerificationStep = extractNamedStep(
      workflow,
      "Verify Cloudflare API token",
    );
    const validationStepStart = workflow.indexOf(
      "\n      - name: Validate target configuration\n",
    );
    const tokenVerificationStepStart = workflow.indexOf(
      "\n      - name: Verify Cloudflare API token\n",
    );
    const secretReferences = tokenVerificationStep.match(
      /secrets\.[^}\s]+/g,
    );

    expect(secretReferences).toEqual(["secrets.CLOUDFLARE_API_TOKEN"]);
    expect(tokenVerificationStep).toContain("shell: bash");
    expect(tokenVerificationStep).toContain(
      "https://api.cloudflare.com/client/v4/user/tokens/verify",
    );
    expect(tokenVerificationStep).toContain(
      "Authorization: Bearer $CLOUDFLARE_API_TOKEN",
    );
    expect(tokenVerificationStep).toContain(
      "JSON.parse(body).success === true",
    );
    expect(tokenVerificationStepStart).toBeLessThan(validationStepStart);
  });

  it("builds, dry-runs on pull requests, deploys on pushes, and always writes a summary without prewarming", async () => {
    const workflow = await readWorkflow();
    const deployJobHeader = extractDeployJobHeader(workflow);

    expect(deployJobHeader).toContain("needs:\n      - verify\n      - migrate");
    expect(deployJobHeader).toContain(
      "if: ${{ !cancelled() && always() && needs.verify.result == 'success' && (needs.migrate.result == 'success' || needs.migrate.result == 'skipped') }}",
    );
    expect(workflow).toContain("npm run build:cf");
    expect(workflow).toContain(
      'npm run deploy:cf:built -- --env "$BPV_DEPLOY_TARGET"',
    );
    expect(workflow).toContain('if [ "$GITHUB_EVENT_NAME" = "pull_request" ]');
    expect(workflow).toContain(
      'npm run deploy:cf:built -- --env "$BPV_DEPLOY_TARGET" --dry-run',
    );
    expect(workflow).toContain('else\n            npm run deploy:cf:built -- --env "$BPV_DEPLOY_TARGET"');
    expect(workflow).not.toContain("prewarm");
    expect(workflow).toContain("if: ${{ always() }}");
    expect(workflow).not.toContain("cloudflare/wrangler-action");
    expect(workflow).not.toContain("actions/upload-artifact");
  });
});
