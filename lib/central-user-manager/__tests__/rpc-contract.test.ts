import { describe, expect, it } from "vitest";

import { AgentContractError } from "../contracts";
import {
  hashCentralUserRpcRequest,
  parseCentralUserRpcRequest,
  type CentralUserRpcRequest,
} from "../rpc-contract";

const requestIds = {
  tenantId: "123e4567-e89b-42d3-a456-426614174000",
  operationId: "123e4567-e89b-42d3-a456-426614174001",
  actorUid: "123e4567-e89b-42d3-a456-426614174002",
};

function listRequest(overrides: Record<string, unknown> = {}) {
  return {
    protocolVersion: 1,
    ...requestIds,
    action: "list_users",
    payload: { page: 1, pageSize: 20 },
    ...overrides,
  };
}

function mutationRequest(
  action:
    | "create_user"
    | "reissue_temporary_password"
    | "suspend_user"
    | "reactivate_user" = "create_user",
  overrides: Record<string, unknown> = {},
) {
  return {
    protocolVersion: 1,
    ...requestIds,
    action,
    payload: { email: "admin@example.com" },
    ...overrides,
  };
}

describe("central user RPC contract", () => {
  it("accepts protocol version 1 and every supported action", () => {
    expect(parseCentralUserRpcRequest(listRequest())).toEqual(listRequest());

    for (const action of [
      "create_user",
      "reissue_temporary_password",
      "suspend_user",
      "reactivate_user",
    ] as const) {
      expect(parseCentralUserRpcRequest(mutationRequest(action))).toEqual(
        mutationRequest(action),
      );
    }
  });

  it("accepts only exact own request and payload keys", () => {
    const inheritedRequest = Object.assign(Object.create({ ignored: true }), {
      ...listRequest(),
    });
    const inheritedPayload = Object.assign(Object.create({ ignored: true }), {
      page: 1,
      pageSize: 20,
    });

    for (const request of [
      listRequest({ ignored: true }),
      listRequest({ payload: { page: 1, pageSize: 20, ignored: true } }),
      Object.assign(listRequest(), { payload: inheritedPayload }),
      inheritedRequest,
    ]) {
      expect(() => parseCentralUserRpcRequest(request)).toThrow(
        AgentContractError,
      );
    }
  });

  it("rejects protocol versions other than numeric version 1", () => {
    for (const protocolVersion of [0, 2, "1", null]) {
      expect(() =>
        parseCentralUserRpcRequest(listRequest({ protocolVersion })),
      ).toThrow(AgentContractError);
    }
  });

  it.each([
    ["tenantId", "123e4567e89b42d3a456426614174000"],
    ["operationId", "123e4567-e89b-02d3-a456-426614174001"],
    ["actorUid", "123e4567-e89b-42d3-7456-426614174002"],
  ])("rejects a non-canonical %s UUID", (field, invalidUuid) => {
    expect(() =>
      parseCentralUserRpcRequest(listRequest({ [field]: invalidUuid })),
    ).toThrow(AgentContractError);
  });

  it("rejects list page values outside the supported integer bounds", () => {
    for (const payload of [
      { page: 0, pageSize: 1 },
      { page: 101, pageSize: 1 },
      { page: 1, pageSize: 0 },
      { page: 1, pageSize: 101 },
      { page: 1.5, pageSize: 1 },
    ]) {
      expect(() => parseCentralUserRpcRequest(listRequest({ payload }))).toThrow(
        AgentContractError,
      );
    }
  });

  it("normalizes a mutation email before returning the canonical request", () => {
    expect(
      parseCentralUserRpcRequest(
        mutationRequest("create_user", {
          payload: { email: " ADMIN@EXAMPLE.COM " },
        }),
      ),
    ).toMatchObject({ payload: { email: "admin@example.com" } });
  });

  it("hashes the canonical request independently of input key order", async () => {
    const left = parseCentralUserRpcRequest({
      protocolVersion: 1,
      tenantId: requestIds.tenantId,
      operationId: requestIds.operationId,
      actorUid: requestIds.actorUid,
      action: "create_user",
      payload: { email: " ADMIN@EXAMPLE.COM " },
    });
    const right = parseCentralUserRpcRequest({
      payload: { email: "admin@example.com" },
      action: "create_user",
      actorUid: requestIds.actorUid,
      operationId: requestIds.operationId,
      tenantId: requestIds.tenantId,
      protocolVersion: 1,
    });

    expect(await hashCentralUserRpcRequest(left)).toBe(
      await hashCentralUserRpcRequest(right),
    );
  });

  it("changes the hash when any canonical request field changes", async () => {
    const request = parseCentralUserRpcRequest(listRequest());
    if (request.action !== "list_users") {
      throw new Error("Expected a list request.");
    }
    const originalHash = await hashCentralUserRpcRequest(request);
    const changes: CentralUserRpcRequest[] = [
      { ...request, tenantId: "123e4567-e89b-42d3-a456-426614174003" },
      { ...request, operationId: "123e4567-e89b-42d3-a456-426614174004" },
      { ...request, actorUid: "123e4567-e89b-42d3-a456-426614174005" },
      {
        ...request,
        action: "create_user" as const,
        payload: { email: "admin@example.com" },
      },
      { ...request, payload: { page: 2, pageSize: 20 } },
      { ...request, payload: { page: 1, pageSize: 21 } },
    ];

    for (const changedRequest of changes) {
      expect(await hashCentralUserRpcRequest(changedRequest)).not.toBe(
        originalHash,
      );
    }

    const mutation = parseCentralUserRpcRequest(mutationRequest());
    if (mutation.action === "list_users") {
      throw new Error("Expected a mutation request.");
    }
    expect(
      await hashCentralUserRpcRequest({
        ...mutation,
        payload: { email: "other@example.com" },
      }),
    ).not.toBe(await hashCentralUserRpcRequest(mutation));
  });
});
