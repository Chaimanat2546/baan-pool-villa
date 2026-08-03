import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CentralUserManagerAdminClient } from "../operation-repository";
import { listReconciledAdminUsers } from "../reconciled-list-repository";

const USER_ID = "123e4567-e89b-42d3-a456-426614174003";

function reconciledUser(overrides: Record<string, unknown> = {}) {
  return {
    userId: USER_ID,
    email: "admin@example.com",
    status: "active",
    createdAt: "2026-07-29T00:00:00.000Z",
    lastSignInAt: "2026-07-29T00:30:00.000Z",
    credentialVersion: 2,
    authCredentialVersion: 2,
    ...overrides,
  };
}

function fakeClient(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return {
    client: { rpc } as unknown as CentralUserManagerAdminClient,
    rpc,
  };
}

describe("Central User Manager reconciled list repository", () => {
  it("maps one strict RPC page and forwards the exact requested bounds", async () => {
    const fake = fakeClient({
      users: [
        reconciledUser(),
        reconciledUser({
          userId: "123e4567-e89b-42d3-a456-426614174004",
          email: "profile-only@example.com",
          status: "abnormal",
          lastSignInAt: null,
          authCredentialVersion: null,
        }),
        reconciledUser({
          userId: "123e4567-e89b-42d3-a456-426614174005",
          email: "shared@example.com",
          status: "abnormal",
        }),
      ],
      hasMore: true,
    });

    const result = await listReconciledAdminUsers(
      { page: 2, pageSize: 3 },
      { client: fake.client },
    );

    expect(result).toEqual({
      ok: true,
      data: {
        users: [
          reconciledUser(),
          reconciledUser({
            userId: "123e4567-e89b-42d3-a456-426614174004",
            email: "profile-only@example.com",
            status: "abnormal",
            lastSignInAt: null,
            authCredentialVersion: null,
          }),
          reconciledUser({
            userId: "123e4567-e89b-42d3-a456-426614174005",
            email: "shared@example.com",
            status: "abnormal",
          }),
        ],
        hasMore: true,
      },
    });
    expect(fake.rpc).toHaveBeenCalledWith(
      "list_reconciled_admin_users_v1",
      { p_page: 2, p_page_size: 3 },
    );
  });

  it.each([
    ["extra top-level data", { users: [], hasMore: false, metadata: {} }],
    [
      "extra user data",
      { users: [reconciledUser({ rawAppMetadata: {} })], hasMore: false },
    ],
    [
      "unnormalized email",
      {
        users: [reconciledUser({ email: " Admin@example.com " })],
        hasMore: false,
      },
    ],
    [
      "invalid status",
      { users: [reconciledUser({ status: "pending" })], hasMore: false },
    ],
    [
      "invalid version",
      {
        users: [reconciledUser({ authCredentialVersion: 0 })],
        hasMore: false,
      },
    ],
    [
      "invalid timestamp",
      { users: [reconciledUser({ createdAt: "not-a-date" })], hasMore: false },
    ],
    ["more than the requested page", {
      users: [reconciledUser(), reconciledUser()],
      hasMore: false,
    }],
  ])("fails closed without throwing on %s", async (_label, data) => {
    const fake = fakeClient(data);

    await expect(
      listReconciledAdminUsers(
        { page: 1, pageSize: 1 },
        { client: fake.client },
      ),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "profile_data_invalid",
        message: "Admin profile data is invalid.",
      },
    });
  });

  it.each([
    { page: 0, pageSize: 1 },
    { page: 101, pageSize: 1 },
    { page: 1, pageSize: 0 },
    { page: 1, pageSize: 101 },
    { page: 1.5, pageSize: 1 },
  ])("rejects invalid page bounds before RPC dispatch", async (input) => {
    const fake = fakeClient({ users: [], hasMore: false });

    const result = await listReconciledAdminUsers(input, {
      client: fake.client,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "profile_data_invalid" },
    });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("maps database failures to one static safe error", async () => {
    const fake = fakeClient(null, {
      message: "permission denied and secret internal detail",
      details: "must not escape",
    });

    await expect(
      listReconciledAdminUsers(
        { page: 1, pageSize: 25 },
        { client: fake.client },
      ),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "database_unavailable",
        message: "The operation database is unavailable.",
      },
    });
  });

  it("contains thrown client failures", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("raw provider detail"));
    const client = { rpc } as unknown as CentralUserManagerAdminClient;

    await expect(
      listReconciledAdminUsers({ page: 1, pageSize: 25 }, { client }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "database_unavailable" },
    });
  });
});
