import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getCentralUserManagerAgentConfig } from "../config";

const VALID_ENV = {
  CENTRAL_USER_MANAGER_AGENT_ENABLED: "true",
  CENTRAL_USER_MANAGER_CREDENTIAL_FENCE_ENABLED: "true",
  CENTRAL_USER_MANAGER_TENANT_ID: "9f3c3a5b-483d-4f49-a5eb-e0509ff82eb4",
  CENTRAL_USER_MANAGER_PROJECT_REF: "abcdefghijklmnopqrst",
  CENTRAL_USER_MANAGER_AGENT_VERSION: "1.0.0",
  CENTRAL_USER_MANAGER_SCHEMA_VERSION: "1.0.0",
  CENTRAL_USER_MANAGER_TOKEN_VERSION: "1",
  CENTRAL_USER_MANAGER_BEARER_TOKEN:
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  CENTRAL_USER_MANAGER_AUTH_ATTESTATION_VERSION: "1.0.0",
  CENTRAL_USER_MANAGER_AUTH_ATTESTATION_DIGEST:
    "a".repeat(64),
  CENTRAL_USER_MANAGER_AUTH_ATTESTATION_CHECKED_AT:
    "2026-07-29T00:00:00.000Z",
  NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
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

describe("Central User Manager Agent configuration", () => {
  beforeEach(() => {
    setValidEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the complete disabled Agent configuration", () => {
    vi.stubEnv("CENTRAL_USER_MANAGER_AGENT_ENABLED", "false");

    expect(getCentralUserManagerAgentConfig()).toEqual({
      enabled: false,
      credentialFenceEnabled: true,
      tenantId: "9f3c3a5b-483d-4f49-a5eb-e0509ff82eb4",
      projectRef: "abcdefghijklmnopqrst",
      agentVersion: "1.0.0",
      schemaVersion: "1.0.0",
      tokenVersion: 1,
      bearerToken: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      authAttestation: {
        version: "1.0.0",
        digest: "a".repeat(64),
        checkedAt: "2026-07-29T00:00:00.000Z",
      },
      supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
      supabaseSecretKey: "sb_secret_example",
    });
  });

  it.each([
    [undefined],
    ["9F3C3A5B-483D-4F49-A5EB-E0509FF82EB4"],
    ["9f3c3a5b483d4f49a5ebe0509ff82eb4"],
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
    ["CENTRAL_USER_MANAGER_AGENT_VERSION", ""],
    ["CENTRAL_USER_MANAGER_SCHEMA_VERSION", "1.0.0 beta"],
    ["CENTRAL_USER_MANAGER_AUTH_ATTESTATION_VERSION", "v".repeat(65)],
  ])("rejects malformed version field %s", (name, value) => {
    vi.stubEnv(name, value);

    expectInvalidConfig();
  });

  it.each([
    ["CENTRAL_USER_MANAGER_AUTH_ATTESTATION_DIGEST", "A".repeat(64)],
    ["CENTRAL_USER_MANAGER_AUTH_ATTESTATION_CHECKED_AT", "2026-07-29T00:00:00Z"],
  ])("rejects malformed attestation field %s", (name, value) => {
    vi.stubEnv(name, value);

    expectInvalidConfig();
  });

  it.each([
    ["CENTRAL_USER_MANAGER_AGENT_ENABLED", "TRUE"],
    ["CENTRAL_USER_MANAGER_CREDENTIAL_FENCE_ENABLED", "False"],
  ])("rejects non-exact boolean %s", (name, value) => {
    vi.stubEnv(name, value);

    expectInvalidConfig();
  });

  it("rejects a Bearer token with noncanonical base64url pad bits", () => {
    vi.stubEnv(
      "CENTRAL_USER_MANAGER_BEARER_TOKEN",
      `${"A".repeat(42)}B`,
    );

    expectInvalidConfig();
  });

  it.each([["0"], ["1.5"], ["9007199254740992"]])(
    "rejects a non-positive or unsafe token version: %s",
    (tokenVersion) => {
      vi.stubEnv("CENTRAL_USER_MANAGER_TOKEN_VERSION", tokenVersion);

      expectInvalidConfig();
    },
  );

  it.each([[""], ["secret"], [`sb_secret_${"a".repeat(1025)}`]])(
    "rejects a missing, unrecognized, or oversized Supabase secret",
    (secret) => {
      vi.stubEnv("SUPABASE_SECRET_KEY", secret);

      expectInvalidConfig();
    },
  );

  it.each([
    ["http://abcdefghijklmnopqrst.supabase.co"],
    ["https://user:password@abcdefghijklmnopqrst.supabase.co"],
    ["https://abcdefghijklmnopqrst.supabase.co/path"],
    ["https://abcdefghijklmnopqrst.supabase.co?query=value"],
  ])("rejects a non-origin Supabase URL: %s", (supabaseUrl) => {
    vi.stubEnv("NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL", supabaseUrl);

    expectInvalidConfig();
  });
});
