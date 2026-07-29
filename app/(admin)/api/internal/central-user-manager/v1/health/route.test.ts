import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CentralUserManagerAgentConfig } from "@/lib/central-user-manager/config";
import { createHealthRouteHandlers } from "@/lib/central-user-manager/health-route-handler";

const VALID_TOKEN = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const TENANT_ID = "123e4567-e89b-42d3-a456-426614174000";
const CONFIG: CentralUserManagerAgentConfig = {
  enabled: true,
  credentialFenceEnabled: true,
  tenantId: TENANT_ID,
  projectRef: "abcdefghijklmnopqrst",
  agentVersion: "1.0.0",
  schemaVersion: "20260729",
  tokenVersion: 7,
  bearerToken: VALID_TOKEN,
  authAttestation: {
    version: "1",
    digest: "a".repeat(64),
    checkedAt: "2026-07-29T00:00:00.000Z",
  },
  supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
  supabaseSecretKey: "sb_secret_example",
};

function request(headers: Record<string, string> = {}) {
  return new Request(
    "https://example.com/api/internal/central-user-manager/v1/health",
    {
      headers: {
        Authorization: `Bearer ${VALID_TOKEN}`,
        "X-CUM-Version": "1",
        ...headers,
      },
    },
  );
}

function dependencies(overrides: {
  config?: () => CentralUserManagerAgentConfig;
  health?: ReturnType<typeof vi.fn>;
} = {}) {
  const health =
    overrides.health ??
    vi.fn(async () => ({
      ok: true as const,
      data: {
        tenantId: TENANT_ID,
        protocolVersion: 1 as const,
        tokenVersion: 7,
        projectRef: CONFIG.projectRef,
        agentVersion: CONFIG.agentVersion,
        schemaVersion: CONFIG.schemaVersion,
        checks: {
          database: "ok" as const,
          adminUsersTable: "ok" as const,
          operationTables: "ok" as const,
        },
        authAttestation: CONFIG.authAttestation,
      },
    }));
  return {
    getConfig: overrides.config ?? (() => CONFIG),
    getHealth: health,
  };
}

function expectAgentHeaders(response: Response) {
  for (const [name, value] of Object.entries({
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  })) {
    expect(response.headers.get(name)).toBe(value);
  }
  expect(response.headers.get("Location")).toBeNull();
}

describe("Central User Manager health route", () => {
  it("returns 405 with exact Allow before configuration work", async () => {
    const getConfig = vi.fn(() => CONFIG);
    const handlers = createHealthRouteHandlers({
      getConfig,
      getHealth: vi.fn(),
    });

    const response = await handlers.methodNotAllowed();

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expectAgentHeaders(response);
    expect(getConfig).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid configuration", () => {
      throw new Error(`invalid ${VALID_TOKEN}`);
    }],
    [
      "disabled Agent",
      () => ({ ...CONFIG, enabled: false }),
    ],
    [
      "disabled credential fence",
      () => ({ ...CONFIG, credentialFenceEnabled: false }),
    ],
  ])("returns a safe 503 for %s before health work", async (_label, config) => {
    const deps = dependencies({ config });
    const handlers = createHealthRouteHandlers(deps);

    const response = await handlers.GET(request());

    expect(response.status).toBe(503);
    expectAgentHeaders(response);
    expect(deps.getHealth).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain(VALID_TOKEN);
  });

  it("returns 503 for a malformed expected token without probing health", async () => {
    const deps = dependencies({
      config: () => ({ ...CONFIG, bearerToken: "malformed" }),
    });

    const response = await createHealthRouteHandlers(deps).GET(request());

    expect(response.status).toBe(503);
    expect(deps.getHealth).not.toHaveBeenCalled();
    expectAgentHeaders(response);
  });

  it.each([
    ["missing Bearer", { Authorization: "" }],
    [
      "wrong Bearer",
      {
        Authorization:
          "Bearer AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
      },
    ],
  ])("returns 401 for %s before health work", async (_label, headers) => {
    const deps = dependencies();
    const response = await createHealthRouteHandlers(deps).GET(
      request(headers),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    expectAgentHeaders(response);
    expect(deps.getHealth).not.toHaveBeenCalled();
  });

  it("contains a rejecting Bearer verifier as a static 503 before health work", async () => {
    const deps = dependencies();
    const response = await createHealthRouteHandlers({
      ...deps,
      requireBearer: vi.fn(async () => {
        throw new Error(`crypto failed ${VALID_TOKEN}`);
      }),
    }).GET(request());

    expect(response.status).toBe(503);
    expectAgentHeaders(response);
    expect(deps.getHealth).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: {
        code: "agent_unavailable",
        message: "Central User Manager Agent is unavailable.",
      },
    });
  });

  it.each([undefined, "", "2", "1, 1"])(
    "returns 422 for invalid protocol version %s after Bearer",
    async (version) => {
      const deps = dependencies();
      const headers = new Headers({
        Authorization: `Bearer ${VALID_TOKEN}`,
      });
      if (version !== undefined) {
        headers.set("X-CUM-Version", version);
      }

      const response = await createHealthRouteHandlers(deps).GET(
        new Request("https://example.com/health", { headers }),
      );

      expect(response.status).toBe(422);
      expect(deps.getHealth).not.toHaveBeenCalled();
      expectAgentHeaders(response);
    },
  );

  it("returns the exact healthy identity response with no secrets", async () => {
    const deps = dependencies();
    const response = await createHealthRouteHandlers(deps).GET(request());

    expect(response.status).toBe(200);
    expectAgentHeaders(response);
    await expect(response.json()).resolves.toEqual({
      tenantId: TENANT_ID,
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
    });
    const serialized = JSON.stringify(await deps.getHealth.mock.results[0]?.value);
    expect(serialized).not.toContain(CONFIG.bearerToken);
    expect(serialized).not.toContain(CONFIG.supabaseSecretKey);
  });

  it.each([
    ["tenantId", { tenantId: "123e4567-e89b-42d3-a456-426614174099" }],
    ["tokenVersion", { tokenVersion: 8 }],
    ["projectRef", { projectRef: "zyxwvutsrqponmlkjihg" }],
    ["agentVersion", { agentVersion: "9.9.9" }],
    ["schemaVersion", { schemaVersion: "wrong" }],
    [
      "auth attestation",
      {
        authAttestation: {
          version: "wrong",
          digest: "b".repeat(64),
          checkedAt: "2026-07-30T00:00:00.000Z",
        },
      },
    ],
  ])("rejects health data with mismatched authorized %s", async (_label, mismatch) => {
    const health = vi.fn(async () => ({
      ok: true as const,
      data: {
        tenantId: TENANT_ID,
        protocolVersion: 1 as const,
        tokenVersion: CONFIG.tokenVersion,
        projectRef: CONFIG.projectRef,
        agentVersion: CONFIG.agentVersion,
        schemaVersion: CONFIG.schemaVersion,
        checks: {
          database: "ok" as const,
          adminUsersTable: "ok" as const,
          operationTables: "ok" as const,
        },
        authAttestation: CONFIG.authAttestation,
        ...mismatch,
      },
    }));

    const response = await createHealthRouteHandlers(
      dependencies({ health }),
    ).GET(request());

    expect(response.status).toBe(503);
    expectAgentHeaders(response);
  });

  it.each([
    [
      "failed probe",
      {
        ok: false,
        error: {
          code: "health_unavailable",
          message: "Central User Manager health checks failed.",
        },
      },
    ],
    ["malformed probe result", { ok: true, data: { database: "raw SQL" } }],
  ])("returns a safe 503 for %s", async (_label, healthResult) => {
    const deps = dependencies({
      health: vi.fn(async () => healthResult),
    });

    const response = await createHealthRouteHandlers(deps).GET(request());

    expect(response.status).toBe(503);
    expectAgentHeaders(response);
    const text = await response.text();
    expect(text).not.toContain("raw SQL");
    expect(text).not.toContain(CONFIG.supabaseSecretKey);
  });
});
