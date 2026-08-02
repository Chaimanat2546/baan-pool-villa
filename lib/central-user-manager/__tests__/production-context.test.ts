import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CentralUserManagerAgentConfig } from "../config";
import type { CentralUserManagerAdminClient } from "../operation-repository";
import { createProductionCentralUserOperationContext } from "../production-context";

const CONFIG: CentralUserManagerAgentConfig = {
  enabled: true,
  tenantId: "123e4567-e89b-42d3-a456-426614174000",
  projectRef: "abcdefghijklmnopqrst",
  supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
  supabaseSecretKey: "sb_secret_example",
};

const REQUEST_HASH = "a".repeat(64);
const USER_ID = "123e4567-e89b-42d3-a456-426614174003";
const OPERATION_ID = "123e4567-e89b-42d3-a456-426614174001";

function providerUser() {
  return {
    id: USER_ID,
    email: "admin@example.com",
    created_at: "2026-07-29T00:00:00.000Z",
    email_confirmed_at: "2026-07-29T00:00:00.000Z",
    last_sign_in_at: null,
    banned_until: null,
    app_metadata: {
      credential_version: 1,
      bpv_admin_managed: true,
      bpv_created_operation_id: OPERATION_ID,
    },
  };
}

describe("Central User Manager production context", () => {
  it("creates one privileged client and binds list to the approved read-only SQL owner", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { users: [], hasMore: false },
      error: null,
    });
    const client = {
      rpc,
      auth: { admin: {} },
    } as unknown as CentralUserManagerAdminClient;
    const createAdminClient = vi.fn(() => client);

    const context = createProductionCentralUserOperationContext(
      CONFIG,
      REQUEST_HASH,
      { createAdminClient },
    );
    const listed = await context.list.listPage({ page: 1, pageSize: 25 });

    expect(createAdminClient).toHaveBeenCalledOnce();
    expect(createAdminClient).toHaveBeenCalledWith(CONFIG);
    expect(listed).toEqual({
      ok: true,
      data: { users: [], hasMore: false },
    });
    expect(rpc).toHaveBeenCalledWith("list_reconciled_admin_users_v1", {
      p_page: 1,
      p_page_size: 25,
    });
  });

  it("keeps mutations Auth Admin API-backed on the same client and uses the same config for transient clients", async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: { user: providerUser() },
      error: null,
    });
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: {
        user: providerUser(),
        session: {
          access_token: "transient-access-token",
          user: providerUser(),
        },
      },
      error: null,
    });
    const mainClient = {
      rpc: vi.fn(),
      auth: { admin: { createUser } },
    } as unknown as CentralUserManagerAdminClient;
    const transientClient = {
      rpc: vi.fn(),
      auth: { signInWithPassword },
    } as unknown as CentralUserManagerAdminClient;
    const createAdminClient = vi
      .fn()
      .mockReturnValueOnce(mainClient)
      .mockReturnValueOnce(transientClient);
    const context = createProductionCentralUserOperationContext(
      CONFIG,
      REQUEST_HASH,
      {
        createAdminClient,
        now: () => Date.parse("2026-07-29T01:00:00.000Z"),
      },
    );
    const deadline = {
      timeoutMs: 10_000,
      leaseExpiresAt: "2026-07-29T01:00:30.000Z",
      now: () => Date.parse("2026-07-29T01:00:00.000Z"),
    };

    await expect(
      context.auth.createManagedUser(
        {
          email: "admin@example.com",
          password: "Temp-Password-123!Aa",
          operationId: OPERATION_ID,
        },
        deadline,
      ),
    ).resolves.toMatchObject({ ok: true, data: { id: USER_ID } });
    await expect(
      context.auth.verifyPassword(
        {
          email: "admin@example.com",
          password: "Temp-Password-123!Aa",
          expectedUserId: USER_ID,
        },
        deadline,
      ),
    ).resolves.toEqual({
      ok: true,
      data: { accessToken: "transient-access-token" },
    });

    expect(createUser).toHaveBeenCalledOnce();
    expect(createAdminClient.mock.calls).toEqual([[CONFIG], [CONFIG]]);
    expect(context.requestHash).toBe(REQUEST_HASH);
  });
});
