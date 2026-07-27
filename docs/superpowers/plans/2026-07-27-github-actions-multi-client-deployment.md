# GitHub Actions Multi-Client Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy `baanparty`, `baan02`, and `baanPMhee` automatically after one merge to `master`, with isolated client builds and independently rerunnable failures.

**Architecture:** A tested Node helper owns the approved production target matrix and validates it against `wrangler.jsonc`. One GitHub Actions workflow verifies the repository once, then runs three parallel OpenNext build/deploy/prewarm jobs using GitHub Environments for public client build variables and Cloudflare for runtime secrets.

**Tech Stack:** GitHub Actions, Node.js 24, npm, Vitest, TypeScript JSONC parsing, Next.js 16, OpenNext Cloudflare 1.19, Wrangler 4.

## Global Constraints

- Automatic deployment is triggered only by a push to `master`.
- The approved Wrangler environment names are exactly `baanparty`, `baan02`, and `baanPMhee`.
- One merge produces three independent OpenNext builds because `NEXT_PUBLIC_*` values are frozen at build time.
- Matrix deployment uses `fail-fast: false` and `max-parallel: 3`.
- A failed client does not roll back successful clients.
- Automatic rollback is not allowed.
- GitHub Actions workflow permissions remain `contents: read`.
- Repository secrets are exactly `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
- GitHub Environment build variables are exactly `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL`, `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- `NEXT_PUBLIC_SITE_URL` is public, version-controlled target metadata and must match `wrangler.jsonc`.
- Runtime credentials remain Cloudflare Worker secrets; the workflow must not create an `.env` file.
- No build output or credential-bearing file is uploaded as a GitHub artifact.
- Use the standard Ubuntu runner and Node.js 24.
- Preserve all unrelated working-tree changes.
- Do not run `git commit`, push, merge, create a PR, modify GitHub settings, or modify Cloudflare secrets unless the user explicitly authorizes that external or Git action during execution.
- Because commits are not currently authorized, each task ends at a review checkpoint rather than a commit.

## File Structure

- Create `scripts/production-deploy-config.mjs`: production target source of truth, Wrangler JSONC validation, required-variable validation, and matrix CLI.
- Create `scripts/production-deploy-config.test.ts`: focused tests for target mapping, Wrangler parity, required secrets, and secret-safe errors.
- Create `scripts/production-deploy-workflow.test.ts`: static contract tests for the production workflow's trigger, permissions, matrix, commands, and failure isolation.
- Create `.github/workflows/deploy-production.yml`: one verify job followed by the three-client deployment matrix.
- Create `docs/deployment.md`: one-time setup, normal release, retry, rollback, and troubleshooting runbook.
- Modify `wrangler.jsonc`: declare the complete required runtime secret list for every production environment.
- Modify `.env.example`: document `CALENDAR_INTERNAL_API_TOKEN` as a required local/runtime name without a value.
- Modify `package.json`: add separate Cloudflare build, built-output deploy, and deployment-config validation scripts.
- Modify `README.md`: make GitHub Actions the normal production release path and link the runbook.
- Modify `docs/ai/structure.html`: map the workflow/helper owners and their verification commands.

---

### Task 1: Production Deployment Configuration Contract

**Files:**

- Create: `scripts/production-deploy-config.mjs`
- Create: `scripts/production-deploy-config.test.ts`
- Modify: `wrangler.jsonc:85-91`
- Modify: `wrangler.jsonc:152-158`
- Modify: `wrangler.jsonc:219-225`
- Modify: `.env.example:1-10`
- Modify: `package.json:5-17`

**Interfaces:**

- Produces: `PRODUCTION_DEPLOYMENT_TARGETS: readonly { target: string; siteUrl: string }[]`
- Produces: `REQUIRED_BUILD_ENVIRONMENT_VARIABLES: readonly string[]`
- Produces: `REQUIRED_RUNTIME_SECRETS: readonly string[]`
- Produces: `createDeploymentMatrix(): { include: { target: string; siteUrl: string }[] }`
- Produces: `parseWranglerConfig(source: string, filename?: string): Record<string, unknown>`
- Produces: `validateWranglerDeploymentConfig(config: Record<string, unknown>): true`
- Produces: `validateBuildEnvironment(target: string, env?: NodeJS.ProcessEnv): { target: string; siteUrl: string }`
- Produces CLI: `node scripts/production-deploy-config.mjs matrix`
- Produces CLI: `node scripts/production-deploy-config.mjs validate`
- Produces CLI: `node scripts/production-deploy-config.mjs validate baanparty`

- [ ] **Step 1: Write the failing deployment-config tests**

Create `scripts/production-deploy-config.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  PRODUCTION_DEPLOYMENT_TARGETS,
  REQUIRED_BUILD_ENVIRONMENT_VARIABLES,
  REQUIRED_RUNTIME_SECRETS,
  createDeploymentMatrix,
  parseWranglerConfig,
  validateBuildEnvironment,
  validateWranglerDeploymentConfig,
} from "./production-deploy-config.mjs";

const WRANGLER_CONFIG_PATH = fileURLToPath(
  new URL("../wrangler.jsonc", import.meta.url),
);

type WranglerTestConfig = Record<string, unknown> & {
  env: Record<
    string,
    {
      vars: Record<string, string>;
      secrets: { required: string[] };
    }
  >;
};

function createValidBuildEnvironment(): NodeJS.ProcessEnv {
  return {
    CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
    CLOUDFLARE_API_TOKEN: "cloudflare-api-token-value",
    NEXT_PUBLIC_SITE_URL: "https://www.baanpartypattaya.com",
    NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY:
      "supabase-publishable-key",
    NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL:
      "https://project-ref.supabase.co",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site-key",
  };
}

async function readCurrentWranglerConfig(): Promise<WranglerTestConfig> {
  const source = await readFile(WRANGLER_CONFIG_PATH, "utf8");

  return parseWranglerConfig(
    source,
    WRANGLER_CONFIG_PATH,
  ) as WranglerTestConfig;
}

describe("production deployment config", () => {
  it("builds the exact approved GitHub Actions matrix", () => {
    expect(createDeploymentMatrix()).toEqual({
      include: [
        {
          target: "baanparty",
          siteUrl: "https://www.baanpartypattaya.com",
        },
        {
          target: "baan02",
          siteUrl: "https://www.poolvillapattaya.co.th",
        },
        {
          target: "baanPMhee",
          siteUrl: "https://baan-pool-villa03.poolvilla.workers.dev",
        },
      ],
    });
  });

  it("keeps the required names explicit and secret values out of config", () => {
    expect(PRODUCTION_DEPLOYMENT_TARGETS).toHaveLength(3);
    expect(REQUIRED_BUILD_ENVIRONMENT_VARIABLES).toEqual([
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_API_TOKEN",
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL",
      "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    ]);
    expect(REQUIRED_RUNTIME_SECRETS).toEqual([
      "CALENDAR_INTERNAL_API_TOKEN",
      "DEVILLE_BEARER_TOKEN",
      "PATTAYA_BOOKINGS_API_TOKEN",
      "SUPABASE_PUBLISHABLE_KEY",
      "TURNSTILE_SECRET_KEY",
    ]);
  });

  it("matches every approved target and site URL to wrangler.jsonc", async () => {
    const config = await readCurrentWranglerConfig();

    expect(validateWranglerDeploymentConfig(config)).toBe(true);
  });

  it("rejects a missing required runtime secret declaration", async () => {
    const config = structuredClone(await readCurrentWranglerConfig());
    const environment = config.env.baanparty;

    environment.secrets.required = REQUIRED_RUNTIME_SECRETS.filter(
      (name) => name !== "TURNSTILE_SECRET_KEY",
    );

    expect(() => validateWranglerDeploymentConfig(config)).toThrow(
      "baanparty is missing required secret declaration: TURNSTILE_SECRET_KEY",
    );
  });

  it("rejects a canonical site URL mismatch", async () => {
    const config = structuredClone(await readCurrentWranglerConfig());

    config.env.baan02.vars.NEXT_PUBLIC_SITE_URL =
      "https://wrong.poolvillapattaya.co.th";

    expect(() => validateWranglerDeploymentConfig(config)).toThrow(
      "baan02 has a NEXT_PUBLIC_SITE_URL mismatch",
    );
  });

  it("validates a complete build environment", () => {
    expect(
      validateBuildEnvironment("baanparty", createValidBuildEnvironment()),
    ).toEqual({
      target: "baanparty",
      siteUrl: "https://www.baanpartypattaya.com",
    });
  });

  it("rejects a build URL that belongs to another client", () => {
    const env = createValidBuildEnvironment();
    env.NEXT_PUBLIC_SITE_URL = "https://www.poolvillapattaya.co.th";

    expect(() => validateBuildEnvironment("baanparty", env)).toThrow(
      "NEXT_PUBLIC_SITE_URL does not match baanparty",
    );
  });

  it("reports missing names without exposing configured values", () => {
    const env = createValidBuildEnvironment();
    const sensitiveValue = env.CLOUDFLARE_API_TOKEN ?? "";

    env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "";

    let message = "";

    try {
      validateBuildEnvironment("baanparty", env);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    expect(message).not.toContain(sensitiveValue);
  });

  it("rejects an unknown deployment target", () => {
    expect(() =>
      validateBuildEnvironment("unapproved-client", createValidBuildEnvironment()),
    ).toThrow("Unknown production deployment target: unapproved-client");
  });
});
```

- [ ] **Step 2: Run the targeted test and confirm the module is missing**

Run:

```powershell
npm.cmd test -- scripts/production-deploy-config.test.ts
```

Expected: FAIL because `scripts/production-deploy-config.mjs` does not exist.

- [ ] **Step 3: Implement the deployment-config helper**

Create `scripts/production-deploy-config.mjs`:

```js
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const WRANGLER_CONFIG_PATH = fileURLToPath(
  new URL("../wrangler.jsonc", import.meta.url),
);

export const PRODUCTION_DEPLOYMENT_TARGETS = Object.freeze([
  Object.freeze({
    target: "baanparty",
    siteUrl: "https://www.baanpartypattaya.com",
  }),
  Object.freeze({
    target: "baan02",
    siteUrl: "https://www.poolvillapattaya.co.th",
  }),
  Object.freeze({
    target: "baanPMhee",
    siteUrl: "https://baan-pool-villa03.poolvilla.workers.dev",
  }),
]);

export const REQUIRED_BUILD_ENVIRONMENT_VARIABLES = Object.freeze([
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL",
  "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
]);

export const REQUIRED_RUNTIME_SECRETS = Object.freeze([
  "CALENDAR_INTERNAL_API_TOKEN",
  "DEVILLE_BEARER_TOKEN",
  "PATTAYA_BOOKINGS_API_TOKEN",
  "SUPABASE_PUBLISHABLE_KEY",
  "TURNSTILE_SECRET_KEY",
]);

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeHttpsOrigin(variableName, value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid ${variableName}: expected an HTTPS origin.`);
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`Invalid ${variableName}: expected an HTTPS origin.`);
  }

  return url.origin;
}

export function createDeploymentMatrix(
  targets = PRODUCTION_DEPLOYMENT_TARGETS,
) {
  return {
    include: targets.map(({ target, siteUrl }) => ({ target, siteUrl })),
  };
}

export function parseWranglerConfig(source, filename = "wrangler.jsonc") {
  const parsed = ts.parseConfigFileTextToJson(filename, source);

  if (parsed.error) {
    const detail = ts.flattenDiagnosticMessageText(
      parsed.error.messageText,
      "\n",
    );

    throw new Error(`Invalid ${filename}: ${detail}`);
  }

  if (!isRecord(parsed.config)) {
    throw new Error(`Invalid ${filename}: expected a JSON object.`);
  }

  return parsed.config;
}

export function validateWranglerDeploymentConfig(
  config,
  targets = PRODUCTION_DEPLOYMENT_TARGETS,
  requiredSecrets = REQUIRED_RUNTIME_SECRETS,
) {
  if (!isRecord(config.env)) {
    throw new Error("wrangler.jsonc is missing the env object.");
  }

  const errors = [];

  for (const { target, siteUrl } of targets) {
    const targetConfig = config.env[target];

    if (!isRecord(targetConfig)) {
      errors.push(`wrangler.jsonc is missing environment: ${target}`);
      continue;
    }

    let expectedOrigin;
    let configuredOrigin;

    try {
      expectedOrigin = normalizeHttpsOrigin(`${target}.siteUrl`, siteUrl);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    const configuredSiteUrl = isRecord(targetConfig.vars)
      ? targetConfig.vars.NEXT_PUBLIC_SITE_URL
      : undefined;

    try {
      configuredOrigin = normalizeHttpsOrigin(
        `${target}.vars.NEXT_PUBLIC_SITE_URL`,
        configuredSiteUrl,
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    if (configuredOrigin !== expectedOrigin) {
      errors.push(`${target} has a NEXT_PUBLIC_SITE_URL mismatch.`);
    }

    const declaredSecrets =
      isRecord(targetConfig.secrets) &&
      Array.isArray(targetConfig.secrets.required)
        ? new Set(targetConfig.secrets.required)
        : new Set();
    const missingSecrets = requiredSecrets.filter(
      (name) => !declaredSecrets.has(name),
    );

    if (missingSecrets.length > 0) {
      errors.push(
        `${target} is missing required secret declaration: ${missingSecrets.join(
          ", ",
        )}`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return true;
}

export function validateBuildEnvironment(
  target,
  env = process.env,
  targets = PRODUCTION_DEPLOYMENT_TARGETS,
) {
  const targetConfig = targets.find((candidate) => candidate.target === target);

  if (!targetConfig) {
    throw new Error(`Unknown production deployment target: ${target}`);
  }

  const missingNames = REQUIRED_BUILD_ENVIRONMENT_VARIABLES.filter(
    (name) => typeof env[name] !== "string" || env[name].trim() === "",
  );

  if (missingNames.length > 0) {
    throw new Error(
      `Missing required deployment environment variables for ${target}: ${missingNames.join(
        ", ",
      )}`,
    );
  }

  if (!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID.trim())) {
    throw new Error(
      "Invalid CLOUDFLARE_ACCOUNT_ID: expected a 32-character hexadecimal account id.",
    );
  }

  const buildSiteUrl = normalizeHttpsOrigin(
    "NEXT_PUBLIC_SITE_URL",
    env.NEXT_PUBLIC_SITE_URL.trim(),
  );

  if (buildSiteUrl !== targetConfig.siteUrl) {
    throw new Error(`NEXT_PUBLIC_SITE_URL does not match ${target}.`);
  }

  normalizeHttpsOrigin(
    "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL",
    env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL.trim(),
  );

  return targetConfig;
}

export async function readWranglerConfig(
  configPath = WRANGLER_CONFIG_PATH,
) {
  const source = await readFile(configPath, "utf8");

  return parseWranglerConfig(source, configPath);
}

export async function runCli(argv, env = process.env) {
  const [command, target, ...extraArguments] = argv;

  if (extraArguments.length > 0) {
    throw new Error(
      "Usage: node scripts/production-deploy-config.mjs matrix | validate [baanparty|baan02|baanPMhee]",
    );
  }

  const config = await readWranglerConfig();
  validateWranglerDeploymentConfig(config);

  if (command === "matrix" && !target) {
    return JSON.stringify(createDeploymentMatrix());
  }

  if (command === "validate") {
    if (target) {
      validateBuildEnvironment(target, env);

      return `Validated production deployment target: ${target}`;
    }

    return `Validated ${PRODUCTION_DEPLOYMENT_TARGETS.length} production deployment targets.`;
  }

  throw new Error(
    "Usage: node scripts/production-deploy-config.mjs matrix | validate [baanparty|baan02|baanPMhee]",
  );
}

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  runCli(process.argv.slice(2))
    .then((output) => {
      process.stdout.write(`${output}\n`);
    })
    .catch((error) => {
      console.error(
        error instanceof Error
          ? error.message
          : "Unknown deployment configuration error.",
      );
      process.exitCode = 1;
    });
}
```

- [ ] **Step 4: Run the targeted test and expose the incomplete Wrangler declarations**

Run:

```powershell
npm.cmd test -- scripts/production-deploy-config.test.ts
```

Expected: FAIL because the three current `secrets.required` arrays do not yet
contain `PATTAYA_BOOKINGS_API_TOKEN` and `TURNSTILE_SECRET_KEY`.

- [ ] **Step 5: Complete the required-secret declarations**

Replace each of the three `wrangler.jsonc` `secrets.required` arrays with:

```jsonc
"secrets": {
  "required": [
    "CALENDAR_INTERNAL_API_TOKEN",
    "DEVILLE_BEARER_TOKEN",
    "PATTAYA_BOOKINGS_API_TOKEN",
    "SUPABASE_PUBLISHABLE_KEY",
    "TURNSTILE_SECRET_KEY"
  ]
}
```

Do not add secret values to `wrangler.jsonc`.

- [ ] **Step 6: Complete the example environment contract**

Add `CALENDAR_INTERNAL_API_TOKEN=` to `.env.example` so the required section is:

```dotenv
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL=
NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY=

NEXT_PUBLIC_TURNSTILE_SITE_KEY=
CALENDAR_INTERNAL_API_TOKEN=
DEVILLE_BEARER_TOKEN=
PATTAYA_BOOKINGS_API_TOKEN=
SUPABASE_PUBLISHABLE_KEY=
TURNSTILE_SECRET_KEY=
```

- [ ] **Step 7: Add reusable package scripts**

Add these scripts to `package.json` without removing the existing manual
commands:

```json
"build:cf": "opennextjs-cloudflare build",
"deploy:cf:built": "opennextjs-cloudflare deploy",
"validate:deploy:cf": "node scripts/production-deploy-config.mjs validate"
```

Keep `preview:cf`, `deploy:cf`, `deploy:cf:prewarm`, `prewarm:cf`, and
`upload:cf` unchanged for local recovery use.

- [ ] **Step 8: Run the focused contract tests**

Run:

```powershell
npm.cmd test -- scripts/production-deploy-config.test.ts
npm.cmd run validate:deploy:cf
```

Expected:

- the Vitest file passes;
- validation prints `Validated 3 production deployment targets.`;
- no secret value appears in either output.

- [ ] **Step 9: Review checkpoint without committing**

Run:

```powershell
git diff -- .env.example package.json wrangler.jsonc scripts/production-deploy-config.mjs scripts/production-deploy-config.test.ts
git status --short
```

Confirm only the files in this task plus pre-existing user changes are present.
Do not stage or commit.

---

### Task 2: Production GitHub Actions Workflow

**Files:**

- Create: `.github/workflows/deploy-production.yml`
- Create: `scripts/production-deploy-workflow.test.ts`
- Consume: `scripts/production-deploy-config.mjs`
- Consume: package scripts `build:cf`, `deploy:cf:built`, `prewarm:cf`, and `validate:deploy:cf`

**Interfaces:**

- Consumes: `node scripts/production-deploy-config.mjs matrix`
- Consumes: `npm run validate:deploy:cf -- "$BPV_DEPLOY_TARGET"`
- Consumes GitHub repository secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
- Consumes GitHub Environment variables: `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL`, `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- Produces: one GitHub deployment job per matrix target
- Produces: secret-free job summaries for validation, build, deploy, and prewarm outcomes

- [ ] **Step 1: Write the failing workflow contract tests**

Create `scripts/production-deploy-workflow.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = fileURLToPath(
  new URL("../.github/workflows/deploy-production.yml", import.meta.url),
);

async function readWorkflow() {
  return (await readFile(WORKFLOW_PATH, "utf8")).replaceAll("\r\n", "\n");
}

describe("production deployment workflow", () => {
  it("runs automatically only from master with read-only permissions", async () => {
    const workflow = await readWorkflow();

    expect(workflow).toContain(
      "on:\n  push:\n    branches:\n      - master",
    );
    expect(workflow).not.toContain("pull_request:");
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

  it("isolates all three deployments through a non-fail-fast matrix", async () => {
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

  it("uses GitHub variables only for public build configuration", async () => {
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
    expect(workflow).not.toContain("CALENDAR_INTERNAL_API_TOKEN:");
    expect(workflow).not.toContain("TURNSTILE_SECRET_KEY:");
    expect(workflow).not.toContain(".env.");
  });

  it("builds, deploys, prewarms, and always writes a summary", async () => {
    const workflow = await readWorkflow();

    expect(workflow).toContain("npm run build:cf");
    expect(workflow).toContain(
      'npm run deploy:cf:built -- --env "$BPV_DEPLOY_TARGET"',
    );
    expect(workflow).toContain(
      'npm run prewarm:cf -- --url="$BPV_DEPLOY_SITE_URL"',
    );
    expect(workflow).toContain("if: ${{ always() }}");
    expect(workflow).not.toContain("cloudflare/wrangler-action");
    expect(workflow).not.toContain("actions/upload-artifact");
  });
});
```

- [ ] **Step 2: Run the workflow test and confirm the file is missing**

Run:

```powershell
npm.cmd test -- scripts/production-deploy-workflow.test.ts
```

Expected: FAIL with an `ENOENT` error for
`.github/workflows/deploy-production.yml`.

- [ ] **Step 3: Create the production deployment workflow**

Create `.github/workflows/deploy-production.yml`:

```yaml
name: Deploy production clients

on:
  push:
    branches:
      - master

permissions:
  contents: read

concurrency:
  group: production-deploy
  cancel-in-progress: false

jobs:
  verify:
    name: Verify
    runs-on: ubuntu-latest
    timeout-minutes: 30
    outputs:
      matrix: ${{ steps.matrix.outputs.matrix }}
    steps:
      - name: Check out repository
        uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
        with:
          persist-credentials: false

      - name: Set up Node.js
        uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Validate production deployment config
        run: npm run validate:deploy:cf

      - name: Run ESLint
        run: npm run lint

      - name: Run Vitest
        run: npm test

      - name: Build deployment matrix
        id: matrix
        shell: bash
        run: |
          matrix="$(node scripts/production-deploy-config.mjs matrix)"
          printf 'matrix=%s\n' "$matrix" >> "$GITHUB_OUTPUT"

  deploy:
    name: Deploy ${{ matrix.target }}
    needs: verify
    runs-on: ubuntu-latest
    timeout-minutes: 60
    strategy:
      fail-fast: false
      max-parallel: 3
      matrix: ${{ fromJSON(needs.verify.outputs.matrix) }}
    environment:
      name: ${{ matrix.target }}
      url: ${{ matrix.siteUrl }}
    env:
      BPV_DEPLOY_TARGET: ${{ matrix.target }}
      BPV_DEPLOY_SITE_URL: ${{ matrix.siteUrl }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      NEXT_PUBLIC_SITE_URL: ${{ matrix.siteUrl }}
      NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL }}
      NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY: ${{ vars.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY }}
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: ${{ vars.NEXT_PUBLIC_TURNSTILE_SITE_KEY }}
    steps:
      - name: Check out repository
        uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
        with:
          persist-credentials: false

      - name: Set up Node.js
        uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Validate target configuration
        id: validate
        shell: bash
        run: npm run validate:deploy:cf -- "$BPV_DEPLOY_TARGET"

      - name: Build OpenNext
        id: build
        run: npm run build:cf

      - name: Deploy Worker
        id: deploy
        shell: bash
        run: npm run deploy:cf:built -- --env "$BPV_DEPLOY_TARGET"

      - name: Prewarm and verify public HTML
        id: prewarm
        shell: bash
        run: npm run prewarm:cf -- --url="$BPV_DEPLOY_SITE_URL"

      - name: Write deployment summary
        if: ${{ always() }}
        shell: bash
        env:
          VALIDATE_OUTCOME: ${{ steps.validate.outcome }}
          BUILD_OUTCOME: ${{ steps.build.outcome }}
          DEPLOY_OUTCOME: ${{ steps.deploy.outcome }}
          PREWARM_OUTCOME: ${{ steps.prewarm.outcome }}
        run: |
          {
            echo "### Production deployment: \`$BPV_DEPLOY_TARGET\`"
            echo
            echo "- Commit: \`$GITHUB_SHA\`"
            echo "- URL: $BPV_DEPLOY_SITE_URL"
            echo "- Validate: ${VALIDATE_OUTCOME:-not-run}"
            echo "- Build: ${BUILD_OUTCOME:-not-run}"
            echo "- Deploy: ${DEPLOY_OUTCOME:-not-run}"
            echo "- Prewarm: ${PREWARM_OUTCOME:-not-run}"
          } >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 4: Run the focused workflow and config tests**

Run:

```powershell
npm.cmd test -- scripts/production-deploy-workflow.test.ts scripts/production-deploy-config.test.ts
npm.cmd run validate:deploy:cf
```

Expected: both Vitest files pass and the config validator reports three
production targets.

- [ ] **Step 5: Inspect the YAML and whitespace**

Run:

```powershell
git diff --check
Get-Content -Raw .github/workflows/deploy-production.yml
```

Confirm:

- only `master` is under `on.push.branches`;
- there is no `pull_request` deployment trigger;
- the `verify` job has no `environment` or production secrets;
- the `deploy` job has the dynamic GitHub Environment;
- matrix `fail-fast` is false;
- all official actions use the reviewed full commit SHA;
- there is no artifact upload.

- [ ] **Step 6: Review checkpoint without committing**

Run:

```powershell
git diff -- .github/workflows/deploy-production.yml scripts/production-deploy-workflow.test.ts
git status --short
```

Do not stage or commit.

---

### Task 3: Deployment Runbook and Architecture Map

**Files:**

- Create: `docs/deployment.md`
- Modify: `README.md:46-91`
- Modify: `README.md:156-189`
- Modify: `docs/ai/structure.html:692-696`

**Interfaces:**

- Consumes: the final workflow, helper CLI, GitHub Environment names, and required secret lists.
- Produces: one operator runbook for initial setup, normal releases, failed-job reruns, and explicit rollback.
- Produces: architecture-map ownership and targeted verification guidance.

- [ ] **Step 1: Write the deployment runbook**

Create `docs/deployment.md` with these exact sections and contracts:

```markdown
# Production Deployment Runbook

## Normal Release

Production deploys automatically after a pull request is merged into `master`.
The `Deploy production clients` workflow verifies the repository once, then
builds and deploys `baanparty`, `baan02`, and `baanPMhee` independently.

Do not copy a client `.env` file over `.env` for production deployment.

## Configuration Ownership

| Scope | Names | Owner |
| --- | --- | --- |
| GitHub repository secrets | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Repository Actions settings |
| GitHub Environment variables | `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL`, `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Matching `baanparty`, `baan02`, or `baanPMhee` environment |
| Version-controlled public URL | `NEXT_PUBLIC_SITE_URL` | `scripts/production-deploy-config.mjs` and matching `wrangler.jsonc` environment |
| Cloudflare Worker secrets | `CALENDAR_INTERNAL_API_TOKEN`, `DEVILLE_BEARER_TOKEN`, `PATTAYA_BOOKINGS_API_TOKEN`, `SUPABASE_PUBLISHABLE_KEY`, `TURNSTILE_SECRET_KEY` | Matching Wrangler environment |

Never place Cloudflare Worker secret values in GitHub variables, workflow YAML,
documentation, command arguments, or logs.

## One-Time GitHub Setup

1. Add repository secrets `CLOUDFLARE_ACCOUNT_ID` and
   `CLOUDFLARE_API_TOKEN`.
2. Create GitHub Environments named `baanparty`, `baan02`, and `baanPMhee`.
3. Restrict each environment to deployments from `master`.
4. Do not add a required-reviewer gate; the approved release is automatic.
5. Add the three public build variables to each matching environment.
6. Complete this setup before merging the workflow file because that merge
   triggers the first production deployment.

## Cloudflare Token Scope

Use one token scoped to the production account with:

- `Workers Scripts Write`
- `Workers R2 Storage Write`
- `Account Settings Read`

Do not add zone permissions while routes remain outside `wrangler.jsonc`.

## Pre-Merge Checks

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run validate:deploy:cf
```

Verify Cloudflare secret names without printing their values:

```powershell
npx.cmd wrangler secret list --env baanparty --format json
npx.cmd wrangler secret list --env baan02 --format json
npx.cmd wrangler secret list --env baanPMhee --format json
```

## Failed Deployment

Open the failed workflow run and choose **Re-run failed jobs**. Successful
matrix jobs stay unchanged; the failed target rebuilds and deploys the same
commit SHA.

If prewarm fails after deploy, the Worker remains deployed. Inspect the job
summary to distinguish build, deploy, and prewarm outcomes.

## Rollback

Rollback is explicit and target-specific. Run only the command for the affected
Worker:

```powershell
npx.cmd wrangler rollback --env baanparty
npx.cmd wrangler rollback --env baan02
npx.cmd wrangler rollback --env baanPMhee
```

Never roll back all clients automatically because one client failed.

## Manual Recovery Deployment

GitHub Actions is the normal release path. For an explicitly approved emergency
deployment, provide the correct public build environment locally, then run:

```powershell
# baanparty build
npm.cmd run build:cf
npm.cmd run deploy:cf:built -- --env baanparty
npm.cmd run prewarm:cf -- --url=https://www.baanpartypattaya.com
```

For `baan02`, load only `.env.baan02` public build values before running:

```powershell
npm.cmd run build:cf
npm.cmd run deploy:cf:built -- --env baan02
npm.cmd run prewarm:cf -- --url=https://www.poolvillapattaya.co.th
```

For `baanPMhee`, load only `.env.baanPMhee` public build values before running:

```powershell
npm.cmd run build:cf
npm.cmd run deploy:cf:built -- --env baanPMhee
npm.cmd run prewarm:cf -- --url=https://baan-pool-villa03.poolvilla.workers.dev
```

Never deploy a build produced with another client's public variables.
```

The final sentence in the manual recovery section is explanatory, not
permission to deploy from the implementation session.

- [ ] **Step 2: Update README environment and command ownership**

In `README.md`:

1. Add `CALENDAR_INTERNAL_API_TOKEN` to the required environment table with
   purpose `Private booking-calendar Worker/route authentication` and exposure
   `Server-only secret`.
2. Add these rows to **Common Commands**:

```markdown
| `npm.cmd run build:cf` | Build OpenNext Cloudflare output without deploying |
| `npm.cmd run deploy:cf:built -- --env baanparty` | Deploy existing OpenNext output to the named approved Wrangler environment; use `baan02` or `baanPMhee` only with its matching build |
| `npm.cmd run validate:deploy:cf` | Validate production target URLs and required secret declarations |
```

3. Replace the current **Typical release path** with:

```markdown
Normal production releases run through
`.github/workflows/deploy-production.yml`: merge once to `master`, verify once,
then build/deploy/prewarm all three clients through isolated matrix jobs.

Complete one-time GitHub and Cloudflare setup before the workflow's first
merge. See [`docs/deployment.md`](docs/deployment.md) for configuration
ownership, retry, rollback, and emergency recovery.
```

4. Replace the outdated statement that only two Worker secrets are required
with the complete five-name list from `REQUIRED_RUNTIME_SECRETS`.

- [ ] **Step 3: Update the architecture map**

Extend the existing Cloudflare Worker row in `docs/ai/structure.html` so its
owner cell starts with:

```html
<code>worker.js</code>, <code>worker-cache-policy.js</code>,
<code>worker-calendar-access.js</code>,
<code>worker-html-cache-version.js</code>,
<code>scripts/prewarm-public-html.mjs</code>,
<code>scripts/production-deploy-config.mjs</code>, and
<code>.github/workflows/deploy-production.yml</code>
```

Add this deployment ownership paragraph to that row:

```html
Production delivery is triggered only by a push to <code>master</code>. One
verification job emits the validated three-client matrix, then isolated
<code>baanparty</code>, <code>baan02</code>, and <code>baanPMhee</code> jobs
build with their GitHub Environment public variables, deploy through the
matching Wrangler environment, and run bounded HTML prewarm verification.
Matrix failures do not cancel sibling clients, runtime secret values remain in
Cloudflare, and rollback stays explicit per Worker.
```

Add these tests to the row's verification cell:

```html
<code>scripts/production-deploy-config.test.ts</code> and
<code>scripts/production-deploy-workflow.test.ts</code>
```

- [ ] **Step 4: Verify documentation consistency**

Run:

```powershell
rg -n "CALENDAR_INTERNAL_API_TOKEN|PATTAYA_BOOKINGS_API_TOKEN|TURNSTILE_SECRET_KEY|deploy-production|production-deploy-config|Re-run failed jobs" README.md docs/deployment.md docs/ai/structure.html wrangler.jsonc
rg -n "npm.cmd run deploy:cf:prewarm|Typical release path" README.md docs/deployment.md
git diff --check
```

Expected:

- all five runtime secret names appear in the deployment documentation;
- GitHub Actions is documented as the normal release path;
- manual deployment remains explicitly an approved emergency path;
- no secret values appear.

- [ ] **Step 5: Review checkpoint without committing**

Run:

```powershell
git diff -- README.md docs/deployment.md docs/ai/structure.html
git status --short
```

Do not stage or commit.

---

### Task 4: Local Release-Candidate Verification

**Files:**

- Verify only; no intended file changes.
- Consume ignored local files: `.env.baanparty`, `.env.baan02`, `.env.baanPMhee`

**Interfaces:**

- Consumes: all code, workflow, config, and documentation from Tasks 1-3.
- Produces: local evidence that tests, lint, Next.js build, and all three
  client-specific OpenNext builds succeed without deploying.

- [ ] **Step 1: Run focused deployment tests**

Run:

```powershell
npm.cmd test -- scripts/production-deploy-config.test.ts scripts/production-deploy-workflow.test.ts scripts/prewarm-public-html.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the complete Vitest suite**

Run:

```powershell
npm.cmd test
```

Expected: PASS with no deployment API call.

- [ ] **Step 3: Run ESLint**

Run:

```powershell
npm.cmd run lint
```

Expected: exit code 0.

- [ ] **Step 4: Run the standard Next.js production build**

Run:

```powershell
npm.cmd run build
```

Expected: exit code 0.

- [ ] **Step 5: Define a secret-safe local client build helper**

Run this PowerShell block in the current terminal. It reads only the four
approved public keys from each ignored client file, does not print their values,
and restores the previous process environment after every build:

```powershell
function Get-ClientPublicBuildEnvironment {
  param(
    [Parameter(Mandatory)]
    [ValidateSet("baanparty", "baan02", "baanPMhee")]
    [string]$Target
  )

  $requiredNames = @(
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL",
    "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY"
  )
  $values = @{}

  foreach ($line in Get-Content -LiteralPath ".env.$Target") {
    $trimmed = $line.Trim()

    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $separator = $trimmed.IndexOf("=")

    if ($separator -lt 1) {
      continue
    }

    $name = $trimmed.Substring(0, $separator).Trim()

    if ($requiredNames -notcontains $name) {
      continue
    }

    $value = $trimmed.Substring($separator + 1).Trim()

    if (
      $value.Length -ge 2 -and
      (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      )
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$name] = $value
  }

  $missingNames = @(
    $requiredNames | Where-Object {
      -not $values.ContainsKey($_) -or
      [string]::IsNullOrWhiteSpace($values[$_])
    }
  )

  if ($missingNames.Count -gt 0) {
    throw "Missing public build variables for $Target`: $($missingNames -join ', ')"
  }

  return $values
}

function Invoke-ClientOpenNextBuild {
  param(
    [Parameter(Mandatory)]
    [ValidateSet("baanparty", "baan02", "baanPMhee")]
    [string]$Target
  )

  $values = Get-ClientPublicBuildEnvironment -Target $Target
  $previousValues = @{}

  try {
    foreach ($name in $values.Keys) {
      $previousValues[$name] = [Environment]::GetEnvironmentVariable(
        $name,
        "Process"
      )
      [Environment]::SetEnvironmentVariable(
        $name,
        $values[$name],
        "Process"
      )
    }

    npm.cmd run build:cf

    if ($LASTEXITCODE -ne 0) {
      throw "OpenNext build failed for $Target"
    }
  }
  finally {
    foreach ($name in $previousValues.Keys) {
      [Environment]::SetEnvironmentVariable(
        $name,
        $previousValues[$name],
        "Process"
      )
    }
  }
}
```

Expected: both functions are defined and no environment value is printed.

- [ ] **Step 6: Build all three clients without deploying**

Run:

```powershell
Invoke-ClientOpenNextBuild -Target "baanparty"
Invoke-ClientOpenNextBuild -Target "baan02"
Invoke-ClientOpenNextBuild -Target "baanPMhee"
```

Expected: all three OpenNext builds exit successfully. Do not run
`deploy:cf:built` in this task.

- [ ] **Step 7: Run final static checks**

Run:

```powershell
npm.cmd run validate:deploy:cf
git diff --check
git status --short
```

Expected:

- deployment config validation passes;
- no whitespace errors;
- existing user changes remain present and untouched;
- generated `.next` and `.open-next` output stays ignored.

- [ ] **Step 8: Review checkpoint without committing**

Summarize:

- focused test result;
- full test result;
- lint result;
- standard Next build result;
- all three OpenNext build results;
- exact remaining external setup from Task 5.

Do not stage or commit.

---

### Task 5: One-Time External Setup and First Production Rollout

**Files:**

- No repository file changes intended.
- External state: GitHub Actions secrets, three GitHub Environments, and one
  Cloudflare API token.

**Interfaces:**

- Consumes: the reviewed repository changes and the runbook.
- Produces: repository-level Cloudflare authentication, three branch-restricted
  GitHub Environments, and the first observable one-merge/three-deploy run.

- [ ] **Step 1: Obtain explicit authorization for external changes**

Before creating or updating a Cloudflare token, GitHub secret, GitHub
Environment, branch policy, commit, push, pull request, or merge, ask the user
to authorize the exact action. Stop if authorization is not granted.

- [ ] **Step 2: Create the least-privilege Cloudflare API token**

In Cloudflare Dashboard, create one account-scoped token with:

- `Workers Scripts Write`
- `Workers R2 Storage Write`
- `Account Settings Read`

Scope it only to the account containing all three Workers. Do not add DNS,
Turnstile, billing, user-management, or zone permissions. Copy the token once
into a password manager; never paste it into chat, a command argument, or a
repository file.

- [ ] **Step 3: Store the two repository secrets interactively**

Run one command at a time and paste the requested value only into the secure
GitHub CLI prompt:

```powershell
gh secret set CLOUDFLARE_ACCOUNT_ID --repo Chaimanat2546/baan-pool-villa
gh secret set CLOUDFLARE_API_TOKEN --repo Chaimanat2546/baan-pool-villa
gh secret list --repo Chaimanat2546/baan-pool-villa
```

Expected: the final command lists both names but no values.

- [ ] **Step 4: Create and protect the three GitHub Environments**

In GitHub:

1. Open `Chaimanat2546/baan-pool-villa`.
2. Open **Settings → Environments**.
3. Create `baanparty`, `baan02`, and `baanPMhee`.
4. For each environment, choose **Selected branches and tags** and allow only
   `master`.
5. Leave required reviewers disabled.

Expected: all three environments exist and each shows only the `master` branch
policy.

- [ ] **Step 5: Store the nine public GitHub Environment variables**

Run these commands one at a time. GitHub CLI reads each value from standard
input; paste the matching value from the named ignored local file and finish
the input without echoing it into logs.

For `.env.baanparty`:

```powershell
gh variable set NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL --env baanparty --repo Chaimanat2546/baan-pool-villa
gh variable set NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY --env baanparty --repo Chaimanat2546/baan-pool-villa
gh variable set NEXT_PUBLIC_TURNSTILE_SITE_KEY --env baanparty --repo Chaimanat2546/baan-pool-villa
```

For `.env.baan02`:

```powershell
gh variable set NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL --env baan02 --repo Chaimanat2546/baan-pool-villa
gh variable set NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY --env baan02 --repo Chaimanat2546/baan-pool-villa
gh variable set NEXT_PUBLIC_TURNSTILE_SITE_KEY --env baan02 --repo Chaimanat2546/baan-pool-villa
```

For `.env.baanPMhee`:

```powershell
gh variable set NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL --env baanPMhee --repo Chaimanat2546/baan-pool-villa
gh variable set NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY --env baanPMhee --repo Chaimanat2546/baan-pool-villa
gh variable set NEXT_PUBLIC_TURNSTILE_SITE_KEY --env baanPMhee --repo Chaimanat2546/baan-pool-villa
```

Verify names only:

```powershell
gh variable list --env baanparty --repo Chaimanat2546/baan-pool-villa --json name --jq '.[].name'
gh variable list --env baan02 --repo Chaimanat2546/baan-pool-villa --json name --jq '.[].name'
gh variable list --env baanPMhee --repo Chaimanat2546/baan-pool-villa --json name --jq '.[].name'
```

Expected: each environment lists exactly the three approved public variable
names.

- [ ] **Step 6: Verify Cloudflare runtime secret names**

Run:

```powershell
npx.cmd wrangler secret list --env baanparty --format json
npx.cmd wrangler secret list --env baan02 --format json
npx.cmd wrangler secret list --env baanPMhee --format json
```

Expected: each target lists these names and no values:

```text
CALENDAR_INTERNAL_API_TOKEN
DEVILLE_BEARER_TOKEN
PATTAYA_BOOKINGS_API_TOKEN
SUPABASE_PUBLISHABLE_KEY
TURNSTILE_SECRET_KEY
```

If a name is missing, run only its exact interactive command in the affected
group:

```powershell
# baanparty
npx.cmd wrangler secret put CALENDAR_INTERNAL_API_TOKEN --env baanparty
npx.cmd wrangler secret put DEVILLE_BEARER_TOKEN --env baanparty
npx.cmd wrangler secret put PATTAYA_BOOKINGS_API_TOKEN --env baanparty
npx.cmd wrangler secret put SUPABASE_PUBLISHABLE_KEY --env baanparty
npx.cmd wrangler secret put TURNSTILE_SECRET_KEY --env baanparty

# baan02
npx.cmd wrangler secret put CALENDAR_INTERNAL_API_TOKEN --env baan02
npx.cmd wrangler secret put DEVILLE_BEARER_TOKEN --env baan02
npx.cmd wrangler secret put PATTAYA_BOOKINGS_API_TOKEN --env baan02
npx.cmd wrangler secret put SUPABASE_PUBLISHABLE_KEY --env baan02
npx.cmd wrangler secret put TURNSTILE_SECRET_KEY --env baan02

# baanPMhee
npx.cmd wrangler secret put CALENDAR_INTERNAL_API_TOKEN --env baanPMhee
npx.cmd wrangler secret put DEVILLE_BEARER_TOKEN --env baanPMhee
npx.cmd wrangler secret put PATTAYA_BOOKINGS_API_TOKEN --env baanPMhee
npx.cmd wrangler secret put SUPABASE_PUBLISHABLE_KEY --env baanPMhee
npx.cmd wrangler secret put TURNSTILE_SECRET_KEY --env baanPMhee
```

Do not reset names that were already present.

- [ ] **Step 7: Obtain explicit Git authorization and publish the reviewed files**

Present the exact diff and verification results. Only after the user explicitly
authorizes commit/push/PR work:

1. stage only `.env.example`, `.github/workflows/deploy-production.yml`,
   `package.json`, `wrangler.jsonc`, `scripts/production-deploy-config.mjs`,
   `scripts/production-deploy-config.test.ts`,
   `scripts/production-deploy-workflow.test.ts`, `docs/deployment.md`,
   `README.md`, and `docs/ai/structure.html`;
2. create commit `ci: deploy all clients from master`;
3. push branch `codex/github-actions-multi-client-deploy`;
4. open a pull request targeting `master`;
5. merge only after Tasks 1-4 and Steps 2-6 of this task are complete.

Do not include unrelated working-tree changes in the commit.

- [ ] **Step 8: Watch the first automatic production run**

After the authorized merge to `master`, run:

```powershell
$runId = gh run list --repo Chaimanat2546/baan-pool-villa --workflow deploy-production.yml --branch master --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $runId --repo Chaimanat2546/baan-pool-villa
gh run view $runId --repo Chaimanat2546/baan-pool-villa
```

Expected:

- `Verify` passes first;
- `Deploy baanparty`, `Deploy baan02`, and `Deploy baanPMhee` start from the
  same commit SHA;
- each job reports successful validation, build, deploy, and prewarm phases.

- [ ] **Step 9: Recover only failed jobs when necessary**

If any matrix target fails, run:

```powershell
gh run rerun $runId --failed --repo Chaimanat2546/baan-pool-villa
gh run watch $runId --repo Chaimanat2546/baan-pool-villa
```

Expected: GitHub reruns only failed jobs from the same workflow run and commit
SHA. Do not roll back successful clients automatically.

- [ ] **Step 10: Perform production browser and network verification**

Inspect desktop and mobile rendering for:

- `https://www.baanpartypattaya.com`
- `https://www.poolvillapattaya.co.th`
- `https://baan-pool-villa03.poolvilla.workers.dev`

For each target:

1. open the homepage, search, one guide detail, and one villa detail page;
2. confirm no public `/_next/image` requests;
3. confirm no unexpected `_rsc` requests from repeated public navigation;
4. confirm route/API request counts remain bounded;
5. confirm public HTML cache headers transition from `MISS` to `HIT` for
   allowlisted document requests;
6. confirm RSC, cookie, query, admin, and unsupported API requests bypass the
   HTML cache as documented;
7. confirm no client receives another client's canonical URL, Supabase project,
   or Turnstile site key.

Record results without copying secrets or full credential-bearing request
headers.

- [ ] **Step 11: Final handoff**

Report:

- workflow run URL and commit SHA;
- status for all three deployment jobs;
- any failed-job rerun performed;
- production browser/network verification result;
- exact rollback command for any remaining affected target;
- confirmation that no automatic rollback occurred.

Do not claim completion until all three targets either pass or the user accepts
a clearly identified remaining failed target.
