import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { validateCentralUserManagerBearerToken } from "../scripts/central-user-manager/validate-bearer-token.mjs";

const VALID_TOKEN = "paWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaU";
const INJECTED_TOKEN =
  "c2VjcmV0LWF1dGhvcml6YXRpb24tdmFsdWUtaW5qZWN0ZWQ";

describe("Central User Manager Bearer provisioning validation", () => {
  it("reports only the fixed byte length and positive token version for a canonical token", () => {
    expect(validateCentralUserManagerBearerToken(VALID_TOKEN, 7)).toEqual({
      valid: true,
      byteLength: 32,
      tokenVersion: 7,
    });
  });

  it.each([
    ["too short", "A".repeat(42)],
    ["too long", "A".repeat(44)],
    ["padded", `${"A".repeat(43)}=`],
    ["standard base64 alphabet", `${"A".repeat(42)}+`],
    ["noncanonical pad bits", `${"A".repeat(42)}B`],
    ["Unicode", `ก${"A".repeat(42)}`],
    ["control text", `${"A".repeat(42)}\n`],
  ])("rejects %s without returning the supplied value", (_label, token) => {
    const result = validateCentralUserManagerBearerToken(token, 1);

    expect(result).toEqual({
      valid: false,
      error: "Central User Manager Bearer token is invalid.",
    });
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1", null])(
    "rejects invalid token version %s with the same redacted result",
    (tokenVersion) => {
      expect(
        validateCentralUserManagerBearerToken(
          INJECTED_TOKEN,
          tokenVersion as never,
        ),
      ).toEqual({
        valid: false,
        error: "Central User Manager Bearer token is invalid.",
      });
    },
  );

  it("never includes an injected token or Authorization value in the result or thrown error", () => {
    const authorization = `Bearer ${INJECTED_TOKEN}`;
    let serialized = "";

    try {
      serialized = JSON.stringify(
        validateCentralUserManagerBearerToken(
          authorization as unknown as string,
          1,
        ),
      );
    } catch (error) {
      serialized = String(error);
    }

    expect(serialized).not.toContain(INJECTED_TOKEN);
    expect(serialized).not.toContain(authorization);
  });
});

describe("Central User Manager Tenant provisioning guide", () => {
  it("documents the fail-closed per-Tenant rollout, rotation, and repair runbook without example secrets", async () => {
    const guide = await readFile(
      resolve("docs/central-user-manager/tenant-provisioning.md"),
      "utf8",
    );

    for (const required of [
      "Bearer",
      "Tenant",
      "webook",
      "256-bit",
      "crypto",
      "Math.random()",
      "secret vault",
      "Worker secret",
      "NEXT_PUBLIC_*",
      "Cloudflare Access",
      "/api/internal/central-user-manager/v1/health",
      "/api/internal/central-user-manager/v1/operations",
      "CENTRAL_USER_MANAGER_AGENT_ENABLED",
      "CENTRAL_USER_MANAGER_CREDENTIAL_FENCE_ENABLED",
      "prepare migrations",
      "dry-run backfill",
      "enforcement migration",
      "inactive",
      "single-token",
      "dual-token",
      "temporary password",
      "quarantine",
      "duplicate",
      "normalized-email",
      "Auth-only",
      "profile-only",
      "UID/version mismatch",
      "ยังไม่ได้ apply",
    ]) {
      expect(guide).toContain(required);
    }

    expect(guide).toMatch(/ไม่ต้อง redeploy[\s\S]*webook/i);
    expect(guide).toMatch(/Tenant ใหม่[\s\S]*deploy[\s\S]*ครั้งแรก/i);
    expect(guide).toMatch(/prepare migrations[\s\S]*dry-run backfill[\s\S]*approved apply \+ verify[\s\S]*enforcement migration[\s\S]*enable credential fence/i);
    expect(guide).toMatch(/ล้มเหลว[\s\S]*inactive/i);
    expect(guide).toMatch(/lost[\s\S]*temporary password[\s\S]*reissue/i);
    expect(guide).toMatch(/ไม่ replay[\s\S]*Auth mutation/i);
    expect(guide).not.toMatch(/Bearer\s+[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/);
    expect(guide).not.toContain("Bearer ey");

    const readme = await readFile(resolve("README.md"), "utf8");
    expect(readme).toContain(
      "[คู่มือ Tenant provisioning](docs/central-user-manager/tenant-provisioning.md)",
    );
  });
});
