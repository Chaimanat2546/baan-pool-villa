import { describe, expect, it, vi } from "vitest";

import { executeCentralUserOperation } from "../operation-service";
import {
  ACTOR_UID,
  EMAIL,
  OPERATION_ID,
  REQUEST_HASH,
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

const request = {
  tenantId: TENANT_ID,
  operationId: OPERATION_ID,
  actorUid: ACTOR_UID,
  action: "create_user" as const,
  payload: { email: EMAIL },
};

describe("Central User Manager create operation", () => {
  it("orders the durable create state machine and returns the password once", async () => {
    const events: string[] = [];
    const context = operationContext({
      events,
      auth: {
        findByNormalizedEmail: vi
          .fn()
          .mockResolvedValueOnce(providerSuccess([]))
          .mockResolvedValueOnce(providerSuccess([providerUser()])),
      },
      profiles: {
        findByNormalizedEmail: vi
          .fn()
          .mockResolvedValueOnce({ ok: true, data: [] }),
      },
    });

    const response = await executeCentralUserOperation(context, request);

    expect(events).toEqual([
      "claim",
      "auth:find_email",
      "profiles:find_email",
      "renew",
      "auth_create:intent",
      "auth:create",
      "auth_create:outcome",
      "profiles:create",
      "auth:find_email",
      "profiles:find_uid",
      "complete",
    ]);
    expect(response).toEqual({
      operationId: OPERATION_ID,
      status: "completed",
      stage: "completed",
      result: {
        user: expect.objectContaining({
          userId: USER_ID,
          email: EMAIL,
          status: "password_change_required",
        }),
        temporaryPassword: TEMPORARY_PASSWORD,
      },
    });
    expect(context.operations.claim).toHaveBeenCalledWith({
      operationId: OPERATION_ID,
      actorKind: "central_admin",
      actorUid: ACTOR_UID,
      action: "create_user",
      targetUserId: null,
      targetEmailNormalized: EMAIL,
      requestHash: REQUEST_HASH,
    });
    expect(context.auth.createManagedUser).toHaveBeenCalledWith(
      {
        email: EMAIL,
        password: TEMPORARY_PASSWORD,
        operationId: OPERATION_ID,
      },
      expect.objectContaining({
        timeoutMs: 10_000,
        leaseExpiresAt: "2026-07-29T01:00:30.000Z",
      }),
    );
    expect(context.operations.commitProviderStage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        providerStep: "auth_create",
        stage: "outcome",
        targetUserId: USER_ID,
        safeResult: expect.objectContaining({ userId: USER_ID }),
      }),
    );
    expect(JSON.stringify(context.operations.complete.mock.calls)).not.toContain(
      TEMPORARY_PASSWORD,
    );
  });

  it("returns a completed retry from persisted safe state without a password", async () => {
    const safeUser = {
      userId: USER_ID,
      email: EMAIL,
      status: "password_change_required" as const,
      createdAt: "2026-07-29T00:00:00.000Z",
      lastSignInAt: null,
      credentialVersion: 1,
      authCredentialVersion: 1,
    };
    const context = operationContext({
      operations: {
        claim: vi.fn(async () =>
          repositorySuccess(
            claimed({
              disposition: "completed_retry",
              leaseToken: null,
              operation: operation({
                status: "completed",
                stage: "completed",
                leaseExpiresAt: null,
                safeResult: { outcome: "success", user: safeUser },
              }),
            }),
          ),
        ),
      },
    });

    const response = await executeCentralUserOperation(context, request);

    expect(response).toEqual({
      operationId: OPERATION_ID,
      status: "completed",
      stage: "completed",
      result: { user: safeUser },
    });
    expect(context.auth.createManagedUser).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain("temporaryPassword");
  });

  it("returns a stable duplicate when the same exact pair already exists", async () => {
    const context = operationContext();

    const response = await executeCentralUserOperation(context, request);

    expect(response).toMatchObject({
      operationId: OPERATION_ID,
      status: "completed",
      error: { code: "user_exists" },
      result: {
        user: {
          userId: USER_ID,
          email: EMAIL,
          status: "password_change_required",
        },
      },
    });
    expect(context.auth.createManagedUser).not.toHaveBeenCalled();
    expect(context.operations.complete).toHaveBeenCalledOnce();
  });

  it.each([
    ["Auth-only", [providerUser()], []],
    ["profile-only", [], [profile()]],
  ])(
    "quarantines a %s email collision without attaching or overwriting",
    async (_label, authUsers, profiles) => {
      const context = operationContext({
        auth: {
          findByNormalizedEmail: async () => providerSuccess(authUsers),
        },
        profiles: {
          findByNormalizedEmail: async () => ({
            ok: true,
            data: profiles,
          }),
        },
      });

      const response = await executeCentralUserOperation(context, request);

      expect(response).toMatchObject({
        status: "needs_review",
        error: { code: "identity_mismatch" },
      });
      expect(context.operations.markNeedsReview).toHaveBeenCalledOnce();
      expect(context.auth.createManagedUser).not.toHaveBeenCalled();
    },
  );

  it("compensates only the exact managed Auth identity created by this operation", async () => {
    const events: string[] = [];
    const created = providerUser();
    const context = operationContext({
      events,
      auth: {
        findByNormalizedEmail: vi
          .fn()
          .mockResolvedValueOnce(providerSuccess([]))
          .mockResolvedValueOnce(providerSuccess([created])),
      },
      profiles: {
        findByNormalizedEmail: async () => ({ ok: true, data: [] }),
        findByUserId: async () => ({ ok: true, data: null }),
        createForOperation: async () => ({
          ok: false,
          error: {
            code: "profile_write_failed",
            message: "Unable to update the admin profile.",
          },
        }),
      },
    });

    const response = await executeCentralUserOperation(context, request);

    expect(events).toEqual([
      "claim",
      "auth:find_email",
      "profiles:find_email",
      "renew",
      "auth_create:intent",
      "auth:create",
      "auth_create:outcome",
      "profiles:create",
      "profiles:find_uid",
      "auth:find_email",
      "renew",
      "auth_delete:intent",
      "auth:delete",
      "auth_delete:outcome",
      "complete",
    ]);
    expect(context.auth.deleteManagedUser).toHaveBeenCalledWith(
      { userId: USER_ID },
      expect.any(Object),
    );
    expect(response).toMatchObject({
      status: "completed",
      error: { code: "create_compensated" },
    });
    expect(JSON.stringify(response)).not.toContain(TEMPORARY_PASSWORD);
  });

  it("never deletes when UID, email, managed marker, and provenance do not all prove ownership", async () => {
    const context = operationContext({
      auth: {
        findByNormalizedEmail: vi
          .fn()
          .mockResolvedValueOnce(providerSuccess([]))
          .mockResolvedValueOnce(
            providerSuccess([
              providerUser({
                appMetadata: {
                  bpv_admin_managed: true,
                  credential_version: 1,
                  bpv_created_operation_id:
                    "123e4567-e89b-42d3-a456-426614174999",
                },
              }),
            ]),
          ),
      },
      profiles: {
        findByNormalizedEmail: async () => ({ ok: true, data: [] }),
        findByUserId: async () => ({ ok: true, data: null }),
        createForOperation: async () => ({
          ok: false,
          error: {
            code: "profile_write_failed",
            message: "Unable to update the admin profile.",
          },
        }),
      },
    });

    const response = await executeCentralUserOperation(context, request);

    expect(response).toMatchObject({
      status: "needs_review",
      error: { code: "identity_mismatch" },
    });
    expect(context.auth.deleteManagedUser).not.toHaveBeenCalled();
    expect(context.operations.markNeedsReview).toHaveBeenCalledOnce();
  });

  it("permanently quarantines an ambiguous create result without returning a password", async () => {
    const context = operationContext({
      auth: {
        findByNormalizedEmail: async () => providerSuccess([]),
        createManagedUser: async () =>
          providerFailure(true, "provider_timeout"),
      },
      profiles: {
        findByNormalizedEmail: async () => ({ ok: true, data: [] }),
      },
    });

    const response = await executeCentralUserOperation(context, request);

    expect(response).toMatchObject({
      status: "quarantined",
      error: { code: "provider_ambiguous" },
    });
    expect(context.operations.quarantine).toHaveBeenCalledOnce();
    expect(context.operations.commitProviderStage).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response)).not.toContain(TEMPORARY_PASSWORD);
  });

  it("shortens the provider timeout to retain the lease safety margin", async () => {
    const context = operationContext({
      operations: {
        renew: vi.fn(async () =>
          repositorySuccess(
            claimed({
              operation: operation({
                leaseExpiresAt: "2026-07-29T01:00:12.000Z",
              }),
            }),
          ),
        ),
      },
      auth: {
        findByNormalizedEmail: vi
          .fn()
          .mockResolvedValueOnce(providerSuccess([]))
          .mockResolvedValueOnce(providerSuccess([providerUser()])),
      },
      profiles: {
        findByNormalizedEmail: async () => ({ ok: true, data: [] }),
      },
    });

    await executeCentralUserOperation(context, request);

    expect(context.auth.createManagedUser).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ timeoutMs: 6_999 }),
    );
  });

  it.each([
    [
      "auth-created outcome",
      operation({
        status: "provider_outcome",
        stage: "provider_outcome",
        targetUserId: USER_ID,
        safeResult: {
          providerStep: "auth_create",
          outcome: "succeeded",
          userId: USER_ID,
          credentialVersion: 1,
        },
      }),
      [
        "claim",
        "profiles:create",
        "auth:find_email",
        "profiles:find_uid",
        "complete",
      ],
    ],
    [
      "profile-created stage",
      operation({
        status: "leased",
        stage: "profile_created",
        targetUserId: USER_ID,
        safeResult: {
          providerStep: "auth_create",
          outcome: "succeeded",
          userId: USER_ID,
          credentialVersion: 1,
        },
      }),
      ["claim", "auth:find_email", "profiles:find_uid", "complete"],
    ],
  ])(
    "recovers from %s without repeating Auth creation or returning a password",
    async (_label, recoveredOperation, expectedEvents) => {
      const events: string[] = [];
      const context = operationContext({
        events,
        operations: {
          claim: vi.fn(async () =>
            repositorySuccess(
              claimed({
                operation: recoveredOperation,
              }),
            ),
          ),
        },
      });

      const response = await executeCentralUserOperation(context, request);

      expect(events).toEqual(expectedEvents);
      expect(context.auth.createManagedUser).not.toHaveBeenCalled();
      expect(response).toMatchObject({
        status: "completed",
        result: { user: { userId: USER_ID } },
      });
      expect(JSON.stringify(response)).not.toContain("temporaryPassword");
    },
  );

  it("fails closed for a provider-intent recovery and never replays create", async () => {
    const context = operationContext({
      operations: {
        claim: vi.fn(async () =>
          repositorySuccess(
            claimed({
              operation: operation({
                status: "quarantined",
                stage: "quarantined",
                leaseExpiresAt: null,
              }),
              leaseToken: null,
            }),
          ),
        ),
      },
    });

    const response = await executeCentralUserOperation(context, request);

    expect(response.status).toBe("quarantined");
    expect(context.auth.createManagedUser).not.toHaveBeenCalled();
  });

  it("finishes a recovered successful compensation without recreating or deleting again", async () => {
    const context = operationContext({
      operations: {
        claim: vi.fn(async () =>
          repositorySuccess(
            claimed({
              operation: operation({
                status: "provider_outcome",
                stage: "provider_outcome",
                targetUserId: USER_ID,
                safeResult: {
                  providerStep: "auth_delete",
                  outcome: "succeeded",
                  userId: USER_ID,
                  credentialVersion: 1,
                },
              }),
            }),
          ),
        ),
      },
    });

    const response = await executeCentralUserOperation(context, request);

    expect(response).toMatchObject({
      status: "completed",
      error: { code: "create_compensated" },
    });
    expect(context.auth.createManagedUser).not.toHaveBeenCalled();
    expect(context.auth.deleteManagedUser).not.toHaveBeenCalled();
    expect(context.generateTemporaryPassword).not.toHaveBeenCalled();
  });
});
