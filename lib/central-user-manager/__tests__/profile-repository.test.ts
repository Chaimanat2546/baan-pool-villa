import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CentralUserManagerAdminClient } from "../operation-repository";
import {
  activateAdminProfileForOperation,
  advanceAdminProfileForOperation,
  createAdminProfileForOperation,
  findAdminProfileByUserId,
  findAdminProfilesByNormalizedEmail,
  listAdminProfilesPage,
} from "../profile-repository";
import {
  EMAIL,
  LEASE_TOKEN,
  OPERATION_ID,
  USER_ID,
} from "./operation-service.test-helpers";

const RAW_TOKEN_HASH =
  "51ba74f36309561d27467971631a4af71ed1766442e05ae0d4f7be21d3875e75";

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    user_id: USER_ID,
    email: EMAIL,
    role: "admin",
    is_active: true,
    must_change_password: true,
    credential_version: 1,
    created_at: "2026-07-29T00:00:00.000Z",
    ...overrides,
  };
}

function fakeClient(options: {
  rows?: unknown[];
  rpcData?: unknown;
  error?: unknown;
} = {}) {
  const response = {
    data: options.rows ?? [],
    error: options.error ?? null,
    count: options.rows?.length ?? 0,
  };
  const range = vi.fn().mockResolvedValue(response);
  const limit = vi.fn().mockResolvedValue(response);
  const eq = vi.fn(() => ({ limit }));
  const order = vi.fn(() => ({ range }));
  const select = vi.fn(() => ({ order, eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue({
    data: options.rpcData ?? profileRow(),
    error: options.error ?? null,
  });

  return {
    client: { from, rpc } as unknown as CentralUserManagerAdminClient,
    from,
    select,
    order,
    range,
    eq,
    limit,
    rpc,
  };
}

describe("Central User Manager profile repository", () => {
  it("maps a bounded admin profile page through an exact projection", async () => {
    const fake = fakeClient({ rows: [profileRow()] });

    const result = await listAdminProfilesPage(
      { page: 2, pageSize: 25 },
      { client: fake.client },
    );

    expect(result).toEqual({
      ok: true,
      data: {
        profiles: [
          {
            userId: USER_ID,
            email: EMAIL,
            role: "admin",
            isActive: true,
            mustChangePassword: true,
            credentialVersion: 1,
            createdAt: "2026-07-29T00:00:00.000Z",
          },
        ],
        hasMore: false,
      },
    });
    expect(fake.from).toHaveBeenCalledWith("admin_users");
    expect(fake.select).toHaveBeenCalledWith(
      "user_id,email,role,is_active,must_change_password,credential_version,created_at",
    );
    expect(fake.order).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });
    expect(fake.range).toHaveBeenCalledWith(25, 49);
  });

  it("uses exact normalized email/UID filters and fails closed on duplicate rows", async () => {
    const emailFake = fakeClient({
      rows: [profileRow(), profileRow({ user_id: "duplicate" })],
    });
    await expect(
      findAdminProfilesByNormalizedEmail(
        { email: EMAIL },
        { client: emailFake.client },
      ),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "profile_data_invalid",
        message: "Admin profile data is invalid.",
      },
    });
    expect(emailFake.eq).toHaveBeenCalledWith("email", EMAIL);
    expect(emailFake.limit).toHaveBeenCalledWith(2);

    const uidFake = fakeClient({ rows: [profileRow()] });
    await expect(
      findAdminProfileByUserId(
        { userId: USER_ID },
        { client: uidFake.client },
      ),
    ).resolves.toMatchObject({ ok: true, data: { userId: USER_ID } });
    expect(uidFake.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });

  it.each([
    [
      "create_admin_user_profile_for_operation",
      createAdminProfileForOperation,
      {
        operationId: OPERATION_ID,
        fenceVersion: 1,
        leaseToken: LEASE_TOKEN,
        userId: USER_ID,
        email: EMAIL,
      },
      {
        p_operation_id: OPERATION_ID,
        p_fence_version: 1,
        p_lease_token_hash: RAW_TOKEN_HASH,
        p_user_id: USER_ID,
        p_email_normalized: EMAIL,
      },
    ],
    [
      "advance_admin_user_profile_for_operation",
      advanceAdminProfileForOperation,
      {
        operationId: OPERATION_ID,
        fenceVersion: 1,
        leaseToken: LEASE_TOKEN,
        userId: USER_ID,
        email: EMAIL,
        expectedIsActive: true,
        expectedMustChangePassword: false,
        expectedCredentialVersion: 1,
        nextIsActive: false,
        nextMustChangePassword: false,
        nextCredentialVersion: 2,
      },
      {
        p_operation_id: OPERATION_ID,
        p_fence_version: 1,
        p_lease_token_hash: RAW_TOKEN_HASH,
        p_user_id: USER_ID,
        p_email_normalized: EMAIL,
        p_expected_is_active: true,
        p_expected_must_change_password: false,
        p_expected_credential_version: 1,
        p_next_is_active: false,
        p_next_must_change_password: false,
        p_next_credential_version: 2,
      },
    ],
    [
      "activate_admin_user_profile_for_operation",
      activateAdminProfileForOperation,
      {
        operationId: OPERATION_ID,
        fenceVersion: 1,
        leaseToken: LEASE_TOKEN,
        userId: USER_ID,
        email: EMAIL,
        credentialVersion: 2,
      },
      {
        p_operation_id: OPERATION_ID,
        p_fence_version: 1,
        p_lease_token_hash: RAW_TOKEN_HASH,
        p_user_id: USER_ID,
        p_email_normalized: EMAIL,
        p_credential_version: 2,
      },
    ],
  ] as const)(
    "calls %s with the hashed lease and strict CAS state",
    async (rpcName, owner, input, expectedParams) => {
      const fake = fakeClient({ rpcData: profileRow() });

      await expect(
        owner(input as never, { client: fake.client }),
      ).resolves.toMatchObject({ ok: true, data: { userId: USER_ID } });
      expect(fake.rpc).toHaveBeenCalledWith(rpcName, expectedParams);
      expect(JSON.stringify(fake.rpc.mock.calls)).not.toContain(LEASE_TOKEN);
    },
  );

  it("rejects stale/malformed RPC rows without reflecting database details", async () => {
    const fake = fakeClient({
      rpcData: { ...profileRow(), credential_version: 0 },
      error: {
        code: "P0001",
        message: "profile_state_conflict",
        details: "sensitive SQL state",
        hint: "sensitive hint",
      },
    });

    const result = await createAdminProfileForOperation(
      {
        operationId: OPERATION_ID,
        fenceVersion: 1,
        leaseToken: LEASE_TOKEN,
        userId: USER_ID,
        email: EMAIL,
      },
      { client: fake.client },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "profile_state_conflict",
        message: "Admin profile state changed.",
      },
    });
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });
});
