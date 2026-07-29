import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CentralUserManagerAgentConfig } from "@/lib/central-user-manager/config";
import type { CentralUserOperationContext } from "@/lib/central-user-manager/operation-service";
import { createOperationsRouteHandlers } from "@/lib/central-user-manager/operations-route-handler";

const VALID_TOKEN = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const TENANT_ID = "123e4567-e89b-42d3-a456-426614174000";
const OPERATION_ID = "123e4567-e89b-42d3-a456-426614174001";
const ACTOR_UID = "123e4567-e89b-42d3-a456-426614174002";
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
const LIST_BODY = JSON.stringify({
  tenantId: TENANT_ID,
  operationId: OPERATION_ID,
  actorUid: ACTOR_UID,
  action: "list_users",
  payload: { page: 1, pageSize: 25 },
});
const MUTATION_BODY = JSON.stringify({
  tenantId: TENANT_ID,
  operationId: OPERATION_ID,
  actorUid: ACTOR_UID,
  action: "reissue_temporary_password",
  payload: { email: "admin@example.com" },
});

function request(
  body: BodyInit | null = LIST_BODY,
  headers: Record<string, string> = {},
) {
  return new Request(
    "https://example.com/api/internal/central-user-manager/v1/operations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VALID_TOKEN}`,
        "X-CUM-Version": "1",
        "Content-Type": "application/json",
        ...headers,
      },
      body,
    },
  );
}

function dependencies(overrides: {
  config?: () => CentralUserManagerAgentConfig;
  createContext?: ReturnType<typeof vi.fn>;
  execute?: ReturnType<typeof vi.fn>;
} = {}) {
  const context = { requestHash: "context-created" } as CentralUserOperationContext;
  const createContext =
    overrides.createContext ?? vi.fn(() => context);
  const execute =
    overrides.execute ??
    vi.fn(async (_context, operation) => ({
      operationId: operation.operationId,
      status: "completed" as const,
      stage: "listed",
      result: {
        users: [],
        pagination: { page: 1, pageSize: 25, hasMore: false },
      },
    }));

  return {
    getConfig: overrides.config ?? (() => CONFIG),
    createContext,
    execute,
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

describe("Central User Manager operations route", () => {
  it("returns 405 with exact Allow before configuration or client work", async () => {
    const getConfig = vi.fn(() => CONFIG);
    const deps = dependencies();
    const handlers = createOperationsRouteHandlers({
      ...deps,
      getConfig,
    });

    const response = await handlers.methodNotAllowed();

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    expectAgentHeaders(response);
    expect(getConfig).not.toHaveBeenCalled();
    expect(deps.createContext).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid config", () => {
      throw new Error(`invalid ${VALID_TOKEN}`);
    }],
    ["disabled Agent", () => ({ ...CONFIG, enabled: false })],
    [
      "disabled credential fence",
      () => ({ ...CONFIG, credentialFenceEnabled: false }),
    ],
  ])("returns safe 503 for %s before body/client/service", async (_label, config) => {
    const deps = dependencies({ config });

    const response = await createOperationsRouteHandlers(deps).POST(request());

    expect(response.status).toBe(503);
    expect(deps.createContext).not.toHaveBeenCalled();
    expect(deps.execute).not.toHaveBeenCalled();
    expectAgentHeaders(response);
    expect(await response.text()).not.toContain(VALID_TOKEN);
  });

  it.each([
    ["missing", undefined],
    [
      "wrong",
      "Bearer AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
    ],
  ])(
    "rejects %s Bearer before touching the body, client, hash, or service",
    async (_label, authorization) => {
      let bodyRead = false;
      const headers = new Headers({
        "X-CUM-Version": "1",
        "Content-Type": "application/json",
      });
      if (authorization) {
        headers.set("Authorization", authorization);
      }
      const guardedRequest = {
        headers,
        get body() {
          bodyRead = true;
          throw new Error("body must remain unread");
        },
      } as unknown as Request;
      const digest = vi.fn();
      const deps = dependencies();

      const response = await createOperationsRouteHandlers({
        ...deps,
        crypto: { subtle: { digest } } as Pick<Crypto, "subtle">,
      }).POST(guardedRequest);

      expect(response.status).toBe(401);
      expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
      expect(bodyRead).toBe(false);
      expect(digest).not.toHaveBeenCalled();
      expect(deps.createContext).not.toHaveBeenCalled();
      expect(deps.execute).not.toHaveBeenCalled();
      expectAgentHeaders(response);
    },
  );

  it("contains a rejecting Bearer verifier before body, hash, client, or service work", async () => {
    let bodyRead = false;
    const guardedRequest = {
      headers: request().headers,
      get body() {
        bodyRead = true;
        throw new Error("body must remain unread");
      },
    } as unknown as Request;
    const digest = vi.fn();
    const deps = dependencies();

    const response = await createOperationsRouteHandlers({
      ...deps,
      requireBearer: vi.fn(async () => {
        throw new Error(`crypto failed ${VALID_TOKEN}`);
      }),
      crypto: { subtle: { digest } } as Pick<Crypto, "subtle">,
    }).POST(guardedRequest);

    expect(response.status).toBe(503);
    expectAgentHeaders(response);
    expect(bodyRead).toBe(false);
    expect(digest).not.toHaveBeenCalled();
    expect(deps.createContext).not.toHaveBeenCalled();
    expect(deps.execute).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: {
        code: "agent_unavailable",
        message: "Central User Manager Agent is unavailable.",
      },
    });
  });

  it.each([undefined, "", "2", "1, 1"])(
    "rejects protocol version %s before body/client/service",
    async (version) => {
      const deps = dependencies();
      const headers = new Headers({
        Authorization: `Bearer ${VALID_TOKEN}`,
        "Content-Type": "application/json",
      });
      if (version !== undefined) {
        headers.set("X-CUM-Version", version);
      }

      const response = await createOperationsRouteHandlers(deps).POST(
        new Request("https://example.com/operations", {
          method: "POST",
          headers,
          body: LIST_BODY,
        }),
      );

      expect(response.status).toBe(422);
      expect(deps.createContext).not.toHaveBeenCalled();
      expect(deps.execute).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["missing", undefined],
    ["parameterized", "application/json; charset=utf-8"],
    ["wrong", "text/plain"],
    ["wrong case", "Application/Json"],
  ])("rejects %s content type before body/client/service", async (_label, contentType) => {
    const deps = dependencies();
    const headers: Record<string, string> = {};
    if (contentType === undefined) {
      headers["Content-Type"] = "";
    } else {
      headers["Content-Type"] = contentType;
    }

    const response = await createOperationsRouteHandlers(deps).POST(
      request(LIST_BODY, headers),
    );

    expect(response.status).toBe(415);
    expect(deps.createContext).not.toHaveBeenCalled();
    expect(deps.execute).not.toHaveBeenCalled();
  });

  it("prechecks an oversized Content-Length without reading the body", async () => {
    let bodyRead = false;
    const oversized = {
      headers: new Headers({
        Authorization: `Bearer ${VALID_TOKEN}`,
        "X-CUM-Version": "1",
        "Content-Type": "application/json",
        "Content-Length": "16385",
      }),
      get body() {
        bodyRead = true;
        return null;
      },
    } as unknown as Request;
    const deps = dependencies();

    const response = await createOperationsRouteHandlers(deps).POST(oversized);

    expect(response.status).toBe(413);
    expect(bodyRead).toBe(false);
    expect(deps.createContext).not.toHaveBeenCalled();
  });

  it("rejects streamed byte 16,385 even when Content-Length claims one byte", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16_384));
        controller.enqueue(new Uint8Array(1));
        controller.close();
      },
    });
    const oversized = new Request("https://example.com/operations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VALID_TOKEN}`,
        "X-CUM-Version": "1",
        "Content-Type": "application/json",
        "Content-Length": "1",
      },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const deps = dependencies();

    const response = await createOperationsRouteHandlers(deps).POST(oversized);

    expect(response.status).toBe(413);
    expect(deps.createContext).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid UTF-8", new Uint8Array([0xc3, 0x28])],
    ["invalid JSON", '{"tenantId":'],
    ["strict schema", JSON.stringify({
      tenantId: TENANT_ID,
      operationId: OPERATION_ID,
      actorUid: ACTOR_UID,
      action: "list_users",
      payload: { page: 1, pageSize: 25 },
      extra: true,
    })],
  ])("returns 422 for %s before client/service", async (_label, body) => {
    const deps = dependencies();

    const response = await createOperationsRouteHandlers(deps).POST(
      request(body),
    );

    expect(response.status).toBe(422);
    expect(deps.createContext).not.toHaveBeenCalled();
    expect(deps.execute).not.toHaveBeenCalled();
  });

  it.each([
    ["operationId version", {
      operationId: "123e4567-e89b-02d3-a456-426614174001",
    }],
    ["actorUid variant", {
      actorUid: "123e4567-e89b-42d3-7456-426614174002",
    }],
  ])(
    "rejects an invalid UUID %s before hashing, context, or dispatch",
    async (_label, invalidIdentity) => {
      const digest = vi.fn();
      const deps = dependencies();
      const body = JSON.stringify({
        tenantId: TENANT_ID,
        operationId: OPERATION_ID,
        actorUid: ACTOR_UID,
        action: "list_users",
        payload: { page: 1, pageSize: 25 },
        ...invalidIdentity,
      });

      const response = await createOperationsRouteHandlers({
        ...deps,
        crypto: { subtle: { digest } } as Pick<Crypto, "subtle">,
      }).POST(request(body));

      expect(response.status).toBe(422);
      expect(digest).not.toHaveBeenCalled();
      expect(deps.createContext).not.toHaveBeenCalled();
      expect(deps.execute).not.toHaveBeenCalled();
    },
  );

  it("returns 403 for a parsed cross-Tenant body before hashing/client/service", async () => {
    const digest = vi.fn();
    const deps = dependencies();
    const body = JSON.stringify({
      tenantId: "123e4567-e89b-42d3-a456-426614174099",
      operationId: OPERATION_ID,
      actorUid: ACTOR_UID,
      action: "list_users",
      payload: { page: 1, pageSize: 25 },
    });

    const response = await createOperationsRouteHandlers({
      ...deps,
      crypto: { subtle: { digest } } as Pick<Crypto, "subtle">,
    }).POST(request(body));

    expect(response.status).toBe(403);
    expect(digest).not.toHaveBeenCalled();
    expect(deps.createContext).not.toHaveBeenCalled();
    expect(deps.execute).not.toHaveBeenCalled();
  });

  it("hashes exact bytes, creates one context, dispatches once, and envelopes success", async () => {
    const deps = dependencies();

    const response = await createOperationsRouteHandlers(deps).POST(
      request(LIST_BODY),
    );

    expect(response.status).toBe(200);
    expect(deps.createContext).toHaveBeenCalledOnce();
    expect(deps.createContext).toHaveBeenCalledWith(
      CONFIG,
      "a2e53f446b787ba5a7eba02fe6fa8e56a72de7260d6bb588bacd6d2b5c07955e",
    );
    expect(deps.execute).toHaveBeenCalledOnce();
    expectAgentHeaders(response);
    await expect(response.json()).resolves.toEqual({
      tenantId: TENANT_ID,
      protocolVersion: 1,
      operationId: OPERATION_ID,
      status: "completed",
      stage: "listed",
      result: {
        users: [],
        pagination: { page: 1, pageSize: 25, hasMore: false },
      },
    });
  });

  it("dispatches an exact retry once and projects no invented password", async () => {
    const execute = vi.fn(async () => ({
      operationId: OPERATION_ID,
      status: "completed" as const,
      stage: "completed",
      result: {
        user: {
          userId: "123e4567-e89b-42d3-a456-426614174003",
          email: "admin@example.com",
          status: "password_change_required" as const,
          createdAt: "2026-07-29T00:00:00.000Z",
          lastSignInAt: null,
          credentialVersion: 1,
          authCredentialVersion: 1,
        },
      },
    }));
    const deps = dependencies({ execute });

    const response = await createOperationsRouteHandlers(deps).POST(
      request(MUTATION_BODY),
    );

    expect(execute).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tenantId: TENANT_ID,
      protocolVersion: 1,
      operationId: OPERATION_ID,
      status: "completed",
      stage: "completed",
      result: {
        user: {
          userId: "123e4567-e89b-42d3-a456-426614174003",
          email: "admin@example.com",
          status: "password_change_required",
          createdAt: "2026-07-29T00:00:00.000Z",
          lastSignInAt: null,
          credentialVersion: 1,
          authCredentialVersion: 1,
        },
      },
    });
  });

  it("rejects a service operation ID that differs from the parsed request", async () => {
    const execute = vi.fn(async () => ({
      operationId: "123e4567-e89b-42d3-a456-426614174099",
      status: "completed" as const,
      stage: "listed",
      result: {
        users: [],
        pagination: { page: 1, pageSize: 25, hasMore: false },
      },
    }));

    const response = await createOperationsRouteHandlers(
      dependencies({ execute }),
    ).POST(request());

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(
      "123e4567-e89b-42d3-a456-426614174099",
    );
  });

  it.each([
    ["in_progress", 409],
    ["needs_review", 409],
    ["quarantined", 409],
  ] as const)("maps %s operation state to %i", async (status, expectedStatus) => {
    const execute = vi.fn(async () => ({
      operationId: OPERATION_ID,
      status,
      stage:
        status === "in_progress"
          ? "claimed"
          : status,
      error:
        status === "in_progress"
          ? {
              code: "lease_conflict",
              message: "The operation lease is owned by another request.",
            }
          : status === "needs_review"
            ? {
                code: "identity_mismatch",
                message: "The Auth user and admin profile do not match.",
              }
            : {
                code: "operation_quarantined",
                message: "The operation is permanently quarantined.",
              },
    }));

    const response = await createOperationsRouteHandlers(
      dependencies({ execute }),
    ).POST(request());

    expect(response.status).toBe(expectedStatus);
    expectAgentHeaders(response);
  });

  it("fails closed on a temporary password in a completed list response", async () => {
    const password = "Temp-Password-123!Aa";
    const execute = vi.fn(async () => ({
      operationId: OPERATION_ID,
      status: "completed" as const,
      stage: "listed",
      result: {
        users: [],
        pagination: { page: 1, pageSize: 25, hasMore: false },
        temporaryPassword: password,
      },
      provider: {
        access_token: "access-token",
        refresh_token: "refresh-token",
      },
    }));

    const response = await createOperationsRouteHandlers(
      dependencies({ execute }),
    ).POST(request());
    expect(response.status).toBe(503);
    expectAgentHeaders(response);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "agent_unavailable",
        message: "Central User Manager Agent is unavailable.",
      },
    });
  });

  it.each([
    "create_user",
    "reissue_temporary_password",
    "reactivate_user",
  ] as const)(
    "returns a first completed %s temporary password",
    async (action) => {
      const password = "Temp-Password-123!Aa";
      const body = JSON.stringify({
        tenantId: TENANT_ID,
        operationId: OPERATION_ID,
        actorUid: ACTOR_UID,
        action,
        payload: { email: "admin@example.com" },
      });
      const execute = vi.fn(async () => ({
        operationId: OPERATION_ID,
        status: "completed" as const,
        stage: "completed",
        result: {
          user: {
            userId: "123e4567-e89b-42d3-a456-426614174003",
            email: "admin@example.com",
            status: "password_change_required" as const,
            createdAt: "2026-07-29T00:00:00.000Z",
            lastSignInAt: null,
            credentialVersion: 1,
            authCredentialVersion: 1,
          },
          temporaryPassword: password,
        },
      }));

      const response = await createOperationsRouteHandlers(
        dependencies({ execute }),
      ).POST(request(body));

      expect(response.status).toBe(200);
      expect(await response.text()).toContain(password);
    },
  );

  it.each([
    ["suspend_user", "completed"],
    ["reissue_temporary_password", "needs_review"],
  ] as const)(
    "fails closed on a temporary password for %s in %s state",
    async (action, status) => {
      const password = "Temp-Password-123!Aa";
      const body = JSON.stringify({
        tenantId: TENANT_ID,
        operationId: OPERATION_ID,
        actorUid: ACTOR_UID,
        action,
        payload: { email: "admin@example.com" },
      });
      const execute = vi.fn(async () => ({
        operationId: OPERATION_ID,
        status,
        stage: status === "completed" ? "completed" : "needs_review",
        result: { temporaryPassword: password },
        ...(status === "needs_review"
          ? {
              error: {
                code: "identity_mismatch",
                message: "Safe message.",
              },
            }
          : {}),
      }));

      const response = await createOperationsRouteHandlers(
        dependencies({ execute }),
      ).POST(request(body));

      expect(response.status).toBe(503);
      expectAgentHeaders(response);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "agent_unavailable",
          message: "Central User Manager Agent is unavailable.",
        },
      });
    },
  );

  it.each(["active", "suspended"] as const)(
    "returns an exact password-free create duplicate for an existing %s user",
    async (status) => {
      const duplicateBody = JSON.stringify({
        tenantId: TENANT_ID,
        operationId: OPERATION_ID,
        actorUid: ACTOR_UID,
        action: "create_user",
        payload: { email: "admin@example.com" },
      });
      const user = {
        userId: "123e4567-e89b-42d3-a456-426614174003",
        email: "admin@example.com",
        status,
        createdAt: "2026-07-29T00:00:00.000Z",
        lastSignInAt: null,
        credentialVersion: 1,
        authCredentialVersion: 1,
      };
      const execute = vi.fn(async () => ({
        operationId: OPERATION_ID,
        status: "completed" as const,
        stage: "completed",
        result: { user },
        error: {
          code: "user_exists",
          message: "An admin user already exists for this email.",
        },
      }));

      const response = await createOperationsRouteHandlers(
        dependencies({ execute }),
      ).POST(request(duplicateBody));

      expect(response.status).toBe(200);
      expectAgentHeaders(response);
      await expect(response.json()).resolves.toEqual({
        tenantId: TENANT_ID,
        protocolVersion: 1,
        operationId: OPERATION_ID,
        status: "completed",
        stage: "completed",
        result: { user },
        error: {
          code: "user_exists",
          message: "An admin user already exists for this email.",
        },
      });
    },
  );

  it.each(["toString", "__proto__", "constructor"])(
    "fails closed when the service error code is inherited key %s",
    async (code) => {
      const execute = vi.fn(async () => ({
        operationId: OPERATION_ID,
        status: "needs_review" as const,
        stage: "claimed",
        error: { code, message: undefined },
      }));

      const response = await createOperationsRouteHandlers(
        dependencies({ execute }),
      ).POST(request());

      expect(response.status).toBe(503);
      expectAgentHeaders(response);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "agent_unavailable",
          message: "Central User Manager Agent is unavailable.",
        },
      });
    },
  );

  it.each(["database_unavailable", "provider_failure"])(
    "maps a safe %s availability failure to 503 without raw details",
    async (code) => {
      const execute = vi.fn(async () => ({
        operationId: OPERATION_ID,
        status: "needs_review" as const,
        stage: "claimed",
        error: {
          code,
          message: "Unable to complete request.",
          details: "provider secret",
        },
      }));

      const response = await createOperationsRouteHandlers(
        dependencies({ execute }),
      ).POST(request());
      const text = await response.text();

      expect(response.status).toBe(503);
      expect(text).not.toContain("provider secret");
      expectAgentHeaders(response);
    },
  );
});
