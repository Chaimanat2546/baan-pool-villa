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
    SUPABASE_PUBLISHABLE_KEY: "villa-supabase-publishable-key",
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
          siteUrl: "https://www.pmheevilla.com",
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
      "SUPABASE_PUBLISHABLE_KEY",
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
