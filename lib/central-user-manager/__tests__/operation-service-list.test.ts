import { describe, expect, it, vi } from "vitest";

import { executeCentralUserOperation } from "../operation-service";
import {
  ACTOR_UID,
  EMAIL,
  OPERATION_ID,
  OTHER_USER_ID,
  TENANT_ID,
  USER_ID,
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
        listRange: async () =>
          providerSuccess({
            users: [
              providerUser(),
              providerUser({
                id: OTHER_USER_ID,
                email: "auth-only@example.com",
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
        listRange: async () => ({
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
        userId: "123e4567-e89b-42d3-a456-426614174005",
        email: "profile-only@example.com",
        status: "abnormal",
      }),
      expect.objectContaining({
        userId: OTHER_USER_ID,
        email: "auth-only@example.com",
        status: "abnormal",
      }),
    ]);
    expect(context.operations.claim).not.toHaveBeenCalled();
  });

  it("marks normalized-email collisions and version/managed mismatches abnormal", async () => {
    const conflictingUid = "123e4567-e89b-42d3-a456-426614174006";
    const context = operationContext({
      auth: {
        listRange: async () =>
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
        listRange: async () => ({
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
          listRange: async () => ({
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
        listRange: async (input) => {
          expect(input).toEqual({ offset: 0, limit: 50 });
          return providerSuccess({ users: providerUsers, hasMore: true });
        },
      },
      profiles: {
        listRange: async (input) => {
          expect(input).toEqual({ offset: 0, limit: 50 });
          return { ok: true, data: { profiles, hasMore: true } };
        },
      },
    });

    const response = await executeCentralUserOperation(context, request);
    const serialized = JSON.stringify(response);

    expect(response.result?.users).toHaveLength(50);
    expect(response.result?.users?.length).toBeLessThanOrEqual(100);
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

  it("reserves deterministic slots for disjoint sources across pages", async () => {
    const authUsers = Array.from({ length: 100 }, (_, index) =>
      providerUser({
        id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        email: `auth-${index}@example.com`,
      }),
    );
    const profileUsers = Array.from({ length: 100 }, (_, index) =>
      profile({
        userId: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        email: `profile-${index}@example.com`,
      }),
    );
    const context = operationContext({
      auth: {
        listRange: async ({ offset, limit }) =>
          providerSuccess({
            users: authUsers.slice(offset, offset + limit),
            hasMore: offset + limit < authUsers.length,
          }),
      },
      profiles: {
        listRange: async ({ offset, limit }) => ({
          ok: true,
          data: {
            profiles: profileUsers.slice(offset, offset + limit),
            hasMore: offset + limit < profileUsers.length,
          },
        }),
      },
    });

    const first = await executeCentralUserOperation(context, {
      ...request,
      payload: { page: 1, pageSize: 100 },
    });
    const second = await executeCentralUserOperation(context, {
      ...request,
      operationId: "123e4567-e89b-42d3-a456-426614174099",
      payload: { page: 2, pageSize: 100 },
    });
    const firstIds = first.result?.users?.map((user) => user.userId) ?? [];
    const secondIds = second.result?.users?.map((user) => user.userId) ?? [];

    expect(firstIds).toHaveLength(100);
    expect(secondIds).toHaveLength(100);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(200);
    expect(firstIds[0]).toBe(authUsers[0]?.id);
    expect(firstIds[1]).toBe(profileUsers[0]?.userId);
    expect(secondIds[0]).toBe(authUsers[50]?.id);
    expect(secondIds[1]).toBe(profileUsers[50]?.userId);
  });

  it("uses positive lookahead ranges and reports the next source for pageSize one", async () => {
    const context = operationContext({
      profiles: {
        listRange: vi.fn(async ({ limit }) => ({
          ok: true,
          data: {
            profiles: limit > 0 ? [profile()] : [],
            hasMore: false,
          },
        })),
      },
    });

    const response = await executeCentralUserOperation(context, {
      ...request,
      payload: { page: 1, pageSize: 1 },
    });

    expect(response.status).toBe("completed");
    expect(response.result?.pagination?.hasMore).toBe(true);
    expect(
      vi.mocked(context.profiles.listRange).mock.calls.every(
        ([input]) => input.limit > 0,
      ),
    ).toBe(true);
  });

  it("joins cross-window exact UID pairs once through canonical Auth ownership", async () => {
    const a = providerUser({
      id: USER_ID,
      email: "a@example.com",
    });
    const b = providerUser({
      id: OTHER_USER_ID,
      email: "b@example.com",
    });
    const profiles = [
      profile({ userId: b.id, email: b.email }),
      profile({ userId: a.id, email: a.email }),
    ];
    const context = operationContext({
      auth: {
        listRange: async ({ offset, limit }) =>
          providerSuccess({
            users: [a, b].slice(offset, offset + limit),
            hasMore: offset + limit < 2,
          }),
        findByUserId: async ({ userId }) =>
          providerSuccess([a, b].find((user) => user.id === userId) ?? null),
      },
      profiles: {
        listRange: async ({ offset, limit }) => ({
          ok: true,
          data: {
            profiles: profiles.slice(offset, offset + limit),
            hasMore: offset + limit < 2,
          },
        }),
        findByUserId: async ({ userId }) => ({
          ok: true,
          data:
            profiles.find((item) => item.userId === userId) ?? null,
        }),
      },
    });

    const first = await executeCentralUserOperation(context, {
      ...request,
      payload: { page: 1, pageSize: 2 },
    });
    const second = await executeCentralUserOperation(context, {
      ...request,
      operationId: "123e4567-e89b-42d3-a456-426614174098",
      payload: { page: 2, pageSize: 2 },
    });
    const users = [
      ...(first.result?.users ?? []),
      ...(second.result?.users ?? []),
    ];

    expect(users.map((user) => user.userId)).toEqual([a.id, b.id]);
    expect(users.every((user) => user.status !== "abnormal")).toBe(true);
  });
});
