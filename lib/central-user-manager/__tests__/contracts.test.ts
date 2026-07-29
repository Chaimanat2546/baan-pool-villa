import { describe, expect, it } from "vitest";

import {
  AgentContractError,
  parseAgentOperationRequest,
} from "../contracts";
import { normalizeAdminEmail } from "../email";
import { normalizeSafeAgentError } from "../safe-errors";

const requestIds = {
  tenantId: "123e4567-e89b-42d3-a456-426614174000",
  operationId: "123e4567-e89b-42d3-a456-426614174001",
  actorUid: "123e4567-e89b-42d3-a456-426614174002",
};

describe("central user manager contracts", () => {
  it("accepts only canonical UUID identifiers and the exact list payload", () => {
    expect(
      parseAgentOperationRequest({
        ...requestIds,
        action: "list_users",
        payload: { page: 1, pageSize: 100 },
      }),
    ).toEqual({
      ...requestIds,
      action: "list_users",
      payload: { page: 1, pageSize: 100 },
    });

    expect(() =>
      parseAgentOperationRequest({
        ...requestIds,
        tenantId: "123e4567e89b42d3a456426614174000",
        action: "list_users",
        payload: { page: 1, pageSize: 1 },
      }),
    ).toThrow(AgentContractError);
  });

  it("accepts exactly the supported mutation actions with an email payload", () => {
    for (const action of [
      "create_user",
      "reissue_temporary_password",
      "suspend_user",
      "reactivate_user",
    ]) {
      expect(
        parseAgentOperationRequest({
          ...requestIds,
          action,
          payload: { email: "admin@example.com" },
        }),
      ).toMatchObject({ action, payload: { email: "admin@example.com" } });
    }
  });

  it("rejects unknown keys, action-payload mismatches, and invalid page bounds", () => {
    const invalidRequests = [
      {
        ...requestIds,
        action: "list_users",
        payload: { page: 1, pageSize: 1 },
        ignored: true,
      },
      {
        ...requestIds,
        action: "list_users",
        payload: { page: 1, pageSize: 1, ignored: true },
      },
      {
        ...requestIds,
        action: "list_users",
        payload: { email: "admin@example.com" },
      },
      {
        ...requestIds,
        action: "create_user",
        payload: { page: 1, pageSize: 1 },
      },
      {
        ...requestIds,
        action: "list_users",
        payload: { page: 0, pageSize: 1 },
      },
      {
        ...requestIds,
        action: "list_users",
        payload: { page: 1, pageSize: 101 },
      },
    ];

    for (const request of invalidRequests) {
      expect(() => parseAgentOperationRequest(request)).toThrow(
        expect.objectContaining({ code: "invalid_request", status: 422 }),
      );
    }
  });

  it("normalizes an admin email and rejects a non-string or blank value", () => {
    expect(normalizeAdminEmail("  ADMIN@Example.COM ")).toBe(
      "admin@example.com",
    );
    expect(() => normalizeAdminEmail("   ")).toThrow(AgentContractError);
    expect(() => normalizeAdminEmail(null)).toThrow(AgentContractError);
  });

  it("returns a bounded fallback error without exposing arbitrary provider data", () => {
    expect(
      normalizeSafeAgentError(
        { message: "provider token: secret", stack: "provider stack" },
        { code: "provider_failure", message: "Unable to complete request." },
      ),
    ).toEqual({
      code: "provider_failure",
      message: "Unable to complete request.",
    });
    expect(() =>
      normalizeSafeAgentError(null, {
        code: "INVALID_REQUEST",
        message: "x".repeat(241),
      }),
    ).toThrow();
  });
});
