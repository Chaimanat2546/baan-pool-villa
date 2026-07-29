import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CentralAdminUser } from "../contracts";
import { executeCentralUserOperation } from "../operation-service";
import {
  OPERATION_ID,
  operationContext,
} from "./operation-service.test-helpers";

const request = {
  tenantId: "123e4567-e89b-42d3-a456-426614174000",
  operationId: OPERATION_ID,
  actorUid: "123e4567-e89b-42d3-a456-426614174002",
  action: "list_users" as const,
  payload: { page: 1, pageSize: 3 },
};

function listedUser(
  overrides: Partial<CentralAdminUser> = {},
): CentralAdminUser {
  return {
    userId: "123e4567-e89b-42d3-a456-426614174003",
    email: "admin@example.com",
    status: "active",
    createdAt: "2026-07-29T00:00:00.000Z",
    lastSignInAt: "2026-07-29T00:30:00.000Z",
    credentialVersion: 2,
    authCredentialVersion: 2,
    ...overrides,
  };
}

describe("Central User Manager list operation", () => {
  it("returns the exact reconciled RPC page without mutation owners", async () => {
    const users = [
      listedUser(),
      listedUser({
        userId: "123e4567-e89b-42d3-a456-426614174004",
        email: "profile-only@example.com",
        status: "abnormal",
        lastSignInAt: null,
        authCredentialVersion: null,
      }),
      listedUser({
        userId: "123e4567-e89b-42d3-a456-426614174005",
        email: "shared@example.com",
        status: "abnormal",
      }),
    ];
    const context = operationContext({
      list: {
        listPage: async (input) =>
          input.page === 1 && input.pageSize === 3
            ? { ok: true, data: { users, hasMore: true } }
            : {
                ok: false,
                error: {
                  code: "profile_data_invalid",
                  message: "Admin profile data is invalid.",
                },
              },
      },
    });

    const response = await executeCentralUserOperation(context, request);

    expect(response).toEqual({
      operationId: OPERATION_ID,
      status: "completed",
      stage: "listed",
      result: {
        users,
        pagination: { page: 1, pageSize: 3, hasMore: true },
      },
    });
  });

  it("preserves stable disjoint pages supplied by the SQL owner", async () => {
    const firstUser = listedUser({
      userId: "123e4567-e89b-42d3-a456-426614174010",
      email: "a@example.com",
    });
    const secondUser = listedUser({
      userId: "123e4567-e89b-42d3-a456-426614174011",
      email: "b@example.com",
    });
    const context = operationContext({
      list: {
        listPage: async ({ page, pageSize }) => ({
          ok: true,
          data: {
            users:
              pageSize === 1
                ? page === 1
                  ? [firstUser]
                  : [secondUser]
                : [],
            hasMore: page === 1,
          },
        }),
      },
    });

    const first = await executeCentralUserOperation(context, {
      ...request,
      payload: { page: 1, pageSize: 1 },
    });
    const second = await executeCentralUserOperation(context, {
      ...request,
      operationId: "123e4567-e89b-42d3-a456-426614174099",
      payload: { page: 2, pageSize: 1 },
    });

    expect(first.result?.users).toEqual([firstUser]);
    expect(second.result?.users).toEqual([secondUser]);
  });

  it("preserves global cross-page conflict status from the RPC snapshot", async () => {
    const firstConflict = listedUser({
      userId: "123e4567-e89b-42d3-a456-426614174020",
      email: "shared@example.com",
      status: "abnormal",
    });
    const laterConflict = listedUser({
      userId: "123e4567-e89b-42d3-a456-426614174021",
      email: "shared@example.com",
      status: "abnormal",
    });
    const context = operationContext({
      list: {
        listPage: async ({ page }) => ({
          ok: true,
          data: {
            users: [page === 1 ? firstConflict : laterConflict],
            hasMore: page === 1,
          },
        }),
      },
    });

    const first = await executeCentralUserOperation(context, {
      ...request,
      payload: { page: 1, pageSize: 1 },
    });
    const second = await executeCentralUserOperation(context, {
      ...request,
      operationId: "123e4567-e89b-42d3-a456-426614174098",
      payload: { page: 2, pageSize: 1 },
    });

    expect(first.result?.users?.[0]?.status).toBe("abnormal");
    expect(second.result?.users?.[0]?.status).toBe("abnormal");
  });

  it("never advertises page 101 even if a malformed owner says more", async () => {
    const context = operationContext({
      list: {
        listPage: async () => ({
          ok: true,
          data: { users: [listedUser()], hasMore: true },
        }),
      },
    });

    const response = await executeCentralUserOperation(context, {
      ...request,
      payload: { page: 100, pageSize: 1 },
    });

    expect(response.result?.pagination).toEqual({
      page: 100,
      pageSize: 1,
      hasMore: false,
    });
  });

  it("maps a reconciled-list repository failure to one safe response", async () => {
    const context = operationContext({
      list: {
        listPage: async () => ({
          ok: false,
          error: {
            code: "database_unavailable",
            message: "The operation database is unavailable.",
          },
        }),
      },
    });

    const response = await executeCentralUserOperation(context, request);

    expect(response).toEqual({
      operationId: OPERATION_ID,
      status: "needs_review",
      stage: "list",
      error: {
        code: "database_unavailable",
        message: "The operation database is unavailable.",
      },
    });
  });
});
