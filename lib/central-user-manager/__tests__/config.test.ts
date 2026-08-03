import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getCentralUserManagerAgentConfig } from "../config";

const VALID_ENV = {
  CENTRAL_USER_MANAGER_AGENT_ENABLED: "true",
  CENTRAL_USER_MANAGER_TENANT_ID: "9f3c3a5b-483d-4f49-a5eb-e0509ff82eb4",
  CENTRAL_USER_MANAGER_PROJECT_REF: "abcdefghijklmnopqrst",
  NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL:
    "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_example",
} as const;

function setValidEnv() {
  for (const [name, value] of Object.entries(VALID_ENV)) {
    vi.stubEnv(name, value);
  }
}

function expectInvalidConfig() {
  expect(() => getCentralUserManagerAgentConfig()).toThrow(
    /Central User Manager Agent configuration is invalid\./,
  );
}

function removedEnvironmentVariable(suffix: string) {
  return ["CENTRAL_USER_MANAGER", suffix].join("_");
}

describe("Central User Manager Agent configuration", () => {
  beforeEach(() => {
    setValidEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns only the minimal disabled Agent configuration", () => {
    vi.stubEnv("CENTRAL_USER_MANAGER_AGENT_ENABLED", "false");

    expect(getCentralUserManagerAgentConfig()).toEqual({
      enabled: false,
      tenantId: "9f3c3a5b-483d-4f49-a5eb-e0509ff82eb4",
      projectRef: "abcdefghijklmnopqrst",
      supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
      supabaseSecretKey: "sb_secret_example",
    });
  });

  it.each([undefined, "", "TRUE"])(
    "rejects a missing or non-exact enabled flag: %s",
    (enabled) => {
      vi.stubEnv("CENTRAL_USER_MANAGER_AGENT_ENABLED", enabled ?? "");

      expectInvalidConfig();
    },
  );

  it.each([
    [undefined],
    ["9F3C3A5B-483D-4F49-A5EB-E0509FF82EB4"],
    ["9f3c3a5b483d4f49a5ebe0509ff82eb4"],
    ["9f3c3a5b-483d-ff49-a5eb-e0509ff82eb4"],
  ])("rejects a missing or noncanonical Tenant UUID: %s", (tenantId) => {
    vi.stubEnv("CENTRAL_USER_MANAGER_TENANT_ID", tenantId ?? "");

    expectInvalidConfig();
  });

  it.each([["abcdefghijklmnopqrs"], ["abcdefghijklmnopqrsT"]])(
    "rejects a malformed project ref: %s",
    (projectRef) => {
      vi.stubEnv("CENTRAL_USER_MANAGER_PROJECT_REF", projectRef);

      expectInvalidConfig();
    },
  );

  it.each([
    ["http://abcdefghijklmnopqrst.supabase.co"],
    ["https://user:password@abcdefghijklmnopqrst.supabase.co"],
    ["https://abcdefghijklmnopqrst.supabase.co/path"],
    ["https://abcdefghijklmnopqrst.supabase.co?query=value"],
    ["https://zzzzzzzzzzzzzzzzzzzz.supabase.co"],
  ])("rejects a malformed or mismatched Supabase URL: %s", (supabaseUrl) => {
    vi.stubEnv("NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL", supabaseUrl);

    expectInvalidConfig();
  });

  it.each([undefined, "", "secret", `sb_secret_${"a".repeat(1025)}`])(
    "rejects a missing, unrecognized, or oversized Supabase secret: %s",
    (secret) => {
      vi.stubEnv("SUPABASE_SECRET_KEY", secret ?? "");

      expectInvalidConfig();
    },
  );

  it("ignores removed Bearer, version, fence, and attestation variables", () => {
    vi.stubEnv(removedEnvironmentVariable("BEARER_TOKEN"), "not-a-bearer-token");
    vi.stubEnv(removedEnvironmentVariable("TOKEN_VERSION"), "not-a-number");
    vi.stubEnv(removedEnvironmentVariable("CREDENTIAL_FENCE_ENABLED"), "false");
    vi.stubEnv(removedEnvironmentVariable("AGENT_VERSION"), "invalid version!");
    vi.stubEnv(removedEnvironmentVariable("SCHEMA_VERSION"), "invalid version!");
    vi.stubEnv(removedEnvironmentVariable("AUTH_ATTESTATION_VERSION"), "invalid!");
    vi.stubEnv(removedEnvironmentVariable("AUTH_ATTESTATION_DIGEST"), "wrong");
    vi.stubEnv(removedEnvironmentVariable("AUTH_ATTESTATION_CHECKED_AT"), "never");

    expect(getCentralUserManagerAgentConfig()).toEqual({
      enabled: true,
      tenantId: VALID_ENV.CENTRAL_USER_MANAGER_TENANT_ID,
      projectRef: VALID_ENV.CENTRAL_USER_MANAGER_PROJECT_REF,
      supabaseUrl: VALID_ENV.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL,
      supabaseSecretKey: VALID_ENV.SUPABASE_SECRET_KEY,
    });
  });
});
