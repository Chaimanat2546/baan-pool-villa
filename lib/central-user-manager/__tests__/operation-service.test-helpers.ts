import { vi } from "vitest";

import type {
  CentralAdminProfile,
  CentralUserOperationContext,
  OperationAuthProvider,
  OperationListRepository,
  OperationProfileRepository,
  OperationStateRepository,
} from "../operation-service";
import type {
  AdminUserOperationRecord,
  ClaimedOperation,
  RepositoryResult,
} from "../operation-repository";
import type { ProviderResult, ProviderUser } from "../auth-provider";

export const TENANT_ID = "123e4567-e89b-42d3-a456-426614174000";
export const OPERATION_ID = "123e4567-e89b-42d3-a456-426614174001";
export const ACTOR_UID = "123e4567-e89b-42d3-a456-426614174002";
export const USER_ID = "123e4567-e89b-42d3-a456-426614174003";
export const OTHER_USER_ID = "123e4567-e89b-42d3-a456-426614174004";
export const REQUEST_HASH = "a".repeat(64);
export const EMAIL = "admin@example.com";
export const LEASE_TOKEN = "lease-token-in-memory-only";
export const LEASE_EXPIRES_AT = "2026-07-29T01:00:30.000Z";
export const NOW_MS = Date.parse("2026-07-29T01:00:00.000Z");
export const TEMPORARY_PASSWORD = "Temp-Password-123!Aa";

export function providerUser(
  overrides: Partial<ProviderUser> = {},
): ProviderUser {
  return {
    id: USER_ID,
    email: EMAIL,
    createdAt: "2026-07-29T00:00:00.000Z",
    emailConfirmedAt: "2026-07-29T00:00:00.000Z",
    lastSignInAt: "2026-07-29T00:30:00.000Z",
    bannedUntil: null,
    appMetadata: {
      provider: "email",
      bpv_admin_managed: true,
      credential_version: 1,
      bpv_created_operation_id: OPERATION_ID,
    },
    ...overrides,
  };
}

export function profile(
  overrides: Partial<CentralAdminProfile> = {},
): CentralAdminProfile {
  return {
    userId: USER_ID,
    email: EMAIL,
    role: "admin",
    isActive: true,
    mustChangePassword: true,
    credentialVersion: 1,
    createdAt: "2026-07-29T00:00:00.000Z",
    ...overrides,
  };
}

export function operation(
  overrides: Partial<AdminUserOperationRecord> = {},
): AdminUserOperationRecord {
  return {
    operationId: OPERATION_ID,
    actorKind: "central_admin",
    actorUid: ACTOR_UID,
    action: "create_user",
    targetUserId: null,
    targetEmailNormalized: EMAIL,
    requestHash: REQUEST_HASH,
    status: "leased",
    stage: "claimed",
    fenceVersion: 1,
    attemptCount: 1,
    leaseExpiresAt: LEASE_EXPIRES_AT,
    safeResult: null,
    safeError: null,
    ...overrides,
  };
}

export function claimed(
  overrides: Partial<ClaimedOperation> = {},
): ClaimedOperation {
  return {
    operation: operation(),
    leaseToken: LEASE_TOKEN,
    disposition: "first_claim",
    ...overrides,
  };
}

export function repositorySuccess<T>(data: T): RepositoryResult<T> {
  return { ok: true, data };
}

export function providerSuccess<T>(data: T): ProviderResult<T> {
  return { ok: true, data };
}

export function providerFailure(
  ambiguous: boolean,
  code:
    | "provider_timeout"
    | "provider_unavailable"
    | "provider_rejected" = "provider_timeout",
): ProviderResult<never> {
  const messages = {
    provider_timeout: "Supabase Auth operation timed out.",
    provider_unavailable: "Supabase Auth is unavailable.",
    provider_rejected: "Supabase Auth rejected the operation.",
  } as const;

  return {
    ok: false,
    error: { code, message: messages[code] },
    ambiguous,
  };
}

export function operationContext(overrides: {
  operations?: Partial<OperationStateRepository>;
  profiles?: Partial<OperationProfileRepository>;
  auth?: Partial<OperationAuthProvider>;
  list?: OperationListRepository;
  password?: string;
  events?: string[];
} = {}): CentralUserOperationContext {
  const events = overrides.events ?? [];
  const baseOperation = operation();
  let currentProfile = profile();
  let currentProviderUser = providerUser();
  const list = overrides.list ?? {
    listPage: async () => ({
      ok: true as const,
      data: {
        users: [
          {
            userId: currentProviderUser.id,
            email: currentProviderUser.email,
            status: "password_change_required" as const,
            createdAt: currentProviderUser.createdAt,
            lastSignInAt: currentProviderUser.lastSignInAt,
            credentialVersion: currentProfile.credentialVersion,
            authCredentialVersion: 1,
          },
        ],
        hasMore: false,
      },
    }),
  };

  const operations: OperationStateRepository = {
    claim: vi.fn(async (input) => {
      events.push("claim");
      if (overrides.operations?.claim) {
        return overrides.operations.claim(input);
      }
      return repositorySuccess(claimed());
    }),
    renew: vi.fn(async (input) => {
      events.push("renew");
      if (overrides.operations?.renew) {
        return overrides.operations.renew(input);
      }
      return repositorySuccess(
        claimed({
          operation: { ...baseOperation, leaseExpiresAt: LEASE_EXPIRES_AT },
        }),
      );
    }),
    commitProviderIntent: vi.fn(async (input) => {
      events.push(`${input.providerStep}:intent`);
      if (overrides.operations?.commitProviderIntent) {
        return overrides.operations.commitProviderIntent(input);
      }
      return repositorySuccess(
        operation({
          status: "provider_intent",
          stage: `${input.providerStep}_intent`,
        }),
      );
    }),
    commitProviderOutcome: vi.fn(async (input) => {
      events.push(`${input.providerStep}:outcome`);
      if (overrides.operations?.commitProviderOutcome) {
        return overrides.operations.commitProviderOutcome(input);
      }
      return repositorySuccess(
        operation({
          status:
            input.outcome === "rejected"
              ? "needs_review"
              : "provider_outcome",
          stage: `${input.providerStep}_${input.outcome === "rejected" ? "rejected" : "succeeded"}`,
          targetUserId: input.targetUserId,
          leaseExpiresAt:
            input.outcome === "rejected" ? null : LEASE_EXPIRES_AT,
          safeResult: {
            providerStep: input.providerStep,
            outcome: input.outcome,
            userId: input.targetUserId,
            credentialVersion: input.credentialVersion,
            ...(input.providerErrorCode
              ? { errorCode: input.providerErrorCode }
              : {}),
          },
          safeError:
            input.outcome === "rejected"
              ? {
                  code: "provider_failure",
                  message: "Unable to complete request.",
                }
              : null,
        }),
      );
    }),
    complete: vi.fn(async (input) => {
      events.push("complete");
      if (overrides.operations?.complete) {
        return overrides.operations.complete(input);
      }
      return repositorySuccess(
        operation({
          status: "completed",
          stage: "completed",
          leaseExpiresAt: null,
          safeResult: {
            outcome:
              input.terminalKind === "success" ? "success" : "failed",
            ...(input.user ? { user: input.user } : {}),
            ...(input.errorCode
              ? { errorCode: input.errorCode }
              : {}),
          },
        }),
      );
    }),
    quarantine: vi.fn(async (input) => {
      events.push("quarantine");
      if (overrides.operations?.quarantine) {
        return overrides.operations.quarantine(input);
      }
      return repositorySuccess(
        operation({
          status: "quarantined",
          stage: "quarantined",
          leaseExpiresAt: null,
        }),
      );
    }),
    markNeedsReview: vi.fn(async (input) => {
      events.push("needs_review");
      if (overrides.operations?.markNeedsReview) {
        return overrides.operations.markNeedsReview(input);
      }
      return repositorySuccess(
        operation({
          status: "needs_review",
          stage: "needs_review",
          leaseExpiresAt: null,
        }),
      );
    }),
    recordLateFence: vi.fn(async (input) => {
      events.push("late_fence");
      if (overrides.operations?.recordLateFence) {
        return overrides.operations.recordLateFence(input);
      }
      return repositorySuccess(
        operation({
          status: "needs_review",
          stage: "late_fence",
          leaseExpiresAt: null,
        }),
      );
    }),
  };

  const profiles: OperationProfileRepository = {
    findByNormalizedEmail: vi.fn(async (input) => {
      events.push("profiles:find_email");
      if (overrides.profiles?.findByNormalizedEmail) {
        return overrides.profiles.findByNormalizedEmail(input);
      }
      return { ok: true, data: [currentProfile] };
    }),
    findByUserId: vi.fn(async (input) => {
      events.push("profiles:find_uid");
      if (overrides.profiles?.findByUserId) {
        return overrides.profiles.findByUserId(input);
      }
      return { ok: true, data: currentProfile };
    }),
    createForOperation: vi.fn(async (input) => {
      events.push("profiles:create");
      if (overrides.profiles?.createForOperation) {
        return overrides.profiles.createForOperation(input);
      }
      currentProfile = profile();
      return { ok: true, data: currentProfile };
    }),
    advanceForOperation: vi.fn(async (input) => {
      events.push("profiles:advance");
      if (overrides.profiles?.advanceForOperation) {
        return overrides.profiles.advanceForOperation(input);
      }
      currentProfile = profile({
        isActive: input.nextIsActive,
        mustChangePassword: input.nextMustChangePassword,
        credentialVersion: input.nextCredentialVersion,
      });
      return { ok: true, data: currentProfile };
    }),
    activateForOperation: vi.fn(async (input) => {
      events.push("profiles:activate");
      if (overrides.profiles?.activateForOperation) {
        return overrides.profiles.activateForOperation(input);
      }
      currentProfile = profile({
        isActive: true,
        mustChangePassword: true,
        credentialVersion: input.credentialVersion,
      });
      return { ok: true, data: currentProfile };
    }),
    prepareCompensation: vi.fn(async (input) => {
      events.push("profiles:prepare_compensation");
      if (overrides.profiles?.prepareCompensation) {
        return overrides.profiles.prepareCompensation(input);
      }
      return {
        ok: true,
        data: { stage: "compensation_ready" as const },
      };
    }),
  };

  const auth: OperationAuthProvider = {
    findByUserId: vi.fn(async (input) => {
      events.push("auth:find_uid");
      if (overrides.auth?.findByUserId) {
        return overrides.auth.findByUserId(input);
      }
      return providerSuccess(
        currentProviderUser.id === input.userId
          ? currentProviderUser
          : null,
      );
    }),
    findByNormalizedEmail: vi.fn(async (input, deadline) => {
      events.push("auth:find_email");
      if (overrides.auth?.findByNormalizedEmail) {
        return overrides.auth.findByNormalizedEmail(input, deadline);
      }
      return providerSuccess([currentProviderUser]);
    }),
    createManagedUser: vi.fn(async (input, deadline) => {
      events.push("auth:create");
      if (overrides.auth?.createManagedUser) {
        return overrides.auth.createManagedUser(input, deadline);
      }
      currentProviderUser = providerUser();
      return providerSuccess(currentProviderUser);
    }),
    updateManagedUser: vi.fn(async (input, deadline) => {
      events.push("auth:update");
      if (overrides.auth?.updateManagedUser) {
        return overrides.auth.updateManagedUser(input, deadline);
      }
      currentProviderUser = providerUser({
          bannedUntil:
            input.banDuration === "876000h"
              ? "2126-07-29T00:00:00.000Z"
              : input.banDuration === "none"
                ? null
                : currentProviderUser.bannedUntil,
          appMetadata: {
            ...currentProviderUser.appMetadata,
            credential_version: input.credentialVersion,
          },
      });
      return providerSuccess(currentProviderUser);
    }),
    verifyPassword: vi.fn(async (input, deadline) => {
      events.push("auth:verify_password");
      if (overrides.auth?.verifyPassword) {
        return overrides.auth.verifyPassword(input, deadline);
      }
      return providerSuccess({ accessToken: "transient-access-token" });
    }),
    globallySignOut: vi.fn(async (input, deadline) => {
      events.push("auth:signout");
      if (overrides.auth?.globallySignOut) {
        return overrides.auth.globallySignOut(input, deadline);
      }
      return providerSuccess(null);
    }),
    deleteManagedUser: vi.fn(async (input, deadline) => {
      events.push("auth:delete");
      if (overrides.auth?.deleteManagedUser) {
        return overrides.auth.deleteManagedUser(input, deadline);
      }
      return providerSuccess(null);
    }),
  };

  return {
    requestHash: REQUEST_HASH,
    operations,
    profiles,
    auth,
    list,
    now: () => NOW_MS,
    providerTimeoutMs: 10_000,
    generateTemporaryPassword: vi.fn(
      () => overrides.password ?? TEMPORARY_PASSWORD,
    ),
  };
}
