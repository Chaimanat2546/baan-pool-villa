import { describe, expect, it, vi } from "vitest";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthUnknownError,
  AuthWeakPasswordError,
} from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

import {
  createManagedAuthUser,
  deleteManagedAuthUser,
  findAuthUserById,
  findAuthUserByNormalizedEmail,
  findAuthUsersByNormalizedEmail,
  globallySignOutAccessToken,
  listAuthUsersPage,
  listAuthUsersRange,
  transientlyVerifyPassword,
  updateManagedAuthUser,
  type AuthProviderDependencies,
  type ProviderUser,
} from "../auth-provider";

const NOW_MS = Date.parse("2026-07-29T01:00:00.000Z");
const OPERATION_ID = "123e4567-e89b-42d3-a456-426614174001";
const USER_ID = "123e4567-e89b-42d3-a456-426614174002";

function authUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "admin@example.com",
    phone: "",
    created_at: "2026-07-29T00:00:00.000Z",
    confirmed_at: "2026-07-29T00:00:00.000Z",
    email_confirmed_at: "2026-07-29T00:00:00.000Z",
    last_sign_in_at: "2026-07-29T00:30:00.000Z",
    updated_at: "2026-07-29T00:30:00.000Z",
    banned_until: "2026-08-29T00:00:00.000Z",
    app_metadata: {
      provider: "email",
      providers: ["email"],
    },
    user_metadata: {
      display_name: "Must never authorize this user",
    },
    identities: [],
    is_anonymous: false,
    ...overrides,
  };
}

function providerUser(overrides: Partial<ProviderUser> = {}): ProviderUser {
  return {
    id: USER_ID,
    email: "admin@example.com",
    createdAt: "2026-07-29T00:00:00.000Z",
    emailConfirmedAt: "2026-07-29T00:00:00.000Z",
    lastSignInAt: "2026-07-29T00:30:00.000Z",
    bannedUntil: null,
    appMetadata: {
      provider: "email",
      providers: ["email"],
      bpv_admin_managed: true,
      bpv_created_operation_id: OPERATION_ID,
      credential_version: 1,
    },
    ...overrides,
  };
}

function dependencies(overrides: {
  client?: unknown;
  createTransientClient?: () => unknown;
  timeoutMs?: number;
  leaseExpiresAt?: string;
} = {}): AuthProviderDependencies {
  const client =
    overrides.client ??
    ({
      auth: {
        admin: {
          listUsers: vi.fn(),
          createUser: vi.fn(),
          updateUserById: vi.fn(),
          signOut: vi.fn(),
        },
      },
    } as const);

  return {
    client: client as AuthProviderDependencies["client"],
    createTransientClient:
      (overrides.createTransientClient as AuthProviderDependencies["createTransientClient"]) ??
      (() => client as AuthProviderDependencies["client"]),
    deadline: {
      timeoutMs: overrides.timeoutMs ?? 100,
      leaseExpiresAt:
        overrides.leaseExpiresAt ??
        new Date(NOW_MS + 10_000).toISOString(),
      now: () => NOW_MS,
    },
  };
}

describe("Central User Manager Supabase Auth provider", () => {
  it("lists the requested bounded page and maps only the closed user shape", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [authUser()],
        aud: "authenticated",
        nextPage: 2,
        lastPage: 2,
        total: 2,
      },
      error: null,
    });
    const deps = dependencies({
      client: { auth: { admin: { listUsers } } },
    });

    const result = await listAuthUsersPage({ page: 1, pageSize: 1 }, deps);

    expect(result).toEqual({
      ok: true,
      data: {
        users: [
          {
            id: USER_ID,
            email: "admin@example.com",
            createdAt: "2026-07-29T00:00:00.000Z",
            emailConfirmedAt: "2026-07-29T00:00:00.000Z",
            lastSignInAt: "2026-07-29T00:30:00.000Z",
            bannedUntil: "2026-08-29T00:00:00.000Z",
            appMetadata: {
              provider: "email",
              providers: ["email"],
            },
          },
        ],
        hasMore: true,
      },
    });
    expect(listUsers).toHaveBeenCalledWith({ page: 1, perPage: 1 });
    expect(JSON.stringify(result)).not.toContain("user_metadata");
  });

  it.each([0, 101, 1.5])(
    "rejects an out-of-range adapter page size before dispatch: %s",
    async (pageSize) => {
      const listUsers = vi.fn();
      const deps = dependencies({
        client: { auth: { admin: { listUsers } } },
      });

      await expect(
        listAuthUsersPage({ page: 1, pageSize }, deps),
      ).resolves.toEqual({
        ok: false,
        error: {
          code: "provider_rejected",
          message: "Supabase Auth rejected the operation.",
        },
        ambiguous: false,
      });
      expect(listUsers).not.toHaveBeenCalled();
    },
  );

  it("reads an arbitrary bounded range without losing the next source row", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      authUser({
        id: `range-${index}`,
        email: `range-${index}@example.com`,
      }),
    );
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: firstPage,
        nextPage: null,
      },
      error: null,
    });
    const deps = dependencies({
      client: { auth: { admin: { listUsers } } },
    });

    const result = await listAuthUsersRange(
      { offset: 25, limit: 50 },
      deps,
    );

    expect(result.ok && result.data.users[0]?.id).toBe("range-25");
    expect(result.ok && result.data.users.at(-1)?.id).toBe("range-74");
    expect(result.ok && result.data.hasMore).toBe(true);
    expect(listUsers).toHaveBeenCalledWith({ page: 1, perPage: 100 });
  });

  it("gets one exact Auth identity by UID through the closed projection", async () => {
    const getUserById = vi.fn().mockResolvedValue({
      data: { user: authUser() },
      error: null,
    });

    const result = await findAuthUserById(
      { userId: USER_ID },
      dependencies({
        client: { auth: { admin: { getUserById } } },
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      data: { id: USER_ID, email: "admin@example.com" },
    });
    expect(getUserById).toHaveBeenCalledWith(USER_ID);
    expect(JSON.stringify(result)).not.toContain("user_metadata");
  });

  it("finds an exact normalized email across 100-user pages", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      authUser({
        id: `first-page-${index}`,
        email: `user-${index}@example.com`,
      }),
    );
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          users: firstPage,
          aud: "authenticated",
          nextPage: 2,
          lastPage: 2,
          total: 101,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          users: [authUser({ email: "  ADMIN@Example.COM " })],
          aud: "authenticated",
          nextPage: null,
          lastPage: 2,
          total: 101,
        },
        error: null,
      });
    const deps = dependencies({
      client: { auth: { admin: { listUsers } } },
    });

    const result = await findAuthUserByNormalizedEmail(
      { email: " Admin@example.com " },
      deps,
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        id: USER_ID,
        email: "  ADMIN@Example.COM ",
      },
    });
    expect(listUsers.mock.calls).toEqual([
      [{ page: 1, perPage: 100 }],
      [{ page: 2, perPage: 100 }],
    ]);
  });

  it("returns at most two normalized email matches so the service can fail closed", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          authUser({ id: "first", email: " Admin@example.com " }),
          authUser({ id: "second", email: "admin@example.com" }),
          authUser({ id: "third", email: "ADMIN@EXAMPLE.COM" }),
        ],
        aud: "authenticated",
        nextPage: null,
        lastPage: 1,
        total: 3,
      },
      error: null,
    });
    const deps = dependencies({
      client: { auth: { admin: { listUsers } } },
    });

    await expect(
      findAuthUsersByNormalizedEmail({ email: "admin@example.com" }, deps),
    ).resolves.toEqual({
      ok: true,
      data: [
        expect.objectContaining({ id: "first" }),
        expect.objectContaining({ id: "second" }),
      ],
    });
  });

  it("returns a closed pagination-limit result when the lookup cap is exhausted", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: Array.from({ length: 100 }, (_, index) =>
          authUser({
            id: `full-page-${index}`,
            email: `user-${index}@example.com`,
          }),
        ),
        aud: "authenticated",
        nextPage: 2,
        lastPage: 2,
        total: 200,
      },
      error: null,
    });
    const deps = dependencies({
      client: { auth: { admin: { listUsers } } },
    });

    await expect(
      findAuthUserByNormalizedEmail(
        { email: "missing@example.com", maxPages: 1 },
        deps,
      ),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "provider_pagination_limit",
        message: "Supabase Auth pagination limit was reached.",
      },
      ambiguous: false,
    });
  });

  it("rejects a lookup cap above 100 before dispatch", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: Array.from({ length: 100 }, (_, index) =>
          authUser({
            id: `over-cap-page-${index}`,
            email: `over-cap-${index}@example.com`,
          }),
        ),
        aud: "authenticated",
        nextPage: 2,
        lastPage: 101,
        total: 10_100,
      },
      error: null,
    });
    const deps = dependencies({
      client: { auth: { admin: { listUsers } } },
    });

    await expect(
      findAuthUserByNormalizedEmail(
        { email: "missing@example.com", maxPages: 101 },
        deps,
      ),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "provider_rejected",
        message: "Supabase Auth rejected the operation.",
      },
      ambiguous: false,
    });
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("creates a confirmed managed user with exactly the provenance metadata", async () => {
    const created = authUser({
      app_metadata: {
        credential_version: 1,
        bpv_admin_managed: true,
        bpv_created_operation_id: OPERATION_ID,
      },
    });
    const createUser = vi.fn().mockResolvedValue({
      data: { user: created },
      error: null,
    });
    const deps = dependencies({
      client: { auth: { admin: { createUser } } },
    });

    const result = await createManagedAuthUser(
      {
        email: "admin@example.com",
        password: "temporary-password",
        operationId: OPERATION_ID,
      },
      deps,
    );

    expect(result).toMatchObject({ ok: true, data: { id: USER_ID } });
    expect(createUser).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "temporary-password",
      email_confirm: true,
      app_metadata: {
        credential_version: 1,
        bpv_admin_managed: true,
        bpv_created_operation_id: OPERATION_ID,
      },
    });
    expect(createUser.mock.calls[0][0]).not.toHaveProperty("user_metadata");
  });

  it("quarantines a retryable create error returned after dispatch", async () => {
    const rawSecret = "create-password-and-provider-secret";
    const createUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError(rawSecret, 503),
    });
    const deps = dependencies({
      client: { auth: { admin: { createUser } } },
    });

    const result = await createManagedAuthUser(
      {
        email: "admin@example.com",
        password: rawSecret,
        operationId: OPERATION_ID,
      },
      deps,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "provider_unavailable",
        message: "Supabase Auth is unavailable.",
      },
      ambiguous: true,
    });
    expect(JSON.stringify(result)).not.toContain(rawSecret);
  });

  it("deletes only the exact Auth UID through the server-side Admin API", async () => {
    const deleteUser = vi.fn().mockResolvedValue({
      data: { user: authUser() },
      error: null,
    });
    const deps = dependencies({
      client: { auth: { admin: { deleteUser } } },
    });

    await expect(
      deleteManagedAuthUser({ userId: USER_ID }, deps),
    ).resolves.toEqual({ ok: true, data: null });
    expect(deleteUser).toHaveBeenCalledWith(USER_ID, false);
  });

  it("classifies an ambiguous Auth delete without exposing provider data", async () => {
    const deleteUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError(
        "delete response contained secret metadata",
        503,
      ),
    });
    const deps = dependencies({
      client: { auth: { admin: { deleteUser } } },
    });

    const result = await deleteManagedAuthUser({ userId: USER_ID }, deps);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "provider_unavailable",
        message: "Supabase Auth is unavailable.",
      },
      ambiguous: true,
    });
    expect(JSON.stringify(result)).not.toContain("secret metadata");
  });

  it("treats a weak-password create rejection as definite and secret-safe", async () => {
    const rawSecret = "weak create password with provider secret";
    const createUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new AuthWeakPasswordError(rawSecret, 422, ["length"]),
    });
    const deps = dependencies({
      client: { auth: { admin: { createUser } } },
    });

    const result = await createManagedAuthUser(
      {
        email: "admin@example.com",
        password: rawSecret,
        operationId: OPERATION_ID,
      },
      deps,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "provider_rejected",
        message: "Supabase Auth rejected the operation.",
      },
      ambiguous: false,
    });
    expect(JSON.stringify(result)).not.toContain(rawSecret);
  });

  it("quarantines a non-enumerated 5xx weak-password create response", async () => {
    const rawSecret = "weak create password in a 519 provider response";
    const createUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new AuthWeakPasswordError(rawSecret, 519, ["characters"]),
    });
    const deps = dependencies({
      client: { auth: { admin: { createUser } } },
    });

    const result = await createManagedAuthUser(
      {
        email: "admin@example.com",
        password: rawSecret,
        operationId: OPERATION_ID,
      },
      deps,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "provider_unavailable",
        message: "Supabase Auth is unavailable.",
      },
      ambiguous: true,
    });
    expect(JSON.stringify(result)).not.toContain(rawSecret);
  });

  it("preserves unrelated app metadata while advancing managed credentials", async () => {
    const current = providerUser({
      appMetadata: {
        provider: "email",
        providers: ["email", "google"],
        billing_role: "owner",
        credential_version: 3,
        bpv_admin_managed: false,
        bpv_created_operation_id: OPERATION_ID,
      },
    });
    const updateUserById = vi.fn().mockResolvedValue({
      data: {
        user: authUser({
          app_metadata: {
            ...current.appMetadata,
            credential_version: 4,
            bpv_admin_managed: true,
          },
        }),
      },
      error: null,
    });
    const deps = dependencies({
      client: { auth: { admin: { updateUserById } } },
    });

    const result = await updateManagedAuthUser(
      {
        user: current,
        password: "replacement-password",
        credentialVersion: 4,
      },
      deps,
    );

    expect(result).toMatchObject({ ok: true, data: { id: USER_ID } });
    expect(updateUserById).toHaveBeenCalledWith(USER_ID, {
      password: "replacement-password",
      app_metadata: {
        provider: "email",
        providers: ["email", "google"],
        billing_role: "owner",
        credential_version: 4,
        bpv_admin_managed: true,
        bpv_created_operation_id: OPERATION_ID,
      },
    });
    expect(updateUserById.mock.calls[0][1]).not.toHaveProperty("user_metadata");
  });

  it.each([
    ["UID", { id: "different-user" }],
    ["email", { email: "different@example.com" }],
    [
      "managed marker",
      {
        app_metadata: {
          bpv_admin_managed: false,
          credential_version: 4,
        },
      },
    ],
    [
      "credential version",
      {
        app_metadata: {
          bpv_admin_managed: true,
          credential_version: 3,
        },
      },
    ],
  ])(
    "rejects an update response with mismatched owned %s",
    async (_label, returnedOverride) => {
      const current = providerUser({
        appMetadata: {
          bpv_admin_managed: true,
          credential_version: 3,
        },
      });
      const updateUserById = vi.fn().mockResolvedValue({
        data: {
          user: authUser({
            app_metadata: {
              bpv_admin_managed: true,
              credential_version: 4,
            },
            ...returnedOverride,
          }),
        },
        error: null,
      });

      const result = await updateManagedAuthUser(
        { user: current, credentialVersion: 4 },
        dependencies({
          client: { auth: { admin: { updateUserById } } },
        }),
      );

      expect(result).toEqual({
        ok: false,
        error: {
          code: "provider_identity_mismatch",
          message: "Supabase Auth identity did not match.",
        },
        ambiguous: false,
      });
    },
  );

  it("accepts normalized-equivalent current and returned update emails", async () => {
    const current = providerUser({ email: " ADMIN@example.com " });
    const updateUserById = vi.fn().mockResolvedValue({
      data: {
        user: authUser({
          email: "admin@example.com",
          app_metadata: {
            ...current.appMetadata,
            credential_version: 2,
          },
        }),
      },
      error: null,
    });

    const result = await updateManagedAuthUser(
      { user: current, credentialVersion: 2 },
      dependencies({
        client: { auth: { admin: { updateUserById } } },
      }),
    );

    expect(result.ok).toBe(true);
  });

  it("quarantines a retryable update error returned after dispatch", async () => {
    const updateUserById = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError(
        "update response contained a sensitive provider detail",
        504,
      ),
    });
    const deps = dependencies({
      client: { auth: { admin: { updateUserById } } },
    });

    const result = await updateManagedAuthUser(
      {
        user: providerUser(),
        password: "replacement-password",
        credentialVersion: 2,
      },
      deps,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "provider_unavailable",
        message: "Supabase Auth is unavailable.",
      },
      ambiguous: true,
    });
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });

  it("treats a weak-password update rejection as definite and secret-safe", async () => {
    const rawSecret = "weak update password with provider secret";
    const updateUserById = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new AuthWeakPasswordError(rawSecret, 422, ["pwned"]),
    });
    const deps = dependencies({
      client: { auth: { admin: { updateUserById } } },
    });

    const result = await updateManagedAuthUser(
      {
        user: providerUser(),
        password: rawSecret,
        credentialVersion: 2,
      },
      deps,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "provider_rejected",
        message: "Supabase Auth rejected the operation.",
      },
      ambiguous: false,
    });
    expect(JSON.stringify(result)).not.toContain(rawSecret);
  });

  it("never creates or replaces immutable provenance during update", async () => {
    const updateUserById = vi.fn().mockResolvedValue({
      data: { user: authUser() },
      error: null,
    });
    const deps = dependencies({
      client: { auth: { admin: { updateUserById } } },
    });

    await updateManagedAuthUser(
      {
        user: providerUser({
          appMetadata: {
            provider: "email",
            bpv_created_operation_id: "original-operation",
          },
        }),
        credentialVersion: 2,
      },
      deps,
    );
    await updateManagedAuthUser(
      {
        user: providerUser({
          id: "user-without-provenance",
          appMetadata: { provider: "email" },
        }),
        credentialVersion: 2,
      },
      deps,
    );

    expect(updateUserById.mock.calls[0][1].app_metadata).toEqual({
      provider: "email",
      bpv_created_operation_id: "original-operation",
      credential_version: 2,
      bpv_admin_managed: true,
    });
    expect(updateUserById.mock.calls[1][1].app_metadata).toEqual({
      provider: "email",
      credential_version: 2,
      bpv_admin_managed: true,
    });
  });

  it.each(["876000h", "none"] as const)(
    "sends the exact Supabase ban duration %s",
    async (banDuration) => {
      const updateUserById = vi.fn().mockResolvedValue({
        data: {
          user: authUser({
            banned_until:
              banDuration === "876000h"
                ? "2126-07-29T00:00:00.000Z"
                : null,
            app_metadata: {
              bpv_admin_managed: true,
              credential_version: 2,
            },
          }),
        },
        error: null,
      });
      const deps = dependencies({
        client: { auth: { admin: { updateUserById } } },
      });

      await updateManagedAuthUser(
        {
          user: providerUser(),
          credentialVersion: 2,
          banDuration,
        },
        deps,
      );

      expect(updateUserById.mock.calls[0][1].ban_duration).toBe(banDuration);
    },
  );

  it("verifies a password on a separate transient client and returns only the access token", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: {
        user: authUser(),
        session: {
          access_token: "access-token-value",
          refresh_token: "refresh-token-value",
          expires_in: 3600,
          expires_at: 1_754_000_000,
          token_type: "bearer",
          user: authUser(),
        },
      },
      error: null,
    });
    const createTransientClient = vi.fn(() => ({
      auth: { signInWithPassword },
    }));
    const deps = dependencies({ createTransientClient });

    const result = await transientlyVerifyPassword(
      {
        email: "admin@example.com",
        password: "current-password",
        expectedUserId: USER_ID,
      },
      deps,
    );

    expect(result).toEqual({
      ok: true,
      data: { accessToken: "access-token-value" },
    });
    expect(createTransientClient).toHaveBeenCalledOnce();
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "current-password",
    });
    expect(JSON.stringify(result)).not.toContain("refresh-token-value");
  });

  it("rejects a transient verification that returns another user ID", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: {
        user: authUser({ id: "different-user" }),
        session: {
          access_token: "access-token-value",
          refresh_token: "refresh-token-value",
          expires_in: 3600,
          token_type: "bearer",
          user: authUser({ id: "different-user" }),
        },
      },
      error: null,
    });
    const deps = dependencies({
      createTransientClient: () => ({
        auth: { signInWithPassword },
      }),
    });

    await expect(
      transientlyVerifyPassword(
        {
          email: "admin@example.com",
          password: "current-password",
          expectedUserId: USER_ID,
        },
        deps,
      ),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "provider_identity_mismatch",
        message: "Supabase Auth identity did not match.",
      },
      ambiguous: false,
    });
  });

  it("quarantines a retryable password verification error returned after dispatch", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthRetryableFetchError(
        "sign-in response contained a refresh-token-secret",
        520,
      ),
    });
    const deps = dependencies({
      createTransientClient: () => ({
        auth: { signInWithPassword },
      }),
    });

    const result = await transientlyVerifyPassword(
      {
        email: "admin@example.com",
        password: "current-password",
        expectedUserId: USER_ID,
      },
      deps,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "provider_unavailable",
        message: "Supabase Auth is unavailable.",
      },
      ambiguous: true,
    });
    expect(JSON.stringify(result)).not.toContain("refresh-token-secret");
  });

  it("globally signs out the transient access token", async () => {
    const signOut = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const deps = dependencies({
      client: { auth: { admin: { signOut } } },
    });

    const result = await globallySignOutAccessToken(
      { accessToken: "access-token-value" },
      deps,
    );

    expect(result).toEqual({ ok: true, data: null });
    expect(signOut).toHaveBeenCalledWith("access-token-value", "global");
  });

  it("quarantines a retryable global signout error returned after dispatch", async () => {
    const signOut = vi.fn().mockResolvedValue({
      data: null,
      error: new AuthRetryableFetchError(
        "signout response contained an access-token-secret",
        502,
      ),
    });
    const deps = dependencies({
      client: { auth: { admin: { signOut } } },
    });

    const result = await globallySignOutAccessToken(
      { accessToken: "access-token-secret" },
      deps,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "provider_unavailable",
        message: "Supabase Auth is unavailable.",
      },
      ambiguous: true,
    });
    expect(JSON.stringify(result)).not.toContain("access-token-secret");
  });

  it("treats a missing-session global signout rejection as definite and secret-safe", async () => {
    const signOut = vi.fn().mockResolvedValue({
      data: null,
      error: new AuthSessionMissingError(),
    });
    const deps = dependencies({
      client: { auth: { admin: { signOut } } },
    });

    const result = await globallySignOutAccessToken(
      { accessToken: "missing-session-access-token-secret" },
      deps,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "provider_rejected",
        message: "Supabase Auth rejected the operation.",
      },
      ambiguous: false,
    });
    expect(JSON.stringify(result)).not.toContain(
      "missing-session-access-token-secret",
    );
    expect(JSON.stringify(result)).not.toContain("Auth session missing");
  });

  it("quarantines an unknown Auth error returned after global signout dispatch", async () => {
    const signOut = vi.fn().mockResolvedValue({
      data: null,
      error: new AuthUnknownError(
        "unknown signout failure with secret",
        new Error("private transport cause"),
      ),
    });
    const deps = dependencies({
      client: { auth: { admin: { signOut } } },
    });

    const result = await globallySignOutAccessToken(
      { accessToken: "access-token-value" },
      deps,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "provider_unavailable",
        message: "Supabase Auth is unavailable.",
      },
      ambiguous: true,
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("reports a dispatched SDK timeout as ambiguous without claiming abort", async () => {
    vi.useFakeTimers();
    try {
      const listUsers = vi.fn().mockReturnValue(new Promise(() => {}));
      const deps = dependencies({
        client: { auth: { admin: { listUsers } } },
        timeoutMs: 100,
      });

      const resultPromise = listAuthUsersPage(
        { page: 1, pageSize: 100 },
        deps,
      );
      await vi.advanceTimersByTimeAsync(100);

      await expect(resultPromise).resolves.toEqual({
        ok: false,
        error: {
          code: "provider_timeout",
          message: "Supabase Auth operation timed out.",
        },
        ambiguous: true,
      });
      expect(listUsers).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("requires timeout plus five seconds to remain strictly below the lease", async () => {
    const listUsers = vi.fn();
    const deps = dependencies({
      client: { auth: { admin: { listUsers } } },
      timeoutMs: 5_000,
      leaseExpiresAt: new Date(NOW_MS + 10_000).toISOString(),
    });

    await expect(
      listAuthUsersPage({ page: 1, pageSize: 100 }, deps),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "provider_timeout",
        message: "Supabase Auth operation timed out.",
      },
      ambiguous: false,
    });
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("never exposes credentials or raw Supabase errors", async () => {
    const password = "password-secret-value";
    const accessToken = "access-token-secret-value";
    const refreshToken = "refresh-token-secret-value";
    const serviceSecret = "sb_secret_service-value";
    const createUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new AuthApiError(
        `${password} ${accessToken} ${refreshToken} ${serviceSecret}`,
        400,
        "provider_raw_code",
      ),
    });
    const deps = dependencies({
      client: { auth: { admin: { createUser } } },
    });

    const result = await createManagedAuthUser(
      {
        email: "admin@example.com",
        password,
        operationId: OPERATION_ID,
      },
      deps,
    );
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "provider_rejected",
        message: "Supabase Auth rejected the operation.",
      },
      ambiguous: false,
    });
    for (const secret of [
      password,
      accessToken,
      refreshToken,
      serviceSecret,
      "provider_raw_code",
      "sensitive",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
