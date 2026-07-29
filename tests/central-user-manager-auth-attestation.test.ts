import { describe, expect, it } from "vitest";

import { buildCentralUserManagerAuthAttestation } from "../scripts/central-user-manager/auth-attestation.mjs";

const VALUES = {
  version: "v1",
  projectRef: "abcdefghijklmnopqrst",
  checkedAt: "2026-07-30T01:02:03.000Z",
  disableSignup: true,
  anonymousSignInsEnabled: false,
  passwordMinLength: 12,
  passwordRequiredCharacters: "aA1!",
} as const;

describe("Central User Manager Auth attestation", () => {
  it("builds the deterministic fixed-key v1 SHA-256 attestation", () => {
    expect(buildCentralUserManagerAuthAttestation(VALUES)).toEqual({
      version: "v1",
      digest:
        "ab2967257c08e04ac9e5cc392d6a867d3796e736fbcd9362385fccbce17de3a0",
      checkedAt: "2026-07-30T01:02:03.000Z",
      values: VALUES,
    });
  });

  it("is independent of caller object key order", () => {
    const reordered = {
      passwordRequiredCharacters: "aA1!",
      disableSignup: true,
      checkedAt: "2026-07-30T01:02:03.000Z",
      projectRef: "abcdefghijklmnopqrst",
      passwordMinLength: 12,
      anonymousSignInsEnabled: false,
      version: "v1",
    };

    expect(buildCentralUserManagerAuthAttestation(reordered)).toEqual(
      buildCentralUserManagerAuthAttestation(VALUES),
    );
  });

  it.each([
    ["version", { version: "v2" }],
    ["project ref", { projectRef: "bbbbbbbbbbbbbbbbbbbb" }],
    ["checked time", { checkedAt: "2026-07-30T01:02:04.000Z" }],
    ["signup setting", { disableSignup: false }],
    ["anonymous setting", { anonymousSignInsEnabled: true }],
    ["minimum length", { passwordMinLength: 13 }],
    ["required characters", { passwordRequiredCharacters: "aA1!#" }],
  ])("binds the %s into the digest or rejects a noncompliant value", (_label, patch) => {
    const baseline = buildCentralUserManagerAuthAttestation(VALUES);

    try {
      const changed = buildCentralUserManagerAuthAttestation({
        ...VALUES,
        ...patch,
      });
      expect(changed.digest).not.toBe(baseline.digest);
    } catch (error) {
      expect(String(error)).toBe(
        "Error: Central User Manager Auth attestation is invalid.",
      );
    }
  });

  it.each([
    ["signup enabled", { disableSignup: false }],
    ["anonymous enabled", { anonymousSignInsEnabled: true }],
    ["noncanonical project ref", { projectRef: "ABCDEFGHIJKLMNOPQRST" }],
    ["short project ref", { projectRef: "abcdefghijklmnopqrs" }],
    ["noncanonical timestamp", { checkedAt: "2026-07-30T01:02:03Z" }],
    ["invalid timestamp", { checkedAt: "not-a-time" }],
    ["zero password length", { passwordMinLength: 0 }],
    ["unsafe password length", { passwordMinLength: Number.MAX_SAFE_INTEGER }],
    ["multiline characters", { passwordRequiredCharacters: "aA1!\n" }],
    ["tab control character", { passwordRequiredCharacters: "aA1!\t" }],
    ["C0 control character", { passwordRequiredCharacters: "aA1!\u0000" }],
    ["DEL control character", { passwordRequiredCharacters: "aA1!\u007f" }],
    ["C1 control character", { passwordRequiredCharacters: "aA1!\u0085" }],
    ["Unicode line separator", { passwordRequiredCharacters: "aA1!\u2028" }],
    ["Unicode paragraph separator", { passwordRequiredCharacters: "aA1!\u2029" }],
    ["oversized characters", { passwordRequiredCharacters: "x".repeat(257) }],
    ["wrong version", { version: "v2" }],
  ])("fails closed for %s with a generic redacted error", (_label, patch) => {
    const injected = "sb_secret_injected-management-token";

    expect(() =>
      buildCentralUserManagerAuthAttestation({
        ...VALUES,
        ...patch,
      }),
    ).toThrow("Central User Manager Auth attestation is invalid.");
    try {
      buildCentralUserManagerAuthAttestation({
        ...VALUES,
        ...patch,
        providerError: injected,
      } as never);
    } catch (error) {
      expect(String(error)).not.toContain(injected);
    }
  });

  it("accepts an exact empty required-character readback", () => {
    const result = buildCentralUserManagerAuthAttestation({
      ...VALUES,
      passwordRequiredCharacters: "",
    });

    expect(result.values.passwordRequiredCharacters).toBe("");
    expect(result.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ["managementApiToken", "management-token"],
    ["supabaseSecret", "sb_secret_injected"],
    ["bearerToken", "bearer-token"],
    ["password", "temporary-password"],
    ["providerError", "raw provider error"],
    ["unrelatedConfig", true],
  ])("rejects and never emits the secret or unrelated field %s", (key, value) => {
    let serialized = "";

    try {
      serialized = JSON.stringify(
        buildCentralUserManagerAuthAttestation({
          ...VALUES,
          [key]: value,
        } as never),
      );
    } catch (error) {
      serialized = String(error);
    }

    expect(serialized).toBe(
      "Error: Central User Manager Auth attestation is invalid.",
    );
    expect(serialized).not.toContain(String(value));
  });

  it("redacts an exception raised while reading the caller object", () => {
    const injected = "raw-provider-error-with-management-token";
    const input = {
      ...VALUES,
      get checkedAt(): string {
        throw new Error(injected);
      },
    };

    expect(() => buildCentralUserManagerAuthAttestation(input)).toThrow(
      "Central User Manager Auth attestation is invalid.",
    );
    try {
      buildCentralUserManagerAuthAttestation(input);
    } catch (error) {
      expect(String(error)).not.toContain(injected);
    }
  });
});
