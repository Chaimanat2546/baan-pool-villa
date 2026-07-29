import { describe, expect, it, vi } from "vitest";

import { executeCentralUserOperation } from "../operation-service";
import {
  ACTOR_UID,
  EMAIL,
  OPERATION_ID,
  OTHER_USER_ID,
  TENANT_ID,
  operationContext,
  profile,
  providerSuccess,
  providerUser,
} from "./operation-service.test-helpers";

vi.mock("server-only", () => ({}));

const request = {
  tenantId: TENANT_ID,
  operationId: OPERATION_ID,
  actorUid: ACTOR_UID,
  action: "list_users" as const,
  payload: { page: 1, pageSize: 100 },
};

describe("Central User Manager list operation", () => {
  it("joins exact UIDs, keeps one-sided rows abnormal, and never claims a lease", async () => {
    const context = operationContext({
      auth: {
        listPage: async () =>
          providerSuccess({
            users: [
              providerUser(),
              providerUser({
                id: OTHER_USER_ID,
                email: "auth-only@example.com",
              }),
            ],
            hasMore: false,
          }),
      },
      profiles: {
        listPage: async () => ({
          ok: true,
          data: {
            profiles: [
              profile(),
              profile({
                userId: "123e4567-e89b-42d3-a456-426614174005",
                email: "profile-only@example.com",
              }),
            ],
            hasMore: false,
          },
        }),
      },
    });

    const response = await executeCentralUserOperation(context, request);

    expect(response.result?.users).toEqual([
      expect.objectContaining({
        userId: "123e4567-e89b-42d3-a456-426614174003",
        email: EMAIL,
        status: "password_change_required",
      }),
      expect.objectContaining({
        userId: OTHER_USER_ID,
        email: "auth-only@example.com",
        status: "abnormal",
      }),
      expect.objectContaining({
        userId: "123e4567-e89b-42d3-a456-426614174005",
        email: "profile-only@example.com",
        status: "abnormal",
      }),
    ]);
    expect(context.operations.claim).not.toHaveBeenCalled();
  });

  it("marks normalized-email collisions and version/managed mismatches abnormal", async () => {
    const conflictingUid = "123e4567-e89b-42d3-a456-426614174006";
    const context = operationContext({
      auth: {
        listPage: async () =>
          providerSuccess({
            users: [
              providerUser(),
              providerUser({
                id: conflictingUid,
                email: " ADMIN@example.com ",
                appMetadata: {
                  bpv_admin_managed: true,
                  credential_version: 2,
                },
              }),
              providerUser({
                id: "123e4567-e89b-42d3-a456-426614174007",
                email: "version@example.com",
                appMetadata: {
                  bpv_admin_managed: false,
                  credential_version: 0,
                },
              }),
            ],
            hasMore: false,
          }),
      },
      profiles: {
        listPage: async () => ({
          ok: true,
          data: {
            profiles: [
              profile(),
              profile({
                userId: "123e4567-e89b-42d3-a456-426614174007",
                email: "version@example.com",
                credentialVersion: 2,
              }),
            ],
            hasMore: false,
          },
        }),
      },
    });

    const users = (await executeCentralUserOperation(context, request)).result
      ?.users;

    expect(users?.map((user) => user.status)).toEqual([
      "abnormal",
      "abnormal",
      "abnormal",
    ]);
  });

  it.each([
    [true, false, "active"],
    [true, true, "password_change_required"],
    [false, false, "suspended"],
    [false, true, "suspended"],
  ] as const)(
    "maps active=%s forced=%s to %s",
    async (isActive, mustChangePassword, expectedStatus) => {
      const context = operationContext({
        profiles: {
          listPage: async () => ({
            ok: true,
            data: {
              profiles: [profile({ isActive, mustChangePassword })],
              hasMore: false,
            },
          }),
        },
      });

      const response = await executeCentralUserOperation(context, request);

      expect(response.result?.users?.[0]?.status).toBe(expectedStatus);
    },
  );

  it("bounds both pages and the safe returned shape to 100 users", async () => {
    const providerUsers = Array.from({ length: 100 }, (_, index) =>
      providerUser({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        email: `admin-${index}@example.com`,
      }),
    );
    const profiles = providerUsers.map((user, index) =>
      profile({
        userId: user.id,
        email: user.email,
        credentialVersion: 1,
        mustChangePassword: index % 2 === 0,
      }),
    );
    const context = operationContext({
      auth: {
        listPage: async (input) => {
          expect(input).toEqual({ page: 1, pageSize: 100 });
          return providerSuccess({ users: providerUsers, hasMore: true });
        },
      },
      profiles: {
        listPage: async (input) => {
          expect(input).toEqual({ page: 1, pageSize: 100 });
          return { ok: true, data: { profiles, hasMore: true } };
        },
      },
    });

    const response = await executeCentralUserOperation(context, request);
    const serialized = JSON.stringify(response);

    expect(response.result?.users).toHaveLength(100);
    expect(response.result?.pagination).toEqual({
      page: 1,
      pageSize: 100,
      hasMore: true,
    });
    expect(Object.keys(response.result?.users?.[0] ?? {}).sort()).toEqual([
      "authCredentialVersion",
      "createdAt",
      "credentialVersion",
      "email",
      "lastSignInAt",
      "status",
      "userId",
    ]);
    expect(serialized).not.toContain("appMetadata");
    expect(serialized).not.toContain("bpv_created_operation_id");
  });
});
