import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CentralUserManagerAdminClient } from "../operation-repository";
import {
  getCentralUserManagerHealth,
  probeCentralUserManagerHealth,
} from "../health-service";
import type { CentralUserManagerAgentConfig } from "../config";

const CONFIG: CentralUserManagerAgentConfig = {
  enabled: true,
  credentialFenceEnabled: true,
  tenantId: "123e4567-e89b-42d3-a456-426614174000",
  projectRef: "abcdefghijklmnopqrst",
  agentVersion: "1.0.0",
  schemaVersion: "20260729",
  tokenVersion: 7,
  bearerToken: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  authAttestation: {
    version: "1",
    digest: "a".repeat(64),
    checkedAt: "2026-07-29T00:00:00.000Z",
  },
  supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
  supabaseSecretKey: "sb_secret_example",
};

function clientWithProbe(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return {
    client: { rpc } as unknown as CentralUserManagerAdminClient,
    rpc,
  };
}

describe("Central User Manager health service", () => {
  it("maps the exact read-only probe and embedded non-secret attestation", async () => {
    const fake = clientWithProbe({
      database: true,
      adminUsersTable: true,
      operationTables: true,
    });

    await expect(
      getCentralUserManagerHealth(CONFIG, 7, fake.client),
    ).resolves.toEqual({
      ok: true,
      data: {
        tenantId: CONFIG.tenantId,
        protocolVersion: 1,
        tokenVersion: 7,
        projectRef: CONFIG.projectRef,
        agentVersion: CONFIG.agentVersion,
        schemaVersion: CONFIG.schemaVersion,
        checks: {
          database: "ok",
          adminUsersTable: "ok",
          operationTables: "ok",
        },
        authAttestation: CONFIG.authAttestation,
      },
    });
    expect(fake.rpc).toHaveBeenCalledWith(
      "central_user_manager_health_probe_v1",
      {},
    );
  });

  it.each([
    ["failed RPC", null, { message: "raw SQL secret", details: "private" }],
    [
      "missing key",
      { database: true, adminUsersTable: true },
      null,
    ],
    [
      "extra key",
      {
        database: true,
        adminUsersTable: true,
        operationTables: true,
        users: ["must-not-escape"],
      },
      null,
    ],
    [
      "failed check",
      {
        database: true,
        adminUsersTable: false,
        operationTables: true,
      },
      null,
    ],
  ])("fails closed for a %s without returning probe data", async (_label, data, error) => {
    const fake = clientWithProbe(data, error);

    const result = await probeCentralUserManagerHealth(fake.client);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "health_unavailable",
        message: "Central User Manager health checks failed.",
      },
    });
    expect(JSON.stringify(result)).not.toContain("raw SQL");
    expect(JSON.stringify(result)).not.toContain("must-not-escape");
  });

  it("contains a thrown client failure", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("raw provider failure"));
    const client = { rpc } as unknown as CentralUserManagerAdminClient;

    await expect(probeCentralUserManagerHealth(client)).resolves.toMatchObject({
      ok: false,
      error: { code: "health_unavailable" },
    });
  });
});
