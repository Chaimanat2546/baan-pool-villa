import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AGENT_RESPONSE_HEADERS,
  operationRouteResponse,
  readBoundedRequestBytes,
  sha256Hex,
} from "../route-response";
import type { CentralUserManagerAgentConfig } from "../config";
import type {
  AgentOperationRequest,
  AgentOperationResponse,
} from "../contracts";

const TENANT_ID = "123e4567-e89b-42d3-a456-426614174000";
const OPERATION_ID = "123e4567-e89b-42d3-a456-426614174001";
const LIST_REQUEST: AgentOperationRequest = {
  tenantId: TENANT_ID,
  operationId: OPERATION_ID,
  actorUid: "123e4567-e89b-42d3-a456-426614174002",
  action: "list_users",
  payload: { page: 1, pageSize: 25 },
};
const CONFIG = {
  tenantId: TENANT_ID,
} as CentralUserManagerAgentConfig;
const MUTATION_REQUEST: AgentOperationRequest = {
  ...LIST_REQUEST,
  action: "reissue_temporary_password",
  payload: { email: "admin@example.com" },
};
const USER = {
  userId: "123e4567-e89b-42d3-a456-426614174003",
  email: "admin@example.com",
  status: "password_change_required" as const,
  createdAt: "2026-07-29T00:00:00.000Z",
  lastSignInAt: null,
  credentialVersion: 1,
  authCredentialVersion: 1,
};
const TEMPORARY_PASSWORD = "Temp-Password-123!Aa";

function operationResponse(
  operation: AgentOperationResponse,
  request: AgentOperationRequest = LIST_REQUEST,
) {
  return operationRouteResponse(CONFIG, request, operation);
}

async function expectStaticUnavailable(response: Response) {
  expect(response.status).toBe(503);
  expect(Object.fromEntries(
    Object.entries({
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    }).map(([name]) => [name, response.headers.get(name)]),
  )).toEqual({
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  await expect(response.json()).resolves.toEqual({
    error: {
      code: "agent_unavailable",
      message: "Central User Manager Agent is unavailable.",
    },
  });
}

describe("Central User Manager route response helpers", () => {
  it("accepts exactly 16,384 streamed bytes and rejects byte 16,385", async () => {
    const accepted = new Request("https://example.com/operations", {
      method: "POST",
      body: new Uint8Array(16_384),
    });
    const rejected = new Request("https://example.com/operations", {
      method: "POST",
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(16_000));
          controller.enqueue(new Uint8Array(385));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readBoundedRequestBytes(accepted)).resolves.toMatchObject({
      ok: true,
      bytes: expect.objectContaining({ byteLength: 16_384 }),
    });
    await expect(readBoundedRequestBytes(rejected)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("prechecks only a valid oversized Content-Length and still streams without trusting it", async () => {
    let oversizedBodyRead = false;
    const prechecked = {
      headers: new Headers({ "Content-Length": "16385" }),
      get body() {
        oversizedBodyRead = true;
        return null;
      },
    } as unknown as Request;
    const untrustedHeader = new Request("https://example.com/operations", {
      method: "POST",
      headers: { "Content-Length": "1" },
      body: new Uint8Array(16_385),
    });

    await expect(readBoundedRequestBytes(prechecked)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
    expect(oversizedBodyRead).toBe(false);
    await expect(readBoundedRequestBytes(untrustedHeader)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("hashes the exact accepted bytes to lowercase SHA-256 hex", async () => {
    await expect(
      sha256Hex(new TextEncoder().encode('{"tenantId":"exact"}')),
    ).resolves.toBe(
      "f8303573da7039ab7dd4d89b67fa88d89ee15fc5b80369422c7a45b720885e9c",
    );
  });

  it.each([
    ["completed", 200],
    ["in_progress", 409],
    ["needs_review", 409],
    ["quarantined", 409],
  ] as const)("maps %s to HTTP %i and projects only safe fields", async (status, httpStatus) => {
    const response = operationResponse({
      operationId: OPERATION_ID,
      status,
      stage: status === "completed" ? "listed" : "claimed",
      result:
        status === "completed"
          ? {
              users: [],
              pagination: { page: 1, pageSize: 25, hasMore: false },
            }
          : undefined,
      error:
        status === "completed"
          ? undefined
          : status === "in_progress"
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
      providerMetadata: { access_token: "must-not-escape" },
    } as never);

    expect(response.status).toBe(httpStatus);
    expect(Object.fromEntries(
      Object.keys(AGENT_RESPONSE_HEADERS).map((name) => [
        name,
        response.headers.get(name),
      ]),
    )).toEqual(AGENT_RESPONSE_HEADERS);
    const body = await response.json();
    expect(body).toMatchObject({
      tenantId: TENANT_ID,
      protocolVersion: 1,
      operationId: OPERATION_ID,
      status,
      stage: status === "completed" ? "listed" : "claimed",
    });
    expect(JSON.stringify(body)).not.toContain("providerMetadata");
    expect(JSON.stringify(body)).not.toContain("access_token");
  });

  it.each([
    [
      "database_unavailable",
      "The operation database is unavailable.",
    ],
    ["provider_failure", "Unable to complete request."],
  ])(
    "maps safe pre-dispatch availability error %s to 503",
    (code, message) => {
      const response = operationResponse({
        operationId: OPERATION_ID,
        status: "needs_review",
        stage: "claimed",
        error: { code, message },
      });

      expect(response.status).toBe(503);
    },
  );

  it("fails closed instead of reflecting a malformed service envelope", async () => {
    const response = operationResponse({
      operationId: OPERATION_ID,
      status: "provider secret status",
      stage: "provider secret stage",
    } as never);

    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("provider secret");
  });

  it("rejects a noncanonical service operation ID", () => {
    const response = operationResponse({
      operationId: "123e4567-e89b-02d3-a456-426614174001",
      status: "completed",
      stage: "completed",
    });

    expect(response.status).toBe(503);
  });

  it("rejects a canonical service operation ID that differs from the request", () => {
    const response = operationResponse({
      operationId: "123e4567-e89b-42d3-a456-426614174099",
      status: "completed",
      stage: "completed",
    });

    expect(response.status).toBe(503);
  });

  it("rejects a request hash disguised as an operation stage", async () => {
    const requestHash = "a".repeat(64);
    const response = operationResponse({
      operationId: OPERATION_ID,
      status: "completed",
      stage: requestHash,
    });

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(requestHash);
  });

  it("rejects a malformed safe user DTO", () => {
    const createRequest: AgentOperationRequest = {
      ...LIST_REQUEST,
      action: "create_user",
      payload: { email: "admin@example.com" },
    };
    const response = operationResponse({
      operationId: OPERATION_ID,
      status: "completed",
      stage: "completed",
      result: {
        user: {
          userId: "123e4567-e89b-02d3-a456-426614174003",
          email: "admin@example.com",
          status: "active",
          createdAt: "2026-07-29T00:00:00.000Z",
          lastSignInAt: null,
          credentialVersion: 1,
          authCredentialVersion: 1,
        },
      },
    }, createRequest);

    expect(response.status).toBe(503);
  });

  it("fails closed when a completed list result carries a password", async () => {
    await expectStaticUnavailable(operationResponse({
      operationId: OPERATION_ID,
      status: "completed",
      stage: "listed",
      result: {
        users: [],
        pagination: { page: 1, pageSize: 25, hasMore: false },
        temporaryPassword: TEMPORARY_PASSWORD,
      },
    }));
  });

  it("fails closed when a completed suspend result carries a password", async () => {
    await expectStaticUnavailable(operationResponse({
      operationId: OPERATION_ID,
      status: "completed",
      stage: "completed",
      result: {
        user: { ...USER, status: "suspended" },
        temporaryPassword: TEMPORARY_PASSWORD,
      },
    }, {
      ...MUTATION_REQUEST,
      action: "suspend_user",
    }));
  });

  it.each(["in_progress", "needs_review", "quarantined"] as const)(
    "fails closed when a %s result carries a password",
    async (status) => {
      await expectStaticUnavailable(operationResponse({
        operationId: OPERATION_ID,
        status,
        stage: status === "in_progress" ? "claimed" : status,
        result: { temporaryPassword: TEMPORARY_PASSWORD },
        error: {
          code: "lease_conflict",
          message: "The operation lease is owned by another request.",
        },
      }, MUTATION_REQUEST));
    },
  );

  it.each([
    ["wrong length", "short"],
    ["non-printable", `Temp-Password-123!A\n`],
  ])("fails closed for a %s temporary password", async (_label, password) => {
    await expectStaticUnavailable(operationResponse({
      operationId: OPERATION_ID,
      status: "completed",
      stage: "completed",
      result: { user: USER, temporaryPassword: password },
    }, MUTATION_REQUEST));
  });

  it("fails closed for a password without a valid bound user", async () => {
    await expectStaticUnavailable(operationResponse({
      operationId: OPERATION_ID,
      status: "completed",
      stage: "completed",
      result: { temporaryPassword: TEMPORARY_PASSWORD },
    }, MUTATION_REQUEST));
  });

  it("fails closed for a password combined with an error", async () => {
    await expectStaticUnavailable(operationResponse({
      operationId: OPERATION_ID,
      status: "completed",
      stage: "completed",
      result: { user: USER, temporaryPassword: TEMPORARY_PASSWORD },
      error: {
        code: "provider_failure",
        message: "Unable to complete request.",
      },
    }, MUTATION_REQUEST));
  });

  it.each([
    ["prototype toString", "toString", undefined],
    ["prototype constructor", "constructor", undefined],
    ["prototype __proto__", "__proto__", undefined],
    ["undefined code", undefined, undefined],
    ["non-string code", 17, "Unable to complete request."],
    ["undefined message", "provider_failure", undefined],
    ["non-string message", "provider_failure", 17],
  ])(
    "fails closed for a %s safe-error field",
    async (_label, code, message) => {
      await expectStaticUnavailable(operationResponse({
        operationId: OPERATION_ID,
        status: "needs_review",
        stage: "claimed",
        error: { code, message },
      } as never));
    },
  );
});
