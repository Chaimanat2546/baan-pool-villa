import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CentralUserManagerAdminClient } from "../operation-repository";
import {
  activateAdminProfileForOperation,
  advanceAdminProfileForOperation,
  createAdminProfileForOperation,
  findAdminProfileByUserId,
  findAdminProfilesByNormalizedEmail,
  prepareAdminUserCreateCompensation,
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
  const ordered = { order: undefined as unknown, range };
  const order = vi.fn(() => ordered);
  ordered.order = order;
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
      "create_admin_user_profile_for_operation_v2",
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
      "advance_admin_user_profile_for_operation_v2",
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
      "activate_admin_user_profile_for_operation_v2",
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

  it("maps the suspension CAS RPC's returned profile shape", async () => {
    const fake = fakeClient({
      rpcData: profileRow({
        is_active: false,
        must_change_password: true,
        credential_version: 2,
      }),
    });

    await expect(
      advanceAdminProfileForOperation(
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
          nextMustChangePassword: true,
          nextCredentialVersion: 2,
        },
        { client: fake.client },
      ),
    ).resolves.toEqual({
      ok: true,
      data: {
        userId: USER_ID,
        email: EMAIL,
        role: "admin",
        isActive: false,
        mustChangePassword: true,
        credentialVersion: 2,
        createdAt: "2026-07-29T00:00:00.000Z",
      },
    });
  });

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

  it("prepares create compensation only through the operation-bound absence RPC", async () => {
    const fake = fakeClient({
      rpcData: {
        operation_id: OPERATION_ID,
        actor_kind: "central_admin",
        actor_uid: USER_ID,
        action: "create_user",
        target_user_id: USER_ID,
        target_email_normalized: EMAIL,
        request_hash: "a".repeat(64),
        status: "leased",
        stage: "compensation_ready",
        fence_version: 1,
        attempt_count: 1,
        lease_expires_at: "2026-07-29T01:00:30.000Z",
        safe_result: null,
        safe_error_code: null,
        safe_error_message: null,
      },
    });

    await expect(
      prepareAdminUserCreateCompensation(
        {
          operationId: OPERATION_ID,
          fenceVersion: 1,
          leaseToken: LEASE_TOKEN,
          userId: USER_ID,
          email: EMAIL,
        },
        { client: fake.client },
      ),
    ).resolves.toMatchObject({
      ok: true,
      data: { stage: "compensation_ready" },
    });
    expect(fake.rpc).toHaveBeenCalledWith(
      "prepare_admin_user_create_compensation_v2",
      {
        p_operation_id: OPERATION_ID,
        p_fence_version: 1,
        p_lease_token_hash: RAW_TOKEN_HASH,
        p_user_id: USER_ID,
        p_email_normalized: EMAIL,
      },
    );
  });

});
