import "server-only";

import { validateAdminPasswordChange } from "@/components/admin/admin-password-validation";
import {
  findAuthUserById,
  globallySignOutAccessToken,
  transientlyVerifyPassword,
  updateManagedAuthUser,
  type AuthProviderDependencies,
} from "@/lib/central-user-manager/auth-provider";
import { getCentralUserManagerAgentConfig } from "@/lib/central-user-manager/config";
import {
  advanceForcedPasswordProfileV2,
  advanceForcedPasswordChange,
  claimForcedPasswordChangeV2,
  completeForcedPasswordChangeV2,
  quarantineAdminUserOperation,
  recordForcedPasswordLateFenceV2,
  releaseForcedPasswordChangeV2,
  rollbackForcedPasswordChangeV2,
} from "@/lib/central-user-manager/operation-repository";
import { createCentralUserManagerAdminClient } from "@/lib/central-user-manager/supabase-admin";
import { createHomeConfigClient } from "@/lib/home-sections/supabase";

const PROFILE_PROJECTION =
  "user_id,email,is_active,must_change_password,credential_version";

type SessionClient = ReturnType<typeof createHomeConfigClient>;

export type ForcedPasswordSession =
  | {
      state: "active" | "forced";
      userId: string;
      email: string;
      credentialVersion: number;
    }
  | {
      state: "inactive" | "invalid" | "version_mismatch" | "verification_failed";
      code:
        | "admin_inactive"
        | "session_invalid"
        | "credential_version_mismatch"
        | "admin_verification_failed";
      status: 401 | 403 | 500;
      message: string;
    };

interface SessionInspectionDependencies {
  createClient?: (token: string) => SessionClient;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonblankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveVersion(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) > 0
    ? (value as number)
    : null;
}

function metadataVersion(value: unknown): number | null {
  return isRecord(value) ? positiveVersion(value.credential_version) : null;
}

function failure(
  state: Extract<
    ForcedPasswordSession["state"],
    "inactive" | "invalid" | "version_mismatch" | "verification_failed"
  >,
): ForcedPasswordSession {
  if (state === "invalid") {
    return {
      state,
      code: "session_invalid",
      status: 401,
      message: "Invalid or expired Supabase session.",
    };
  }
  if (state === "inactive") {
    return {
      state,
      code: "admin_inactive",
      status: 403,
      message: "This admin account is suspended.",
    };
  }
  if (state === "version_mismatch") {
    return {
      state,
      code: "credential_version_mismatch",
      status: 403,
      message: "Admin credential versions do not match.",
    };
  }
  return {
    state,
    code: "admin_verification_failed",
    status: 500,
    message: "Unable to verify admin access.",
  };
}

async function contained<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch {
    return null;
  }
}

export async function inspectForcedPasswordSession(
  token: string,
  dependencies: SessionInspectionDependencies = {},
): Promise<ForcedPasswordSession> {
  let client: SessionClient;
  try {
    client = (dependencies.createClient ?? createHomeConfigClient)(token);
  } catch {
    return failure("verification_failed");
  }

  const [claimsResponse, userResponse] = await Promise.all([
    contained(() => client.auth.getClaims(token)),
    contained(() => client.auth.getUser(token)),
  ]);

  if (
    !isRecord(claimsResponse) ||
    claimsResponse.error !== null ||
    !isRecord(claimsResponse.data) ||
    !isRecord(claimsResponse.data.claims) ||
    !isRecord(userResponse) ||
    userResponse.error !== null ||
    !isRecord(userResponse.data) ||
    !isRecord(userResponse.data.user)
  ) {
    return failure("invalid");
  }

  const claims = claimsResponse.data.claims;
  const user = userResponse.data.user;
  if (
    !isNonblankString(claims.sub) ||
    !isNonblankString(user.id) ||
    claims.sub !== user.id ||
    !isNonblankString(user.email)
  ) {
    return failure("invalid");
  }

  const jwtVersion = metadataVersion(claims.app_metadata);
  const authVersion = metadataVersion(user.app_metadata);
  if (jwtVersion === null || authVersion === null) {
    return failure("version_mismatch");
  }

  let profileResponse: unknown;
  try {
    profileResponse = await client
      .from("admin_users")
      .select(PROFILE_PROJECTION)
      .eq("user_id", user.id)
      .limit(2);
  } catch {
    return failure("verification_failed");
  }

  if (
    !isRecord(profileResponse) ||
    profileResponse.error !== null ||
    !Array.isArray(profileResponse.data)
  ) {
    return failure("verification_failed");
  }
  if (profileResponse.data.length !== 1 || !isRecord(profileResponse.data[0])) {
    return failure("inactive");
  }

  const profile = profileResponse.data[0];
  const databaseVersion = positiveVersion(profile.credential_version);
  if (
    profile.user_id !== user.id ||
    profile.email !== user.email ||
    typeof profile.is_active !== "boolean" ||
    typeof profile.must_change_password !== "boolean"
  ) {
    return failure("inactive");
  }
  if (!profile.is_active) {
    return failure("inactive");
  }
  if (
    databaseVersion === null ||
    jwtVersion !== authVersion ||
    jwtVersion !== databaseVersion
  ) {
    return failure("version_mismatch");
  }

  return {
    state: profile.must_change_password ? "forced" : "active",
    userId: user.id,
    email: user.email,
    credentialVersion: databaseVersion,
  };
}

type RepositoryFailure = {
  ok: false;
  error: { code: string; message: string };
};
type RepositorySuccess<T = unknown> = { ok: true; data: T };
type RepositoryResult<T = unknown> = RepositorySuccess<T> | RepositoryFailure;
type ProviderFailure = RepositoryFailure & { ambiguous: boolean };
type ProviderResult<T = unknown> = RepositorySuccess<T> | ProviderFailure;

interface OperationSnapshot {
  operationId: string;
  fenceVersion: number;
  leaseExpiresAt: string | null;
  safeResult?: Record<string, unknown> | null;
}

interface ClaimedSnapshot {
  operation: OperationSnapshot;
  leaseToken: string | null;
  disposition: "first_claim" | "exact_retry" | "completed_retry";
}

interface OperationLease {
  operationId: string;
  fenceVersion: number;
  leaseToken: string;
  userId: string;
  email: string;
}

export interface ForcedPasswordChangeDependencies {
  inspectSession: (token: string) => Promise<ForcedPasswordSession>;
  claim: (input: {
    operationId: string;
    actorUid: string;
    targetUserId: string;
    targetEmailNormalized: string;
    requestHash: string;
  }) => Promise<RepositoryResult<ClaimedSnapshot>>;
  verifyPassword: (input: {
    email: string;
    password: string;
    expectedUserId: string;
    leaseExpiresAt: string;
  }) => Promise<ProviderResult<{ accessToken: string }>>;
  advanceProfile: (
    input: OperationLease & {
      expectedCredentialVersion: number;
      nextCredentialVersion: number;
      expectedStage: "claimed" | "auth_n1_aligned";
      nextStage: "profile_n1" | "profile_n2";
    },
  ) => Promise<RepositoryResult>;
  advanceStage: (
    input: Pick<OperationLease, "operationId" | "fenceVersion" | "leaseToken"> & {
      stage: string;
    },
  ) => Promise<RepositoryResult>;
  updateAuth: (input: {
    userId: string;
    password?: string;
    credentialVersion: number;
    leaseExpiresAt: string;
  }) => Promise<ProviderResult>;
  signOut: (input: {
    accessToken: string;
    leaseExpiresAt: string;
  }) => Promise<ProviderResult<null>>;
  complete: (
    input: OperationLease & { credentialVersion: number },
  ) => Promise<RepositoryResult>;
  release: (
    input: OperationLease & { stage: string },
  ) => Promise<RepositoryResult>;
  rollbackAndRelease: (
    input: OperationLease & {
      expectedCredentialVersion: number;
      nextCredentialVersion: number;
      stage: string;
    },
  ) => Promise<RepositoryResult>;
  quarantine: (
    input: Pick<OperationLease, "operationId" | "fenceVersion" | "leaseToken"> & {
      errorCode: "provider_ambiguous" | "lease_lost";
    },
  ) => Promise<RepositoryResult>;
  recordLateFence: (input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    userId: string;
    email: string;
    reason:
      | "identity_mismatch"
      | "profile_state_conflict"
      | "credential_version_mismatch";
    expectedCredentialVersion: number;
    observedCredentialVersion: number | null;
  }) => Promise<RepositoryResult>;
  hashRequest: (input: {
    operationId: string;
    userId: string;
    email: string;
    credentialVersion: number;
  }) => Promise<string>;
  now: () => number;
  providerTimeoutMs: number;
}

export type ForcedPasswordChangeResult =
  | {
      ok: true;
      code: "password_changed";
      clearSession: true;
    }
  | {
      ok: false;
      code: string;
      clearSession: boolean;
    };

function rejected(
  code: string,
  clearSession: boolean,
): ForcedPasswordChangeResult {
  return { ok: false, code, clearSession };
}

async function quarantine(
  deps: ForcedPasswordChangeDependencies,
  lease: OperationLease,
): Promise<ForcedPasswordChangeResult> {
  await deps.quarantine({
    operationId: lease.operationId,
    fenceVersion: lease.fenceVersion,
    leaseToken: lease.leaseToken,
    errorCode: "provider_ambiguous",
  });
  return rejected("provider_ambiguous", true);
}

function providerLeaseExpiresAt(
  snapshot: OperationSnapshot,
  deps: ForcedPasswordChangeDependencies,
): string | null {
  if (
    !snapshot.leaseExpiresAt ||
    !Number.isFinite(Date.parse(snapshot.leaseExpiresAt)) ||
    Date.parse(snapshot.leaseExpiresAt) <=
      deps.now() + deps.providerTimeoutMs + 5_000
  ) {
    return null;
  }
  return snapshot.leaseExpiresAt;
}

export async function changeForcedPassword(
  input: {
    token: string;
    operationId: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  },
  deps: ForcedPasswordChangeDependencies,
): Promise<ForcedPasswordChangeResult> {
  const initial = await deps.inspectSession(input.token);
  if (initial.state !== "forced") {
    return rejected(initial.state, initial.state !== "active");
  }

  if (!input.currentPassword) {
    return rejected("temporary_password_required", false);
  }
  const validationError = validateAdminPasswordChange({
    newPassword: input.newPassword,
    confirmPassword: input.confirmPassword,
  });
  if (validationError) {
    return rejected("password_invalid", false);
  }
  if (input.currentPassword === input.newPassword) {
    return rejected("password_reuse", false);
  }

  const requestHash = await deps.hashRequest({
    operationId: input.operationId,
    userId: initial.userId,
    email: initial.email,
    credentialVersion: initial.credentialVersion,
  });
  const claimed = await deps.claim({
    operationId: input.operationId,
    actorUid: initial.userId,
    targetUserId: initial.userId,
    targetEmailNormalized: initial.email,
    requestHash,
  });
  if (!claimed.ok) {
    return rejected(claimed.error.code, true);
  }
  if (claimed.data.disposition === "completed_retry") {
    const outcome = claimed.data.operation.safeResult?.outcome;
    if (outcome === "password_changed") {
      return { ok: true, code: "password_changed", clearSession: true };
    }
    if (outcome === "temporary_password_rejected" || outcome === "rejected") {
      return rejected("temporary_password_invalid", false);
    }
    if (outcome === "provider_unavailable" || outcome === "provider_timeout") {
      return rejected(outcome, false);
    }
    return rejected("operation_conflict", true);
  }
  const leaseToken = claimed.data.leaseToken;
  const leaseExpiresAt = providerLeaseExpiresAt(claimed.data.operation, deps);
  if (!leaseToken || !leaseExpiresAt) {
    return rejected("lease_conflict", true);
  }
  const lease: OperationLease = {
    operationId: input.operationId,
    fenceVersion: claimed.data.operation.fenceVersion,
    leaseToken,
    userId: initial.userId,
    email: initial.email,
  };

  const fenced = await deps.inspectSession(input.token);
  if (
    fenced.state !== "forced" ||
    fenced.userId !== initial.userId ||
    fenced.email !== initial.email ||
    fenced.credentialVersion !== initial.credentialVersion
  ) {
    const reason =
      "userId" in fenced &&
      (fenced.userId !== initial.userId || fenced.email !== initial.email)
        ? "identity_mismatch"
        : fenced.state === "version_mismatch" ||
            ("credentialVersion" in fenced &&
              fenced.credentialVersion !== initial.credentialVersion)
          ? "credential_version_mismatch"
          : "profile_state_conflict";
    const recorded = await deps.recordLateFence({
      ...lease,
      reason,
      expectedCredentialVersion: initial.credentialVersion,
      observedCredentialVersion:
        "credentialVersion" in fenced
          ? fenced.credentialVersion
          : null,
    });
    return recorded.ok
      ? rejected("late_fence", true)
      : quarantine(deps, lease);
  }

  const verifiedTemporary = await deps.verifyPassword({
    email: initial.email,
    password: input.currentPassword,
    expectedUserId: initial.userId,
    leaseExpiresAt,
  });
  if (!verifiedTemporary.ok) {
    if (verifiedTemporary.ambiguous) {
      return quarantine(deps, lease);
    }
    if (verifiedTemporary.error.code === "provider_identity_mismatch") {
      return quarantine(deps, lease);
    }
    const releaseStage =
      verifiedTemporary.error.code === "provider_rejected"
        ? "temporary_password_rejected"
        : verifiedTemporary.error.code === "provider_unavailable" ||
            verifiedTemporary.error.code === "provider_timeout"
          ? verifiedTemporary.error.code
          : null;
    if (!releaseStage) {
      return quarantine(deps, lease);
    }
    const released = await deps.release({
      ...lease,
      stage: releaseStage,
    });
    return released.ok
      ? rejected(
          releaseStage === "temporary_password_rejected"
            ? "temporary_password_invalid"
            : releaseStage,
          false,
        )
      : quarantine(deps, lease);
  }

  let cleanupPending = true;
  const cleanTransientSessions = async (): Promise<boolean> => {
    const cleaned = await deps.signOut({
      accessToken: verifiedTemporary.data.accessToken,
      leaseExpiresAt,
    });
    if (cleaned.ok) {
      cleanupPending = false;
      return true;
    }
    return false;
  };

  try {
  const n = initial.credentialVersion;
  const n1 = n + 1;
  const n2 = n + 2;
  const profileN1 = await deps.advanceProfile({
    ...lease,
    expectedCredentialVersion: n,
    nextCredentialVersion: n1,
    expectedStage: "claimed",
    nextStage: "profile_n1",
  });
  if (!profileN1.ok) {
    await cleanTransientSessions();
    return quarantine(deps, lease);
  }
  const authN1 = await deps.updateAuth({
    userId: initial.userId,
    password: input.newPassword,
    credentialVersion: n1,
    leaseExpiresAt,
  });
  if (!authN1.ok) {
    if (!(await cleanTransientSessions())) {
      return quarantine(deps, lease);
    }
    if (
      authN1.ambiguous ||
      authN1.error.code !== "provider_rejected"
    ) {
      return quarantine(deps, lease);
    }
    const rolledBack = await deps.rollbackAndRelease({
      ...lease,
      expectedCredentialVersion: n1,
      nextCredentialVersion: n,
      stage: "auth_n1_rejected",
    });
    return rolledBack.ok
      ? rejected("password_update_rejected", true)
      : quarantine(deps, lease);
  }
  if (!(await deps.advanceStage({ ...lease, stage: "auth_n1_aligned" })).ok) {
    await cleanTransientSessions();
    return quarantine(deps, lease);
  }

  const verifiedNew = await deps.verifyPassword({
    email: initial.email,
    password: input.newPassword,
    expectedUserId: initial.userId,
    leaseExpiresAt,
  });
  if (!verifiedNew.ok) {
    await cleanTransientSessions();
    return quarantine(deps, lease);
  }

  const globallySignedOut = await deps.signOut({
    accessToken: verifiedNew.data.accessToken,
    leaseExpiresAt,
  });
  if (!globallySignedOut.ok) {
    await cleanTransientSessions();
    return quarantine(deps, lease);
  }
  cleanupPending = false;

  const profileN2 = await deps.advanceProfile({
    ...lease,
    expectedCredentialVersion: n1,
    nextCredentialVersion: n2,
    expectedStage: "auth_n1_aligned",
    nextStage: "profile_n2",
  });
  if (!profileN2.ok) {
    return quarantine(deps, lease);
  }
  const authN2 = await deps.updateAuth({
    userId: initial.userId,
    credentialVersion: n2,
    leaseExpiresAt,
  });
  if (!authN2.ok) {
    if (
      authN2.ambiguous ||
      authN2.error.code !== "provider_rejected"
    ) {
      return quarantine(deps, lease);
    }
    const rolledBack = await deps.rollbackAndRelease({
      ...lease,
      expectedCredentialVersion: n2,
      nextCredentialVersion: n1,
      stage: "auth_n2_rejected",
    });
    return rolledBack.ok
      ? rejected("credential_alignment_rejected", true)
      : quarantine(deps, lease);
  }
  if (
    !(await deps.advanceStage({ ...lease, stage: "auth_n2_aligned" })).ok
  ) {
    return quarantine(deps, lease);
  }

  const completed = await deps.complete({
    ...lease,
    credentialVersion: n2,
  });
  return completed.ok
    ? { ok: true, code: "password_changed", clearSession: true }
    : quarantine(deps, lease);
  } catch {
    return quarantine(deps, lease);
  } finally {
    if (cleanupPending) {
      await cleanTransientSessions();
    }
  }
}

async function hashCanonicalRequest(input: {
  operationId: string;
  userId: string;
  email: string;
  credentialVersion: number;
}): Promise<string> {
  const canonicalBytes = new TextEncoder().encode(
    JSON.stringify({
      purpose: "forced_password_change_v1",
      operationId: input.operationId,
      userId: input.userId,
      email: input.email,
      credentialVersion: input.credentialVersion,
    }),
  );
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    canonicalBytes,
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function createForcedPasswordChangeDependencies(): ForcedPasswordChangeDependencies {
  const config = getCentralUserManagerAgentConfig();
  if (!config.enabled || !config.credentialFenceEnabled) {
    throw new Error("Forced password change is unavailable.");
  }
  const client = createCentralUserManagerAdminClient(config);
  const repositoryDependencies = { client };
  const providerTimeoutMs = 10_000;

  function providerDependencies(
    leaseExpiresAt: string,
  ): AuthProviderDependencies {
    return {
      client,
      createTransientClient: () =>
        createCentralUserManagerAdminClient(config),
      deadline: {
        timeoutMs: providerTimeoutMs,
        leaseExpiresAt,
      },
    };
  }

  return {
    inspectSession: (token) => inspectForcedPasswordSession(token),
    claim: (input) =>
      claimForcedPasswordChangeV2(input, repositoryDependencies),
    verifyPassword: ({ leaseExpiresAt, ...input }) =>
      transientlyVerifyPassword(
        input,
        providerDependencies(leaseExpiresAt),
      ),
    advanceProfile: (input) =>
      advanceForcedPasswordProfileV2(input, repositoryDependencies),
    advanceStage: (input) =>
      advanceForcedPasswordChange(input, repositoryDependencies),
    updateAuth: async ({
      userId,
      credentialVersion,
      password,
      leaseExpiresAt,
    }) => {
      const authDependencies = providerDependencies(leaseExpiresAt);
      const current = await findAuthUserById({ userId }, authDependencies);
      if (!current.ok) {
        return current;
      }
      if (!current.data) {
        return {
          ok: false,
          ambiguous: false,
          error: {
            code: "provider_identity_mismatch",
            message: "Supabase Auth identity did not match.",
          },
        };
      }
      return updateManagedAuthUser(
        {
          user: current.data,
          credentialVersion,
          ...(password === undefined ? {} : { password }),
        },
        authDependencies,
      );
    },
    signOut: ({ accessToken, leaseExpiresAt }) =>
      globallySignOutAccessToken(
        { accessToken },
        providerDependencies(leaseExpiresAt),
      ),
    complete: (input) =>
      completeForcedPasswordChangeV2(input, repositoryDependencies),
    release: (input) =>
      releaseForcedPasswordChangeV2(input, repositoryDependencies),
    rollbackAndRelease: (input) =>
      rollbackForcedPasswordChangeV2(input, repositoryDependencies),
    quarantine: (input) =>
      quarantineAdminUserOperation(input, repositoryDependencies),
    recordLateFence: (input) =>
      recordForcedPasswordLateFenceV2(input, repositoryDependencies),
    hashRequest: hashCanonicalRequest,
    now: Date.now,
    providerTimeoutMs,
  };
}
