import { describe, expect, it } from "vitest";

import type { CentralUserManagerAgentConfig } from "../config";
import type { AgentOperationResponse } from "../contracts";
import type { CentralUserRpcRequest } from "../rpc-contract";
import { projectSafeCentralUserOperation } from "../safe-result";

const TENANT_ID = "123e4567-e89b-42d3-a456-426614174000";
const OPERATION_ID = "123e4567-e89b-42d3-a456-426614174001";
const CONFIG = { tenantId: TENANT_ID } as CentralUserManagerAgentConfig;
const LIST_REQUEST = {
  protocolVersion: 1 as const,
  tenantId: TENANT_ID,
  operationId: OPERATION_ID,
  actorUid: "123e4567-e89b-42d3-a456-426614174002",
  action: "list_users" as const,
  payload: { page: 1, pageSize: 25 },
};
const MUTATION_REQUEST = {
  ...LIST_REQUEST,
  action: "reissue_temporary_password" as const,
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

function project(
  operation: AgentOperationResponse,
  request: CentralUserRpcRequest = LIST_REQUEST,
) {
  return projectSafeCentralUserOperation(CONFIG, request, operation);
}

describe("safe Central User Manager RPC result projection", () => {
  it("returns an exact safe list operation", () => {
    expect(project({
      operationId: OPERATION_ID,
      status: "completed",
      stage: "listed",
      result: {
        users: [USER],
        pagination: { page: 1, pageSize: 25, hasMore: false },
      },
      providerMetadata: { accessToken: "must-not-escape" },
    } as never)).toEqual({
      operationId: OPERATION_ID,
      status: "completed",
      stage: "listed",
      result: {
        users: [USER],
        pagination: { page: 1, pageSize: 25, hasMore: false },
      },
    });
  });

  it("returns a one-time password only for the allowed mutation actions", () => {
    expect(project({
      operationId: OPERATION_ID,
      status: "completed",
      stage: "completed",
      result: { user: USER, temporaryPassword: TEMPORARY_PASSWORD },
    }, MUTATION_REQUEST)).toEqual({
      operationId: OPERATION_ID,
      status: "completed",
      stage: "completed",
      result: { user: USER, temporaryPassword: TEMPORARY_PASSWORD },
    });

    expect(project({
      operationId: OPERATION_ID,
      status: "completed",
      stage: "completed",
      result: { user: { ...USER, status: "suspended" }, temporaryPassword: TEMPORARY_PASSWORD },
    }, {
      ...MUTATION_REQUEST,
      action: "suspend_user",
    })).toBeNull();
  });

  it("redacts malformed operation envelopes instead of reflecting raw errors", () => {
    const secret = "provider secret detail";
    expect(project({
      operationId: OPERATION_ID,
      status: "needs_review",
      stage: "claimed",
      error: { code: "provider_failure", message: secret },
    })).toBeNull();
  });
});
