import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const EMAIL = "admin@example.com";
const TOKEN = "browser-access-token";

function makeSessionClient(options?: {
  claimsVersion?: number;
  userVersion?: number;
  profileVersion?: number;
  isActive?: boolean;
  forced?: boolean;
  userId?: string;
  subject?: string;
  profileError?: unknown;
}) {
  const getClaims = vi.fn().mockResolvedValue({
    data: {
      claims: {
        sub: options?.subject ?? USER_ID,
        app_metadata: {
          credential_version: options?.claimsVersion ?? 7,
        },
      },
    },
    error: null,
  });
  const getUser = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: options?.userId ?? USER_ID,
        email: EMAIL,
        app_metadata: {
          credential_version: options?.userVersion ?? 7,
        },
      },
    },
    error: null,
  });
  const limit = vi.fn().mockResolvedValue({
    data: [
      {
        user_id: USER_ID,
        email: EMAIL,
        is_active: options?.isActive ?? true,
        must_change_password: options?.forced ?? true,
        credential_version: options?.profileVersion ?? 7,
      },
    ],
    error: options?.profileError ?? null,
  });
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    limit,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  return {
    client: {
      auth: { getClaims, getUser },
      from: vi.fn().mockReturnValue(query),
    },
    getClaims,
    getUser,
    query,
  };
}

async function loadModule() {
  return import("../forced-password-change");
}

describe("inspectForcedPasswordSession", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it.each([
    ["active", false, true, "active"],
    ["forced", true, true, "forced"],
    ["inactive", true, false, "inactive"],
  ] as const)("distinguishes %s profiles", async (_name, forced, isActive, state) => {
    const fixture = makeSessionClient({ forced, isActive });
    const { inspectForcedPasswordSession } = await loadModule();

    const result = await inspectForcedPasswordSession(TOKEN, {
      createClient: () => fixture.client as never,
    });

    expect(result).toMatchObject({ state });
    expect(fixture.getClaims).toHaveBeenCalledWith(TOKEN);
    expect(fixture.getUser).toHaveBeenCalledWith(TOKEN);
    expect(fixture.query.select).toHaveBeenCalledWith(
      "user_id,email,is_active,must_change_password,credential_version",
    );
    expect(fixture.query.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(fixture.query.limit).toHaveBeenCalledWith(2);
  });

  it.each([
    ["JWT", { claimsVersion: 8 }],
    ["Auth", { userVersion: 8 }],
    ["database", { profileVersion: 8 }],
  ])("rejects a mismatched %s credential fence", async (_name, options) => {
    const fixture = makeSessionClient(options);
    const { inspectForcedPasswordSession } = await loadModule();

    await expect(
      inspectForcedPasswordSession(TOKEN, {
        createClient: () => fixture.client as never,
      }),
    ).resolves.toMatchObject({
      state: "version_mismatch",
      code: "credential_version_mismatch",
    });
  });

  it("rejects mismatched verified identities before reading the profile", async () => {
    const fixture = makeSessionClient({ subject: OTHER_ID });
    const { inspectForcedPasswordSession } = await loadModule();

    await expect(
      inspectForcedPasswordSession(TOKEN, {
        createClient: () => fixture.client as never,
      }),
    ).resolves.toMatchObject({ state: "invalid", code: "session_invalid" });
    expect(fixture.client.from).not.toHaveBeenCalled();
  });

  it("keeps database verification failure distinct from invalid login", async () => {
    const fixture = makeSessionClient({
      profileError: { message: "permission denied", code: "42501" },
    });
    const { inspectForcedPasswordSession } = await loadModule();

    await expect(
      inspectForcedPasswordSession(TOKEN, {
        createClient: () => fixture.client as never,
      }),
    ).resolves.toMatchObject({
      state: "verification_failed",
      code: "admin_verification_failed",
      status: 500,
    });
  });
});

function makeChangeDependencies(
  overrides: Record<string, unknown> = {},
) {
  const events: string[] = [];
  const session = {
    state: "forced" as const,
    userId: USER_ID,
    email: EMAIL,
    credentialVersion: 7,
  };
  const operation = {
    operationId: OPERATION_ID,
    fenceVersion: 4,
    leaseExpiresAt: "2099-01-01T00:00:00.000Z",
  };
  const deps = {
    inspectSession: vi.fn(async () => session),
    claim: vi.fn(async () => {
      events.push("claim");
      return {
        ok: true as const,
        data: {
          operation,
          leaseToken: "lease-token",
          disposition: "first_claim" as const,
        },
      };
    }),
    verifyPassword: vi.fn(async ({ password }: { password: string }) => {
      events.push(password === "TempPass1!" ? "verify_temp" : "verify_new");
      return {
        ok: true as const,
        data: {
          accessToken:
            password === "TempPass1!" ? "temporary-token" : "new-token",
        },
      };
    }),
    advanceProfile: vi.fn(async ({ nextCredentialVersion }) => {
      events.push(`db_${nextCredentialVersion}`);
      return { ok: true as const, data: { credentialVersion: nextCredentialVersion } };
    }),
    advanceStage: vi.fn(async ({ stage }) => {
      events.push(`stage_${stage}`);
      return { ok: true as const, data: operation };
    }),
    updateAuth: vi.fn(async ({ credentialVersion, password }) => {
      events.push(`auth_${credentialVersion}${password ? "_password" : ""}`);
      return {
        ok: true as const,
        data: {
          id: USER_ID,
          email: EMAIL,
          appMetadata: { credential_version: credentialVersion },
        },
      };
    }),
    signOut: vi.fn(async () => {
      events.push("global_signout");
      return { ok: true as const, data: null };
    }),
    complete: vi.fn(async () => {
      events.push("complete");
      return { ok: true as const, data: operation };
    }),
    release: vi.fn(async () => {
      events.push("release");
      return { ok: true as const, data: operation };
    }),
    rollbackAndRelease: vi.fn(async ({ nextCredentialVersion }) => {
      events.push(`rollback_${nextCredentialVersion}`);
      return { ok: true as const, data: operation };
    }),
    quarantine: vi.fn(async () => {
      events.push("quarantine");
      return { ok: true as const, data: operation };
    }),
    recordLateFence: vi.fn(async () => {
      events.push("late_fence");
      return { ok: true as const, data: operation };
    }),
    hashRequest: vi.fn(async () => "a".repeat(64)),
    now: () => Date.parse("2026-07-30T00:00:00.000Z"),
    providerTimeoutMs: 10_000,
    ...overrides,
  };
  return { deps, events };
}

const changeInput = {
  token: TOKEN,
  operationId: OPERATION_ID,
  currentPassword: "TempPass1!",
  newPassword: "NewPass2@",
  confirmPassword: "NewPass2@",
};

describe("changeForcedPassword", () => {
  it("performs the exact N to N+1 to N+2 sequence and final clear", async () => {
    const { deps, events } = makeChangeDependencies();
    const { changeForcedPassword } = await loadModule();

    const result = await changeForcedPassword(changeInput, deps as never);

    expect(result).toEqual({
      ok: true,
      code: "password_changed",
      clearSession: true,
    });
    expect(events).toEqual([
      "claim",
      "verify_temp",
      "db_8",
      "auth_8_password",
      "stage_auth_n1_aligned",
      "verify_new",
      "global_signout",
      "db_9",
      "auth_9",
      "stage_auth_n2_aligned",
      "complete",
    ]);
    expect(deps.hashRequest).toHaveBeenCalledWith({
      operationId: OPERATION_ID,
      userId: USER_ID,
      email: EMAIL,
      credentialVersion: 7,
    });
    expect(JSON.stringify(deps.hashRequest.mock.calls)).not.toContain("TempPass1!");
    expect(JSON.stringify(deps.hashRequest.mock.calls)).not.toContain("NewPass2@");
  });

  it("rejects the new password matching the temporary password before claim", async () => {
    const { deps } = makeChangeDependencies();
    const { changeForcedPassword } = await loadModule();

    const result = await changeForcedPassword(
      {
        ...changeInput,
        newPassword: "TempPass1!",
        confirmPassword: "TempPass1!",
      },
      deps as never,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "password_reuse",
      clearSession: false,
    });
    expect(deps.claim).not.toHaveBeenCalled();
  });

  it("returns lease conflict without any provider call", async () => {
    const { deps } = makeChangeDependencies({
      claim: vi.fn(async () => ({
        ok: false as const,
        error: { code: "lease_conflict", message: "conflict" },
      })),
    });
    const { changeForcedPassword } = await loadModule();

    await expect(changeForcedPassword(changeInput, deps as never)).resolves.toMatchObject({
      ok: false,
      code: "lease_conflict",
    });
    expect(deps.verifyPassword).not.toHaveBeenCalled();
    expect(deps.updateAuth).not.toHaveBeenCalled();
  });

  it("replays a completed wrong-password outcome without reporting success", async () => {
    const { deps } = makeChangeDependencies({
      claim: vi.fn(async () => ({
        ok: true as const,
        data: {
          operation: {
            operationId: OPERATION_ID,
            fenceVersion: 4,
            leaseExpiresAt: null,
            safeResult: { outcome: "rejected" },
          },
          leaseToken: null,
          disposition: "completed_retry" as const,
        },
      })),
    });
    const { changeForcedPassword } = await loadModule();

    await expect(changeForcedPassword(changeInput, deps as never)).resolves.toMatchObject({
      ok: false,
      code: "temporary_password_invalid",
      clearSession: false,
    });
    expect(deps.verifyPassword).not.toHaveBeenCalled();
  });

  it("releases safely after a definite wrong temporary password", async () => {
    const { deps, events } = makeChangeDependencies({
      verifyPassword: vi.fn(async () => ({
        ok: false as const,
        ambiguous: false,
        error: { code: "provider_rejected", message: "rejected" },
      })),
    });
    const { changeForcedPassword } = await loadModule();

    await expect(changeForcedPassword(changeInput, deps as never)).resolves.toMatchObject({
      ok: false,
      code: "temporary_password_invalid",
      clearSession: false,
    });
    expect(events).toEqual(["claim", "release"]);
    expect(deps.advanceProfile).not.toHaveBeenCalled();
  });

  it("records a late fence and never verifies a password", async () => {
    const { deps, events } = makeChangeDependencies();
    deps.inspectSession
      .mockResolvedValueOnce({
        state: "forced",
        userId: USER_ID,
        email: EMAIL,
        credentialVersion: 7,
      })
      .mockResolvedValueOnce({
        state: "forced",
        userId: USER_ID,
        email: EMAIL,
        credentialVersion: 8,
      });
    const { changeForcedPassword } = await loadModule();

    await expect(changeForcedPassword(changeInput, deps as never)).resolves.toMatchObject({
      ok: false,
      code: "late_fence",
      clearSession: true,
    });
    expect(events).toEqual(["claim", "late_fence"]);
    expect(deps.verifyPassword).not.toHaveBeenCalled();
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it("quarantines when durable late-fence recording cannot be proven", async () => {
    const { deps } = makeChangeDependencies({
      recordLateFence: vi.fn(async () => ({
        ok: false as const,
        error: { code: "database_unavailable", message: "unavailable" },
      })),
    });
    deps.inspectSession
      .mockResolvedValueOnce({
        state: "forced",
        userId: USER_ID,
        email: EMAIL,
        credentialVersion: 7,
      })
      .mockResolvedValueOnce({
        state: "invalid",
        code: "session_invalid",
        status: 401,
        message: "invalid",
      });
    const { changeForcedPassword } = await loadModule();

    await expect(changeForcedPassword(changeInput, deps as never)).resolves.toMatchObject({
      ok: false,
      code: "provider_ambiguous",
      clearSession: true,
    });
    expect(deps.quarantine).toHaveBeenCalled();
    expect(deps.verifyPassword).not.toHaveBeenCalled();
  });

  it("rolls DB N+1 back to N after a definite Auth password rejection", async () => {
    const { deps, events } = makeChangeDependencies({
      updateAuth: vi.fn(async () => ({
        ok: false as const,
        ambiguous: false,
        error: { code: "provider_rejected", message: "rejected" },
      })),
    });
    const { changeForcedPassword } = await loadModule();

    await expect(changeForcedPassword(changeInput, deps as never)).resolves.toMatchObject({
      ok: false,
      code: "password_update_rejected",
      clearSession: true,
    });
    expect(events).toContain("rollback_7");
    expect(deps.rollbackAndRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedCredentialVersion: 8,
        nextCredentialVersion: 7,
      }),
    );
  });

  it("quarantines an Auth identity mismatch after mutation instead of rolling back", async () => {
    const { deps } = makeChangeDependencies({
      updateAuth: vi.fn(async () => ({
        ok: false as const,
        ambiguous: false,
        error: {
          code: "provider_identity_mismatch",
          message: "identity mismatch",
        },
      })),
    });
    const { changeForcedPassword } = await loadModule();

    await expect(changeForcedPassword(changeInput, deps as never)).resolves.toMatchObject({
      ok: false,
      code: "provider_ambiguous",
      clearSession: true,
    });
    expect(deps.quarantine).toHaveBeenCalled();
    expect(deps.rollbackAndRelease).not.toHaveBeenCalled();
  });

  it.each(["provider_unavailable", "provider_timeout"] as const)(
    "does not mislabel a definite %s setup/deadline failure as a bad password",
    async (code) => {
      const { deps } = makeChangeDependencies({
        verifyPassword: vi.fn(async () => ({
          ok: false as const,
          ambiguous: false,
          error: { code, message: "system failure" },
        })),
      });
      const { changeForcedPassword } = await loadModule();

      await expect(changeForcedPassword(changeInput, deps as never)).resolves.toMatchObject({
        ok: false,
        code,
        clearSession: false,
      });
      expect(deps.release).toHaveBeenCalledWith(
        expect.objectContaining({ stage: code }),
      );
    },
  );

  it("quarantines a temporary-signin identity mismatch instead of calling it a bad password", async () => {
    const { deps } = makeChangeDependencies({
      verifyPassword: vi.fn(async () => ({
        ok: false as const,
        ambiguous: false,
        error: {
          code: "provider_identity_mismatch",
          message: "identity mismatch",
        },
      })),
    });
    const { changeForcedPassword } = await loadModule();

    await expect(changeForcedPassword(changeInput, deps as never)).resolves.toMatchObject({
      ok: false,
      code: "provider_ambiguous",
      clearSession: true,
    });
    expect(deps.quarantine).toHaveBeenCalled();
    expect(deps.release).not.toHaveBeenCalled();
  });

  it("globally cleans the temporary session before quarantining a DB boundary failure", async () => {
    const { deps, events } = makeChangeDependencies({
      advanceProfile: vi.fn(async () => ({
        ok: false as const,
        error: { code: "database_unavailable", message: "unavailable" },
      })),
    });
    const { changeForcedPassword } = await loadModule();

    await expect(changeForcedPassword(changeInput, deps as never)).resolves.toMatchObject({
      ok: false,
      code: "provider_ambiguous",
      clearSession: true,
    });
    expect(deps.signOut).toHaveBeenCalledWith({
      accessToken: "temporary-token",
      leaseExpiresAt: "2099-01-01T00:00:00.000Z",
    });
    expect(events).toContain("quarantine");
  });

  it.each([
    ["temporary verification", "verifyPassword"],
    ["Auth update", "updateAuth"],
    ["global cleanup", "signOut"],
  ])("quarantines an ambiguous %s boundary", async (_name, method) => {
    const failure = vi.fn(async () => ({
      ok: false as const,
      ambiguous: true,
      error: { code: "provider_unavailable", message: "ambiguous" },
    }));
    const { deps, events } = makeChangeDependencies({ [method]: failure });
    const { changeForcedPassword } = await loadModule();

    await expect(changeForcedPassword(changeInput, deps as never)).resolves.toMatchObject({
      ok: false,
      code: "provider_ambiguous",
      clearSession: true,
    });
    expect(events).toContain("quarantine");
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it.each([
    ["DB N+1", "advanceProfile", 1],
    ["stage after Auth N+1", "advanceStage", 1],
    ["DB N+2", "advanceProfile", 2],
    ["Auth N+2", "updateAuth", 2],
    ["stage after Auth N+2", "advanceStage", 2],
    ["final clear", "complete", 1],
  ] as const)("never clears after an ambiguous %s boundary", async (
    _name,
    method,
    failAt,
  ) => {
    let call = 0;
    const { deps } = makeChangeDependencies();
    const original = deps[method] as (...args: unknown[]) => Promise<unknown>;
    (deps as Record<string, unknown>)[method] = vi.fn(async (...args: unknown[]) => {
      call += 1;
      if (call === failAt) {
        return method === "updateAuth"
          ? {
              ok: false as const,
              ambiguous: true,
              error: { code: "provider_unavailable", message: "ambiguous" },
            }
          : {
              ok: false as const,
              error: { code: "database_unavailable", message: "ambiguous" },
            };
      }
      return original(...args);
    });
    const { changeForcedPassword } = await loadModule();

    await expect(changeForcedPassword(changeInput, deps as never)).resolves.toMatchObject({
      ok: false,
      code: "provider_ambiguous",
      clearSession: true,
    });
    expect(deps.quarantine).toHaveBeenCalled();
    if (method !== "complete") {
      expect(deps.complete).not.toHaveBeenCalled();
    }
  });

  it("treats session-not-found during global cleanup as already cleaned", async () => {
    const { deps } = makeChangeDependencies({
      signOut: vi.fn(async () => ({ ok: true as const, data: null })),
    });
    const { changeForcedPassword } = await loadModule();

    await expect(changeForcedPassword(changeInput, deps as never)).resolves.toMatchObject({
      ok: true,
      code: "password_changed",
    });
    expect(deps.complete).toHaveBeenCalledOnce();
    expect(deps.quarantine).not.toHaveBeenCalled();
  });
});
