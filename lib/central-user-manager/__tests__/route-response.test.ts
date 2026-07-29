import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AGENT_RESPONSE_HEADERS,
  operationRouteResponse,
  readBoundedRequestBytes,
  sha256Hex,
} from "../route-response";

const TENANT_ID = "123e4567-e89b-42d3-a456-426614174000";
const OPERATION_ID = "123e4567-e89b-42d3-a456-426614174001";

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
    const response = operationRouteResponse(TENANT_ID, {
      operationId: OPERATION_ID,
      status,
      stage: "safe_stage",
      result: {
        user: {
          userId: "123e4567-e89b-42d3-a456-426614174003",
          email: "admin@example.com",
          status: "password_change_required",
          createdAt: "2026-07-29T00:00:00.000Z",
          lastSignInAt: null,
          credentialVersion: 2,
          authCredentialVersion: 2,
        },
        temporaryPassword: "Temp-Password-123!Aa",
      },
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
      stage: "safe_stage",
    });
    expect(JSON.stringify(body)).not.toContain("providerMetadata");
    expect(JSON.stringify(body)).not.toContain("access_token");
  });

  it.each(["database_unavailable", "provider_failure"])(
    "maps safe pre-dispatch availability error %s to 503",
    (code) => {
      const response = operationRouteResponse(TENANT_ID, {
        operationId: OPERATION_ID,
        status: "needs_review",
        stage: "claimed",
        error: { code, message: "Unable to complete request." },
      });

      expect(response.status).toBe(503);
    },
  );

  it("fails closed instead of reflecting a malformed service envelope", async () => {
    const response = operationRouteResponse(TENANT_ID, {
      operationId: OPERATION_ID,
      status: "provider secret status",
      stage: "provider secret stage",
    } as never);

    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("provider secret");
  });

  it("rejects a noncanonical service operation ID", () => {
    const response = operationRouteResponse(TENANT_ID, {
      operationId: "123e4567-e89b-02d3-a456-426614174001",
      status: "completed",
      stage: "completed",
    });

    expect(response.status).toBe(503);
  });
});
