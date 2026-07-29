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

function operationResponse(
  operation: AgentOperationResponse,
  request: AgentOperationRequest = LIST_REQUEST,
) {
  return operationRouteResponse(CONFIG, request, operation);
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
          : { code: "lease_conflict", message: "Safe message." },
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

  it.each(["database_unavailable", "provider_failure"])(
    "maps safe pre-dispatch availability error %s to 503",
    (code) => {
      const response = operationResponse({
        operationId: OPERATION_ID,
        status: "needs_review",
        stage: "claimed",
        error: { code, message: "Unable to complete request." },
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
});
