import { describe, expect, it, vi } from "vitest";

import { executeCentralUserOperation } from "../operation-service";
import {
  ACTOR_UID,
  EMAIL,
  OPERATION_ID,
  TEMPORARY_PASSWORD,
  TENANT_ID,
  USER_ID,
  claimed,
  operation,
  operationContext,
  profile,
  providerFailure,
  providerSuccess,
  providerUser,
  repositorySuccess,
} from "./operation-service.test-helpers";

vi.mock("server-only", () => ({}));

function request(
  action:
    | "reissue_temporary_password"
    | "suspend_user"
    | "reactivate_user",
) {
  return {
    tenantId: TENANT_ID,
    operationId: OPERATION_ID,
    actorUid: ACTOR_UID,
    action,
    payload: { email: EMAIL },
  };
}

describe("Central User Manager lifecycle operations", () => {
  it("reissues DB-first, verifies same UID, signs out globally, and returns a new password once", async () => {
    const events: string[] = [];
    const context = operationContext({ events });

    const response = await executeCentralUserOperation(
      context,
      request("reissue_temporary_password"),
    );

    expect(events).toEqual([
      "claim",
      "renew",
      "auth:find_email",
      "profiles:find_email",
      "profiles:advance",
      "renew",
      "auth_update:intent",
      "auth:update",
      "auth_update:outcome",
      "renew",
      "password_verify:intent",
      "auth:verify_password",
      "password_verify:outcome",
      "renew",
      "global_signout:intent",
      "auth:signout",
      "global_signout:outcome",
      "renew",
      "auth:find_email",
      "profiles:find_uid",
      "complete",
    ]);
    expect(context.profiles.advanceForOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedCredentialVersion: 1,
        nextCredentialVersion: 2,
        nextIsActive: true,
        nextMustChangePassword: true,
      }),
    );
    expect(context.auth.updateManagedUser).toHaveBeenCalledWith(
      expect.objectContaining({
        password: TEMPORARY_PASSWORD,
        credentialVersion: 2,
      }),
      expect.any(Object),
    );
    expect(response).toMatchObject({
      status: "completed",
      result: {
        user: {
          userId: USER_ID,
          credentialVersion: 2,
          authCredentialVersion: 2,
          status: "password_change_required",
        },
        temporaryPassword: TEMPORARY_PASSWORD,
      },
    });
    expect(
      JSON.stringify(vi.mocked(context.operations.complete).mock.calls),
    ).not.toContain(TEMPORARY_PASSWORD);
  });

  it("suspends in the database before banning Auth and never returns a password", async () => {
    const events: string[] = [];
    const context = operationContext({
      events,
      profiles: {
        advanceForOperation: vi.fn(async (input) => {
          return {
            ok: true as const,
            data: profile({
              isActive: false,
              mustChangePassword: input.nextMustChangePassword,
              credentialVersion: input.nextCredentialVersion,
            }),
          };
        }),
        findByUserId: async () => ({
          ok: true,
          data: profile({
            isActive: false,
            credentialVersion: 2,
          }),
        }),
      },
    });

    const response = await executeCentralUserOperation(
      context,
      request("suspend_user"),
    );

    expect(events.slice(0, 6)).toEqual([
      "claim",
      "renew",
      "auth:find_email",
      "profiles:find_email",
      "profiles:advance",
      "renew",
    ]);
    expect(context.auth.updateManagedUser).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialVersion: 2,
        banDuration: "876000h",
      }),
      expect.any(Object),
    );
    expect(response).toMatchObject({
      status: "completed",
      result: { user: { status: "suspended", credentialVersion: 2 } },
    });
    expect(JSON.stringify(response)).not.toContain("temporaryPassword");
  });

  it("keeps reactivation inactive until new-password verification and global signout succeed", async () => {
    const events: string[] = [];
    const suspendedProvider = providerUser({
      bannedUntil: "2126-07-29T00:00:00.000Z",
    });
    const suspendedProfile = profile({ isActive: false });
    const context = operationContext({
      events,
      auth: {
        findByNormalizedEmail: vi
          .fn()
          .mockResolvedValueOnce(providerSuccess([suspendedProvider]))
          .mockResolvedValueOnce(
            providerSuccess([
              providerUser({
                bannedUntil: null,
                appMetadata: {
                  ...suspendedProvider.appMetadata,
                  credential_version: 2,
                },
              }),
            ]),
          )
          .mockResolvedValueOnce(
            providerSuccess([
              providerUser({
                bannedUntil: null,
                appMetadata: {
                  ...suspendedProvider.appMetadata,
                  credential_version: 2,
                },
              }),
            ]),
          ),
      },
      profiles: {
        findByNormalizedEmail: async () => ({
          ok: true,
          data: [suspendedProfile],
        }),
        findByUserId: vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            data: profile({
              isActive: false,
              credentialVersion: 2,
              mustChangePassword: true,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            data: profile({
              isActive: true,
              credentialVersion: 2,
              mustChangePassword: true,
            }),
          }),
      },
    });

    const response = await executeCentralUserOperation(
      context,
      request("reactivate_user"),
    );

    expect(events).toEqual([
      "claim",
      "renew",
      "auth:find_email",
      "profiles:find_email",
      "profiles:advance",
      "renew",
      "auth_update:intent",
      "auth:update",
      "auth_update:outcome",
      "renew",
      "password_verify:intent",
      "auth:verify_password",
      "password_verify:outcome",
      "renew",
      "global_signout:intent",
      "auth:signout",
      "global_signout:outcome",
      "renew",
      "auth:find_email",
      "profiles:find_uid",
      "profiles:activate",
      "renew",
      "auth:find_email",
      "profiles:find_uid",
      "complete",
    ]);
    expect(context.auth.updateManagedUser).toHaveBeenCalledWith(
      expect.objectContaining({
        password: TEMPORARY_PASSWORD,
        credentialVersion: 2,
        banDuration: "none",
      }),
      expect.any(Object),
    );
    expect(context.profiles.activateForOperation).toHaveBeenCalledAfter(
      context.auth.globallySignOut as ReturnType<typeof vi.fn>,
    );
    expect(response).toMatchObject({
      status: "completed",
      result: {
        user: {
          status: "password_change_required",
          credentialVersion: 2,
        },
        temporaryPassword: TEMPORARY_PASSWORD,
      },
    });
  });

  it.each([
    "reissue_temporary_password",
    "suspend_user",
    "reactivate_user",
  ] as const)(
    "keeps the DB fail-closed and quarantines ambiguous %s Auth timeout",
    async (action) => {
      const suspended = action === "reactivate_user";
      const context = operationContext({
        auth: {
          findByNormalizedEmail: async () =>
            providerSuccess([
              providerUser({
                bannedUntil: suspended
                  ? "2126-07-29T00:00:00.000Z"
                  : null,
              }),
            ]),
          updateManagedUser: async () =>
            providerFailure(true, "provider_timeout"),
        },
        profiles: {
          findByNormalizedEmail: async () => ({
            ok: true,
            data: [profile({ isActive: !suspended })],
          }),
        },
      });

      const response = await executeCentralUserOperation(
        context,
        request(action),
      );

      expect(context.profiles.advanceForOperation).toHaveBeenCalledBefore(
        context.auth.updateManagedUser as ReturnType<typeof vi.fn>,
      );
      expect(context.operations.quarantine).toHaveBeenCalledOnce();
      expect(response).toMatchObject({
        status: "quarantined",
        error: { code: "provider_ambiguous" },
      });
      expect(JSON.stringify(response)).not.toContain(TEMPORARY_PASSWORD);
      expect(context.profiles.activateForOperation).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["password_verify", false],
    ["global_signout", true],
  ] as const)(
    "quarantines an ambiguous %s timeout and never advances the profile",
    async (step, verificationSucceeds) => {
      const context = operationContext({
        auth: {
          verifyPassword: async () =>
            verificationSucceeds
              ? providerSuccess({ accessToken: "transient-access-token" })
              : providerFailure(true, "provider_timeout"),
          globallySignOut: async () =>
            providerFailure(true, "provider_timeout"),
        },
      });

      const response = await executeCentralUserOperation(
        context,
        request("reissue_temporary_password"),
      );

      expect(response).toMatchObject({
        status: "quarantined",
        error: { code: "provider_ambiguous" },
      });
      expect(context.operations.quarantine).toHaveBeenCalledOnce();
      expect(context.profiles.activateForOperation).not.toHaveBeenCalled();
      if (!verificationSucceeds) {
        expect(context.auth.globallySignOut).not.toHaveBeenCalled();
      }
      expect(JSON.stringify(response)).not.toContain(TEMPORARY_PASSWORD);
    },
  );

  it("does not replay a rejected provider outcome after its committed response is lost", async () => {
    const updateManagedUser = vi.fn(async () =>
      providerFailure(false, "provider_rejected"),
    );
    const context = operationContext({
      operations: {
        claim: vi
          .fn()
          .mockResolvedValueOnce(
            repositorySuccess(
              claimed({
                operation: operation({
                  action: "suspend_user",
                  targetUserId: USER_ID,
                }),
              }),
            ),
          )
          .mockResolvedValueOnce(
            repositorySuccess(
              claimed({
                leaseToken: null,
                operation: operation({
                  action: "suspend_user",
                  targetUserId: USER_ID,
                  status: "needs_review",
                  stage: "auth_update_rejected",
                  safeResult: {
                    providerStep: "auth_update",
                    outcome: "rejected",
                    userId: USER_ID,
                    credentialVersion: 2,
                    errorCode: "provider_rejected",
                  },
                }),
              }),
            ),
          ),
        commitProviderOutcome: vi.fn(async () => ({
          ok: false as const,
          error: {
            code: "database_unavailable" as const,
            message: "The operation database is unavailable.",
          },
        })),
      },
      auth: { updateManagedUser },
    });

    await executeCentralUserOperation(context, request("suspend_user"));
    const retry = await executeCentralUserOperation(
      context,
      request("suspend_user"),
    );

    expect(retry).toMatchObject({
      status: "needs_review",
      stage: "auth_update_rejected",
    });
    expect(updateManagedUser).toHaveBeenCalledOnce();
  });

  it("records a late lower credential fence without lowering or activating profile state", async () => {
    const context = operationContext({
      auth: {
        updateManagedUser: async () =>
          providerSuccess(
            providerUser({
              appMetadata: {
                bpv_admin_managed: true,
                credential_version: 1,
              },
            }),
          ),
      },
    });

    const response = await executeCentralUserOperation(
      context,
      request("reissue_temporary_password"),
    );

    expect(context.operations.recordLateFence).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: OPERATION_ID,
        expectedCredentialVersion: 2,
        observedCredentialVersion: 1,
      }),
    );
    expect(context.profiles.activateForOperation).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      status: "needs_review",
      error: { code: "credential_version_mismatch" },
    });
    expect(JSON.stringify(response)).not.toContain(TEMPORARY_PASSWORD);
  });

  it("fails closed on missing Auth credential metadata without forging a zero late fence", async () => {
    const context = operationContext({
      auth: {
        updateManagedUser: async () =>
          providerSuccess(
            providerUser({
              appMetadata: { bpv_admin_managed: true },
            }),
          ),
      },
    });

    const response = await executeCentralUserOperation(
      context,
      request("suspend_user"),
    );

    expect(response.status).toBe("needs_review");
    expect(context.operations.markNeedsReview).toHaveBeenCalledOnce();
    expect(context.operations.recordLateFence).not.toHaveBeenCalled();
  });

  it("does not complete suspension when must-change-password drifts", async () => {
    const context = operationContext({
      auth: {
        findByNormalizedEmail: vi
          .fn()
          .mockResolvedValueOnce(providerSuccess([providerUser()]))
          .mockResolvedValueOnce(
            providerSuccess([
              providerUser({
                bannedUntil: "2126-07-29T00:00:00.000Z",
                appMetadata: {
                  bpv_admin_managed: true,
                  credential_version: 2,
                },
              }),
            ]),
          ),
      },
      profiles: {
        findByNormalizedEmail: async () => ({
          ok: true,
          data: [profile({ mustChangePassword: true })],
        }),
        findByUserId: async () => ({
          ok: true,
          data: profile({
            isActive: false,
            mustChangePassword: false,
            credentialVersion: 2,
          }),
        }),
      },
    });

    const response = await executeCentralUserOperation(
      context,
      request("suspend_user"),
    );

    expect(response.status).toBe("needs_review");
    expect(context.operations.complete).not.toHaveBeenCalled();
  });

  it("rejects recovered suspension when the durable forced flag drifts", async () => {
    const context = operationContext({
      operations: {
        claim: vi.fn(async () =>
          repositorySuccess(
            claimed({
              operation: operation({
                action: "suspend_user",
                targetUserId: USER_ID,
                status: "provider_outcome",
                stage: "auth_update_succeeded",
                safeResult: {
                  providerStep: "auth_update",
                  outcome: "succeeded",
                  userId: USER_ID,
                  credentialVersion: 2,
                  suspensionExpectedMustChangePassword: true,
                },
              }),
            }),
          ),
        ),
      },
      auth: {
        findByNormalizedEmail: async () =>
          providerSuccess([
            providerUser({
              bannedUntil: "2126-07-29T00:00:00.000Z",
              appMetadata: {
                bpv_admin_managed: true,
                credential_version: 2,
              },
            }),
          ]),
      },
      profiles: {
        findByUserId: async () => ({
          ok: true,
          data: profile({
            isActive: false,
            mustChangePassword: false,
            credentialVersion: 2,
          }),
        }),
      },
    });

    const response = await executeCentralUserOperation(
      context,
      request("suspend_user"),
    );

    expect(response.status).toBe("needs_review");
    expect(context.operations.complete).not.toHaveBeenCalled();
  });

  it("fails closed when another email operation owns the active lease", async () => {
    const context = operationContext({
      operations: {
        claim: vi.fn(async () => ({
          ok: false,
          error: {
            code: "lease_conflict",
            message: "The operation lease is owned by another request.",
          },
        })),
      },
    });

    const response = await executeCentralUserOperation(
      context,
      request("suspend_user"),
    );

    expect(response).toMatchObject({
      status: "in_progress",
      error: { code: "lease_conflict" },
    });
    expect(context.auth.findByNormalizedEmail).not.toHaveBeenCalled();
    expect(context.profiles.advanceForOperation).not.toHaveBeenCalled();
  });

  it("recovers after confirmed reactivation signout by activating exact N+1 without regenerating a password", async () => {
    const events: string[] = [];
    const context = operationContext({
      events,
      operations: {
        claim: vi.fn(async () =>
          repositorySuccess(
            claimed({
              operation: operation({
                action: "reactivate_user",
                targetUserId: USER_ID,
                status: "provider_outcome",
                stage: "provider_outcome",
                safeResult: {
                  providerStep: "global_signout",
                  outcome: "succeeded",
                  userId: USER_ID,
                  credentialVersion: 2,
                },
              }),
            }),
          ),
        ),
      },
      auth: {
        findByNormalizedEmail: async () =>
          providerSuccess([
            providerUser({
              bannedUntil: null,
              appMetadata: {
                bpv_admin_managed: true,
                credential_version: 2,
              },
            }),
          ]),
      },
      profiles: {
        findByUserId: vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            data: profile({
              isActive: false,
              mustChangePassword: true,
              credentialVersion: 2,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            data: profile({
              isActive: true,
              mustChangePassword: true,
              credentialVersion: 2,
            }),
          }),
      },
    });

    const response = await executeCentralUserOperation(
      context,
      request("reactivate_user"),
    );

    expect(context.generateTemporaryPassword).not.toHaveBeenCalled();
    expect(context.auth.updateManagedUser).not.toHaveBeenCalled();
    expect(context.auth.verifyPassword).not.toHaveBeenCalled();
    expect(context.auth.globallySignOut).not.toHaveBeenCalled();
    expect(context.profiles.activateForOperation).toHaveBeenCalledWith(
      expect.objectContaining({ credentialVersion: 2 }),
    );
    expect(response).toMatchObject({
      status: "completed",
      result: { user: { credentialVersion: 2 } },
    });
    expect(JSON.stringify(response)).not.toContain("temporaryPassword");
  });

  it("stops for review after recovered password verification because the transient token is gone", async () => {
    const context = operationContext({
      operations: {
        claim: vi.fn(async () =>
          repositorySuccess(
            claimed({
              operation: operation({
                action: "reissue_temporary_password",
                targetUserId: USER_ID,
                status: "provider_outcome",
                stage: "provider_outcome",
                safeResult: {
                  providerStep: "password_verify",
                  outcome: "succeeded",
                  userId: USER_ID,
                  credentialVersion: 2,
                },
              }),
            }),
          ),
        ),
      },
    });

    const response = await executeCentralUserOperation(
      context,
      request("reissue_temporary_password"),
    );

    expect(response.status).toBe("needs_review");
    expect(context.operations.markNeedsReview).toHaveBeenCalledOnce();
    expect(context.generateTemporaryPassword).not.toHaveBeenCalled();
    expect(context.auth.updateManagedUser).not.toHaveBeenCalled();
    expect(context.auth.verifyPassword).not.toHaveBeenCalled();
    expect(context.auth.globallySignOut).not.toHaveBeenCalled();
  });

  it("finishes a recovered profile activation without repeating the flip or returning a password", async () => {
    const context = operationContext({
      operations: {
        claim: vi.fn(async () =>
          repositorySuccess(
            claimed({
              operation: operation({
                action: "reactivate_user",
                targetUserId: USER_ID,
                status: "leased",
                stage: "profile_activated",
                safeResult: {
                  providerStep: "global_signout",
                  outcome: "succeeded",
                  userId: USER_ID,
                  credentialVersion: 2,
                },
              }),
            }),
          ),
        ),
      },
      auth: {
        findByNormalizedEmail: async () =>
          providerSuccess([
            providerUser({
              bannedUntil: null,
              appMetadata: {
                bpv_admin_managed: true,
                credential_version: 2,
              },
            }),
          ]),
      },
      profiles: {
        findByUserId: async () => ({
          ok: true,
          data: profile({
            isActive: true,
            mustChangePassword: true,
            credentialVersion: 2,
          }),
        }),
      },
    });

    const response = await executeCentralUserOperation(
      context,
      request("reactivate_user"),
    );

    expect(response).toMatchObject({
      status: "completed",
      result: { user: { status: "password_change_required" } },
    });
    expect(context.profiles.activateForOperation).not.toHaveBeenCalled();
    expect(context.generateTemporaryPassword).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain("temporaryPassword");
  });

  it.each([
    "auth_update",
    "password_verify",
    "global_signout",
  ] as const)(
    "never replays a recovered rejected %s outcome",
    async (providerStep) => {
      const context = operationContext({
        operations: {
          claim: vi.fn(async () =>
            repositorySuccess(
              claimed({
                leaseToken: null,
                operation: operation({
                  action: "reissue_temporary_password",
                  targetUserId: USER_ID,
                  status: "needs_review",
                  stage: `${providerStep}_rejected`,
                  safeResult: {
                    providerStep,
                    outcome: "rejected",
                    userId: USER_ID,
                    credentialVersion: 2,
                    errorCode: "provider_rejected",
                  },
                  safeError: {
                    code: "provider_failure",
                    message: "Unable to complete request.",
                  },
                }),
              }),
            ),
          ),
        },
      });

      const response = await executeCentralUserOperation(
        context,
        request("reissue_temporary_password"),
      );

      expect(response.status).toBe("needs_review");
      expect(context.generateTemporaryPassword).not.toHaveBeenCalled();
      expect(context.auth.updateManagedUser).not.toHaveBeenCalled();
      expect(context.auth.verifyPassword).not.toHaveBeenCalled();
      expect(context.auth.globallySignOut).not.toHaveBeenCalled();
      expect(context.operations.commitProviderOutcome).not.toHaveBeenCalled();
    },
  );

  it("quarantines profile-advanced recovery when email lookup resolves a different UID", async () => {
    const context = operationContext({
      operations: {
        claim: vi.fn(async () =>
          repositorySuccess(
            claimed({
              operation: operation({
                action: "suspend_user",
                targetUserId: USER_ID,
                status: "leased",
                stage: "profile_advanced",
                safeResult: {
                  userId: USER_ID,
                  credentialVersion: 2,
                  profileIsActive: false,
                  profileMustChangePassword: true,
                },
              }),
            }),
          ),
        ),
      },
      auth: {
        findByNormalizedEmail: async () =>
          providerSuccess([
            providerUser({
              id: "123e4567-e89b-42d3-a456-426614174099",
            }),
          ]),
      },
      profiles: {
        findByUserId: async () => ({
          ok: true,
          data: profile({
            isActive: false,
            mustChangePassword: true,
            credentialVersion: 2,
          }),
        }),
      },
    });

    const response = await executeCentralUserOperation(
      context,
      request("suspend_user"),
    );

    expect(response.status).toBe("needs_review");
    expect(context.auth.updateManagedUser).not.toHaveBeenCalled();
    expect(context.operations.markNeedsReview).toHaveBeenCalledOnce();
  });

  it("does not complete suspension until Auth has a future ban and DB remains inactive", async () => {
    const context = operationContext({
      auth: {
        updateManagedUser: async () =>
          providerSuccess(
            providerUser({
              bannedUntil: null,
              appMetadata: {
                bpv_admin_managed: true,
                credential_version: 2,
              },
            }),
          ),
      },
      profiles: {
        findByUserId: async () => ({
          ok: true,
          data: profile({
            isActive: false,
            credentialVersion: 2,
          }),
        }),
      },
    });

    const response = await executeCentralUserOperation(
      context,
      request("suspend_user"),
    );

    expect(response.status).toBe("needs_review");
    expect(context.operations.complete).not.toHaveBeenCalled();
  });
});
