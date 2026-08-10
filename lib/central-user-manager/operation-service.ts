import "server-only";

import type {
  AgentOperationRequest,
  AgentOperationResponse,
  CentralAdminUser,
} from "./contracts";
import type {
  ProviderDeadlineControls,
  ProviderResult,
  ProviderUser,
} from "./auth-provider";
import type {
  AdminUserOperationRecord,
  AdminUserProviderOutcomeErrorCode,
  AdminUserProviderStep,
  ClaimedOperation,
  CompletedAdminUser,
  RepositoryResult,
} from "./operation-repository";
import type {
  CentralAdminProfile,
  ProfileRepositoryResult,
} from "./profile-repository";
import type {
  ReconciledAdminUserPage,
  ReconciledListRepositoryResult,
} from "./reconciled-list-repository";
import {
  createSafeAgentError,
  SAFE_AGENT_ERROR_CATALOG,
  type SafeAgentError,
} from "./safe-errors";

export type { CentralAdminProfile } from "./profile-repository";

type MutationAction = Exclude<AgentOperationRequest["action"], "list_users">;
type MutationRequest = AgentOperationRequest & {
  action: MutationAction;
  payload: { email: string };
};
type LeaseState = {
  operation: AdminUserOperationRecord;
  leaseToken: string;
};

export interface OperationStateRepository {
  claim(input: {
    operationId: string;
    actorKind: "central_admin";
    actorUid: string;
    action: MutationAction;
    targetUserId: string | null;
    targetEmailNormalized: string;
    requestHash: string;
  }): Promise<RepositoryResult<ClaimedOperation>>;
  renew(input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
  }): Promise<RepositoryResult<ClaimedOperation>>;
  commitProviderIntent(input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    providerStep: AdminUserProviderStep;
  }): Promise<RepositoryResult<AdminUserOperationRecord>>;
  commitProviderOutcome(input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    providerStep: AdminUserProviderStep;
    outcome: "succeeded" | "rejected";
    targetUserId: string | null;
    credentialVersion: number;
    providerErrorCode: AdminUserProviderOutcomeErrorCode | null;
  }): Promise<RepositoryResult<AdminUserOperationRecord>>;
  complete(input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    terminalKind: "success" | "duplicate" | "compensated";
    user: CompletedAdminUser | null;
    errorCode: "user_exists" | "create_compensated" | null;
  }): Promise<RepositoryResult<AdminUserOperationRecord>>;
  quarantine(input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    errorCode: "provider_ambiguous" | "lease_lost";
  }): Promise<RepositoryResult<AdminUserOperationRecord>>;
  markNeedsReview(input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    errorCode:
      | "identity_mismatch"
      | "profile_write_failed"
      | "profile_state_conflict";
  }): Promise<RepositoryResult<AdminUserOperationRecord>>;
  recordLateFence(input: {
    operationId: string;
    fenceVersion: number;
    expectedCredentialVersion: number;
    observedCredentialVersion: number;
  }): Promise<RepositoryResult<AdminUserOperationRecord>>;
}

export interface OperationProfileRepository {
  findByNormalizedEmail(input: {
    email: string;
  }): Promise<ProfileRepositoryResult<CentralAdminProfile[]>>;
  findByUserId(input: {
    userId: string;
  }): Promise<ProfileRepositoryResult<CentralAdminProfile | null>>;
  createForOperation(input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    userId: string;
    email: string;
  }): Promise<ProfileRepositoryResult<CentralAdminProfile>>;
  advanceForOperation(input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    userId: string;
    email: string;
    expectedIsActive: boolean;
    expectedMustChangePassword: boolean;
    expectedCredentialVersion: number;
    nextIsActive: boolean;
    nextMustChangePassword: boolean;
    nextCredentialVersion: number;
  }): Promise<ProfileRepositoryResult<CentralAdminProfile>>;
  activateForOperation(input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    userId: string;
    email: string;
    credentialVersion: number;
  }): Promise<ProfileRepositoryResult<CentralAdminProfile>>;
  prepareCompensation(input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    userId: string;
    email: string;
  }): Promise<ProfileRepositoryResult<{ stage: "compensation_ready" }>>;
}

export interface OperationAuthProvider {
  findByUserId(input: {
    userId: string;
  }): Promise<ProviderResult<ProviderUser | null>>;
  findByNormalizedEmail(
    input: { email: string },
    deadline: ProviderDeadlineControls,
  ): Promise<ProviderResult<ProviderUser[]>>;
  createManagedUser(
    input: { email: string; password: string; operationId: string },
    deadline: ProviderDeadlineControls,
  ): Promise<ProviderResult<ProviderUser>>;
  updateManagedUser(
    input: {
      user: ProviderUser;
      password?: string;
      credentialVersion: number;
      banDuration?: "876000h" | "none";
    },
    deadline: ProviderDeadlineControls,
  ): Promise<ProviderResult<ProviderUser>>;
  verifyPassword(
    input: { email: string; password: string; expectedUserId: string },
    deadline: ProviderDeadlineControls,
  ): Promise<ProviderResult<{ accessToken: string }>>;
  globallySignOut(
    input: { accessToken: string },
    deadline: ProviderDeadlineControls,
  ): Promise<ProviderResult<null>>;
  deleteManagedUser(
    input: { userId: string },
    deadline: ProviderDeadlineControls,
  ): Promise<ProviderResult<null>>;
}

export interface OperationListRepository {
  listPage(input: {
    page: number;
    pageSize: number;
  }): Promise<
    ReconciledListRepositoryResult<ReconciledAdminUserPage>
  >;
}

export interface CentralUserOperationContext {
  requestHash: string;
  operations: OperationStateRepository;
  profiles: OperationProfileRepository;
  auth: OperationAuthProvider;
  list: OperationListRepository;
  now: () => number;
  providerTimeoutMs: number;
  generateTemporaryPassword: () => string;
}

function safeError(
  code: keyof typeof SAFE_AGENT_ERROR_CATALOG,
): SafeAgentError {
  return createSafeAgentError(SAFE_AGENT_ERROR_CATALOG[code]);
}

function response(
  operationId: string,
  status: AgentOperationResponse["status"],
  stage: string,
  error?: SafeAgentError,
): AgentOperationResponse {
  return {
    operationId,
    status,
    stage,
    ...(error ? { error } : {}),
  };
}

function failureResponse(
  operationId: string,
  error: SafeAgentError,
  stage = "claimed",
): AgentOperationResponse {
  const status =
    error.code === "operation_quarantined"
      ? "quarantined"
      : error.code === "lease_conflict" || error.code === "lease_lost"
        ? "in_progress"
        : "needs_review";
  return response(operationId, status, stage, error);
}

function terminalResponse(
  operation: AdminUserOperationRecord,
): AgentOperationResponse {
  if (operation.status === "completed") {
    const persisted = parsePersistedSafeResult(operation.safeResult);
    return {
      operationId: operation.operationId,
      status: "completed",
      stage: operation.stage,
      ...(persisted.result ? { result: persisted.result } : {}),
      ...(persisted.error ? { error: persisted.error } : {}),
    };
  }

  return response(
    operation.operationId,
    operation.status === "quarantined" ? "quarantined" : "needs_review",
    operation.stage,
    operation.safeError ??
      safeError(
        operation.status === "quarantined"
          ? "operation_quarantined"
          : "identity_mismatch",
      ),
  );
}

function isCentralAdminUser(value: unknown): value is CentralAdminUser {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const user = value as Record<string, unknown>;
  return (
    typeof user.userId === "string" &&
    typeof user.email === "string" &&
    ["active", "password_change_required", "suspended", "abnormal"].includes(
      String(user.status),
    ) &&
    (user.createdAt === null || typeof user.createdAt === "string") &&
    (user.lastSignInAt === null ||
      typeof user.lastSignInAt === "string") &&
    (user.credentialVersion === null ||
      Number.isSafeInteger(user.credentialVersion)) &&
    (user.authCredentialVersion === null ||
      Number.isSafeInteger(user.authCredentialVersion))
  );
}

function projectCentralAdminUser(
  user: CentralAdminUser,
): CentralAdminUser {
  return {
    userId: user.userId,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt,
    credentialVersion: user.credentialVersion,
    authCredentialVersion: user.authCredentialVersion,
  };
}

function parsePersistedSafeResult(
  value: Record<string, unknown> | null,
): Pick<AgentOperationResponse, "result" | "error"> {
  if (!value) {
    return {};
  }

  const user = isCentralAdminUser(value.user)
    ? projectCentralAdminUser(value.user)
    : undefined;
  const errorCode =
    typeof value.errorCode === "string" &&
    value.errorCode in SAFE_AGENT_ERROR_CATALOG
      ? (value.errorCode as keyof typeof SAFE_AGENT_ERROR_CATALOG)
      : undefined;

  return {
    ...(user ? { result: { user } } : {}),
    ...(errorCode ? { error: safeError(errorCode) } : {}),
  };
}

function normalizedEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function authCredentialVersion(user: ProviderUser): number | null {
  const version = user.appMetadata.credential_version;
  return Number.isSafeInteger(version) && (version as number) > 0
    ? (version as number)
    : null;
}

function isManaged(user: ProviderUser): boolean {
  return user.appMetadata.bpv_admin_managed === true;
}

function userStatus(
  profile: CentralAdminProfile,
): CentralAdminUser["status"] {
  if (!profile.isActive) {
    return "suspended";
  }
  return profile.mustChangePassword ? "password_change_required" : "active";
}

function toJoinedUser(
  provider: ProviderUser | null,
  profile: CentralAdminProfile | null,
  abnormal: boolean,
): CentralAdminUser {
  return {
    userId: provider?.id ?? profile?.userId ?? "",
    email: normalizedEmail(provider?.email ?? profile?.email ?? "") ?? "",
    status:
      abnormal || !provider || !profile ? "abnormal" : userStatus(profile),
    createdAt: provider?.createdAt ?? profile?.createdAt ?? null,
    lastSignInAt: provider?.lastSignInAt ?? null,
    credentialVersion: profile?.credentialVersion ?? null,
    authCredentialVersion: provider
      ? authCredentialVersion(provider)
      : null,
  };
}

async function executeList(
  context: CentralUserOperationContext,
  request: AgentOperationRequest & {
    action: "list_users";
    payload: { page: number; pageSize: number };
  },
): Promise<AgentOperationResponse> {
  const pagination = {
    page: request.payload.page,
    pageSize: request.payload.pageSize,
  };
  const listed = await context.list.listPage(pagination);
  if (!listed.ok) {
    return failureResponse(request.operationId, listed.error, "list");
  }

  return {
    operationId: request.operationId,
    status: "completed",
    stage: "listed",
    result: {
      users: listed.data.users,
      pagination: {
        ...pagination,
        hasMore:
          pagination.page < 100 && listed.data.hasMore,
      },
    },
  };
}

function safeUser(
  provider: ProviderUser,
  profile: CentralAdminProfile,
): CompletedAdminUser {
  return {
    ...toJoinedUser(
      provider,
      profile,
      !isManaged(provider) ||
        provider.id !== profile.userId ||
        normalizedEmail(provider.email) !== profile.email ||
        authCredentialVersion(provider) !== profile.credentialVersion,
    ),
    credentialVersion: profile.credentialVersion,
    authCredentialVersion: authCredentialVersion(provider) as number,
  };
}

function exactIdentity(
  providerUsers: ProviderUser[],
  profiles: CentralAdminProfile[],
): { provider: ProviderUser; profile: CentralAdminProfile } | null {
  if (providerUsers.length !== 1 || profiles.length !== 1) {
    return null;
  }
  const provider = providerUsers[0];
  const profile = profiles[0];
  return isManaged(provider) &&
    provider.id === profile.userId &&
    normalizedEmail(provider.email) === profile.email &&
    authCredentialVersion(provider) === profile.credentialVersion
    ? { provider, profile }
    : null;
}

async function readIdentity(
  context: CentralUserOperationContext,
  lease: LeaseState,
  email: string,
): Promise<
  | {
      ok: true;
      providerUsers: ProviderUser[];
      profiles: CentralAdminProfile[];
      lease: LeaseState;
    }
  | { ok: false; response: AgentOperationResponse }
> {
  const renewed = await renew(context, lease);
  if (!renewed.ok) {
    return { ok: false, response: renewed.response };
  }
  const providerResult = await context.auth.findByNormalizedEmail(
    { email },
    renewed.deadline,
  );
  if (!providerResult.ok) {
    return {
      ok: false,
      response: await needsReview(
        context,
        renewed.lease,
        "identity_mismatch",
      ),
    };
  }
  const profileResult =
    await context.profiles.findByNormalizedEmail({ email });
  if (!profileResult.ok) {
    return {
      ok: false,
      response: await needsReview(
        context,
        renewed.lease,
        "identity_mismatch",
      ),
    };
  }
  return {
    ok: true,
    providerUsers: providerResult.data,
    profiles: profileResult.data,
    lease: renewed.lease,
  };
}

function providerOutcome(
  operation: AdminUserOperationRecord,
  step: AdminUserProviderStep,
): { userId: string; credentialVersion: number } | null {
  const result = operation.safeResult;
  return result?.providerStep === step &&
    result.outcome === "succeeded" &&
    typeof result.userId === "string" &&
    Number.isSafeInteger(result.credentialVersion)
    ? {
        userId: result.userId,
        credentialVersion: result.credentialVersion as number,
      }
    : null;
}

async function renew(
  context: CentralUserOperationContext,
  lease: LeaseState,
): Promise<
  { ok: true; lease: LeaseState; deadline: ProviderDeadlineControls } | {
    ok: false;
    response: AgentOperationResponse;
  }
> {
  const renewed = await context.operations.renew({
    operationId: lease.operation.operationId,
    fenceVersion: lease.operation.fenceVersion,
    leaseToken: lease.leaseToken,
  });
  if (!renewed.ok || !renewed.data.leaseToken) {
    return {
      ok: false,
      response: failureResponse(
        lease.operation.operationId,
        renewed.ok ? safeError("lease_lost") : renewed.error,
        lease.operation.stage,
      ),
    };
  }
  const nextLease = {
    operation: renewed.data.operation,
    leaseToken: renewed.data.leaseToken,
  };
  const leaseExpiresAt =
    renewed.data.operation.leaseExpiresAt ??
    new Date(context.now()).toISOString();
  const remainingLeaseMs = Date.parse(leaseExpiresAt) - context.now();
  const maximumSafeTimeoutMs = Math.floor(remainingLeaseMs - 5_001);
  return {
    ok: true,
    lease: nextLease,
    deadline: {
      timeoutMs: Math.max(
        1,
        Math.min(context.providerTimeoutMs, maximumSafeTimeoutMs),
      ),
      leaseExpiresAt,
      now: context.now,
    },
  };
}

async function journaledProviderMutation<T>(
  context: CentralUserOperationContext,
  lease: LeaseState,
  providerStep: AdminUserProviderStep,
  targetUserId: string | null,
  credentialVersion: number,
  mutate: (
    deadline: ProviderDeadlineControls,
  ) => Promise<ProviderResult<T>>,
  resolveOutcome?: (data: T) => {
    targetUserId: string;
    credentialVersion: number;
  },
): Promise<
  | { ok: true; data: T; lease: LeaseState }
  | { ok: false; response: AgentOperationResponse; lease: LeaseState }
> {
  const renewed = await renew(context, lease);
  if (!renewed.ok) {
    return { ok: false, response: renewed.response, lease };
  }
  lease = renewed.lease;
  const intent = await context.operations.commitProviderIntent({
    operationId: lease.operation.operationId,
    fenceVersion: lease.operation.fenceVersion,
    leaseToken: lease.leaseToken,
    providerStep,
  });
  if (!intent.ok) {
    return {
      ok: false,
      response: failureResponse(
        lease.operation.operationId,
        intent.error,
        lease.operation.stage,
      ),
      lease,
    };
  }
  lease = { ...lease, operation: intent.data };

  const provider = await mutate(renewed.deadline);
  if (!provider.ok && provider.ambiguous) {
    const quarantined = await context.operations.quarantine({
      operationId: lease.operation.operationId,
      fenceVersion: lease.operation.fenceVersion,
      leaseToken: lease.leaseToken,
      errorCode: "provider_ambiguous",
    });
    return {
      ok: false,
      response: quarantined.ok
        ? response(
            lease.operation.operationId,
            "quarantined",
            "quarantined",
            safeError("provider_ambiguous"),
          )
        : failureResponse(
            lease.operation.operationId,
            safeError("provider_ambiguous"),
            "quarantined",
          ),
      lease,
    };
  }

  const resolvedOutcome =
    provider.ok && resolveOutcome
      ? resolveOutcome(provider.data)
      : { targetUserId: targetUserId ?? "", credentialVersion };
  const outcome = await context.operations.commitProviderOutcome({
    operationId: lease.operation.operationId,
    fenceVersion: lease.operation.fenceVersion,
    leaseToken: lease.leaseToken,
    providerStep,
    targetUserId: resolvedOutcome.targetUserId || null,
    outcome: provider.ok ? "succeeded" : "rejected",
    credentialVersion: resolvedOutcome.credentialVersion,
    providerErrorCode: provider.ok ? null : provider.error.code,
  });
  if (!outcome.ok) {
    return {
      ok: false,
      response: failureResponse(
        lease.operation.operationId,
        outcome.error,
        lease.operation.stage,
      ),
      lease,
    };
  }
  lease = { ...lease, operation: outcome.data };
  if (provider.ok) {
    return { ok: true, data: provider.data, lease };
  }

  return {
    ok: false,
    response: terminalResponse(outcome.data),
    lease,
  };
}

async function complete(
  context: CentralUserOperationContext,
  lease: LeaseState,
  safeResult: Record<string, unknown>,
  result?: {
    user?: CompletedAdminUser;
    temporaryPassword?: string;
  },
  error?: SafeAgentError,
): Promise<AgentOperationResponse> {
  const completed = await context.operations.complete({
    operationId: lease.operation.operationId,
    fenceVersion: lease.operation.fenceVersion,
    leaseToken: lease.leaseToken,
    terminalKind:
      error?.code === "user_exists"
        ? "duplicate"
        : error?.code === "create_compensated"
          ? "compensated"
          : "success",
    user: result?.user ?? null,
    errorCode:
      error?.code === "user_exists" ||
      error?.code === "create_compensated"
        ? error.code
        : null,
  });
  if (!completed.ok) {
    return failureResponse(
      lease.operation.operationId,
      completed.error,
      lease.operation.stage,
    );
  }
  return {
    operationId: lease.operation.operationId,
    status: "completed",
    stage: "completed",
    ...(result ? { result } : {}),
    ...(error ? { error } : {}),
  };
}

async function needsReview(
  context: CentralUserOperationContext,
  lease: LeaseState,
  errorCode:
    | "identity_mismatch"
    | "profile_write_failed"
    | "profile_state_conflict",
): Promise<AgentOperationResponse> {
  const reviewed = await context.operations.markNeedsReview({
    operationId: lease.operation.operationId,
    fenceVersion: lease.operation.fenceVersion,
    leaseToken: lease.leaseToken,
    errorCode,
  });
  return reviewed.ok
    ? terminalResponse(reviewed.data)
    : failureResponse(
        lease.operation.operationId,
        reviewed.error,
        lease.operation.stage,
      );
}

async function verifyFinalIdentity(
  context: CentralUserOperationContext,
  lease: LeaseState,
  email: string,
  userId: string,
  expected: {
    isActive: boolean;
    mustChangePassword: boolean | null;
    confirmationRequired?: boolean;
    ban: "future" | "none" | "any";
  },
): Promise<
  | {
      ok: true;
      data: {
        provider: ProviderUser;
        profile: CentralAdminProfile;
      } | null;
      lease: LeaseState;
    }
  | { ok: false; response: AgentOperationResponse }
> {
  const renewed = await renew(context, lease);
  if (!renewed.ok) {
    return { ok: false, response: renewed.response };
  }
  const providerResult = await context.auth.findByNormalizedEmail(
    { email },
    renewed.deadline,
  );
  if (!providerResult.ok || providerResult.data.length !== 1) {
    return { ok: true, data: null, lease: renewed.lease };
  }
  const profileResult = await context.profiles.findByUserId({ userId });
  if (!profileResult.ok || !profileResult.data) {
    return { ok: true, data: null, lease: renewed.lease };
  }
  const provider = providerResult.data[0];
  const exact = exactIdentity([provider], [profileResult.data]);
  const banMatches =
    expected.ban === "any" ||
    (expected.ban === "none" && provider.bannedUntil === null) ||
    (expected.ban === "future" &&
      provider.bannedUntil !== null &&
      Date.parse(provider.bannedUntil) > context.now());
  const identity = exact &&
    profileResult.data.isActive === expected.isActive &&
    (expected.mustChangePassword === null ||
      profileResult.data.mustChangePassword ===
        expected.mustChangePassword) &&
    (!expected.confirmationRequired ||
      provider.emailConfirmedAt !== null) &&
    banMatches
    ? { provider, profile: profileResult.data }
    : null;
  return { ok: true, data: identity, lease: renewed.lease };
}

async function executeCreate(
  context: CentralUserOperationContext,
  request: MutationRequest,
  lease: LeaseState,
): Promise<AgentOperationResponse> {
  const email = request.payload.email;
  const recoveredCreate = providerOutcome(lease.operation, "auth_create");
  const recoveredDelete = providerOutcome(lease.operation, "auth_delete");
  let createdUser: ProviderUser | null = null;
  let temporaryPassword: string | undefined;

  if (recoveredDelete) {
    return complete(
      context,
      lease,
      { outcome: "failed", errorCode: "create_compensated" },
      undefined,
      safeError("create_compensated"),
    );
  }

  if (!recoveredCreate && lease.operation.stage === "claimed") {
    const identity = await readIdentity(context, lease, email);
    if (!identity.ok) {
      return identity.response;
    }
    lease = identity.lease;
    const exact = exactIdentity(identity.providerUsers, identity.profiles);
    if (exact) {
      const user = safeUser(exact.provider, exact.profile);
      return complete(
        context,
        lease,
        { outcome: "failed", errorCode: "user_exists", user },
        { user },
        safeError("user_exists"),
      );
    }
    if (
      identity.providerUsers.length !== 0 ||
      identity.profiles.length !== 0
    ) {
      return needsReview(context, lease, "identity_mismatch");
    }

    temporaryPassword = context.generateTemporaryPassword();
    const creation = await journaledProviderMutation(
      context,
      lease,
      "auth_create",
      null,
      1,
      (deadline) =>
        context.auth.createManagedUser(
          {
            email,
            password: temporaryPassword as string,
            operationId: request.operationId,
          },
          deadline,
        ),
      (user) => ({
        targetUserId: user.id,
        credentialVersion: authCredentialVersion(user) ?? 1,
      }),
    );
    if (!creation.ok) {
      return creation.response;
    }
    createdUser = creation.data;
    lease = creation.lease;
  }

  const userId =
    createdUser?.id ??
    recoveredCreate?.userId ??
    lease.operation.targetUserId;
  if (!userId) {
    return needsReview(context, lease, "identity_mismatch");
  }

  if (lease.operation.stage === "compensation_ready") {
    return compensateCreate(context, request, lease, userId);
  }

  if (lease.operation.stage !== "profile_created") {
    const createdProfile = await context.profiles.createForOperation({
      operationId: request.operationId,
      fenceVersion: lease.operation.fenceVersion,
      leaseToken: lease.leaseToken,
      userId,
      email,
    });
    if (!createdProfile.ok) {
      const existingProfile =
        await context.profiles.findByUserId({ userId });
      if (!existingProfile.ok) {
        return needsReview(context, lease, "profile_write_failed");
      }
      if (
        existingProfile.data?.email === email &&
        existingProfile.data.credentialVersion === 1
      ) {
        // The profile RPC may have committed before its response was lost.
      } else {
        if (existingProfile.data !== null) {
          return needsReview(context, lease, "identity_mismatch");
        }
        if (createdProfile.error.code !== "profile_write_failed") {
          return needsReview(context, lease, "profile_write_failed");
        }
        const prepared =
          await context.profiles.prepareCompensation({
            operationId: request.operationId,
            fenceVersion: lease.operation.fenceVersion,
            leaseToken: lease.leaseToken,
            userId,
            email,
          });
        if (!prepared.ok) {
          return needsReview(context, lease, "profile_write_failed");
        }
        return compensateCreate(context, request, lease, userId);
      }
    }
  }

  const verified = await verifyFinalIdentity(
    context,
    lease,
    email,
    userId,
    {
      isActive: true,
      mustChangePassword: true,
      confirmationRequired: true,
      ban: "none",
    },
  );
  if (!verified.ok) {
    return verified.response;
  }
  lease = verified.lease;
  if (!verified.data) {
    return needsReview(context, lease, "identity_mismatch");
  }
  const user = safeUser(
    verified.data.provider,
    verified.data.profile,
  );
  return complete(
    context,
    lease,
    { outcome: "success", user },
    {
      user,
      ...(temporaryPassword ? { temporaryPassword } : {}),
    },
  );
}

function provesCreateOwnership(
  user: ProviderUser,
  request: MutationRequest,
  userId: string,
): boolean {
  return (
    user.id === userId &&
    normalizedEmail(user.email) === request.payload.email &&
    isManaged(user) &&
    user.appMetadata.bpv_created_operation_id === request.operationId
  );
}

async function compensateCreate(
  context: CentralUserOperationContext,
  request: MutationRequest,
  lease: LeaseState,
  userId: string,
): Promise<AgentOperationResponse> {
  const renewed = await renew(context, lease);
  if (!renewed.ok) {
    return renewed.response;
  }
  lease = renewed.lease;
  const lookup = await context.auth.findByNormalizedEmail(
    { email: request.payload.email },
    renewed.deadline,
  );
  if (
    !lookup.ok ||
    lookup.data.length !== 1 ||
    !provesCreateOwnership(lookup.data[0], request, userId)
  ) {
    return needsReview(context, lease, "identity_mismatch");
  }
  const deleteResult = await journaledProviderMutation(
    context,
    lease,
    "auth_delete",
    userId,
    1,
    (deadline) =>
      context.auth.deleteManagedUser({ userId }, deadline),
  );
  if (!deleteResult.ok) {
    return deleteResult.response;
  }
  return complete(
    context,
    deleteResult.lease,
    { outcome: "failed", errorCode: "create_compensated" },
    undefined,
    safeError("create_compensated"),
  );
}

function lifecycleNextState(
  action: MutationAction,
  profile: CentralAdminProfile,
) {
  return {
    expectedIsActive: profile.isActive,
    expectedMustChangePassword: profile.mustChangePassword,
    expectedCredentialVersion: profile.credentialVersion,
    nextIsActive:
      action === "reactivate_user" || action === "suspend_user"
        ? false
        : profile.isActive,
    nextMustChangePassword:
      action === "suspend_user" ? profile.mustChangePassword : true,
    nextCredentialVersion: profile.credentialVersion + 1,
  };
}

function lifecyclePrecondition(
  action: MutationAction,
  profile: CentralAdminProfile,
): boolean {
  return action === "reactivate_user" ? !profile.isActive : profile.isActive;
}

async function quarantineLostSecret(
  context: CentralUserOperationContext,
  lease: LeaseState,
): Promise<AgentOperationResponse> {
  return needsReview(context, lease, "profile_state_conflict");
}

async function executeLifecycle(
  context: CentralUserOperationContext,
  request: MutationRequest,
  lease: LeaseState,
): Promise<AgentOperationResponse> {
  const email = request.payload.email;
  const action = request.action;
  const recoveredUpdate = providerOutcome(lease.operation, "auth_update");
  const recoveredVerify = providerOutcome(
    lease.operation,
    "password_verify",
  );
  const recoveredSignout = providerOutcome(
    lease.operation,
    "global_signout",
  );
  let provider: ProviderUser;
  let profile: CentralAdminProfile;
  let credentialVersion: number;
  let temporaryPassword: string | undefined;
  let suspensionExpectedMustChangePassword: boolean | null = null;

  if (
    action === "reactivate_user" &&
    lease.operation.stage === "profile_activated" &&
    recoveredSignout
  ) {
    const verified = await verifyFinalIdentity(
      context,
      lease,
      email,
      recoveredSignout.userId,
      {
        isActive: true,
        mustChangePassword: true,
        ban: "none",
      },
    );
    if (!verified.ok) {
      return verified.response;
    }
    lease = verified.lease;
    if (
      !verified.data ||
      !verified.data.profile.isActive ||
      verified.data.profile.credentialVersion !==
        recoveredSignout.credentialVersion
    ) {
      return needsReview(context, lease, "identity_mismatch");
    }
    const user = safeUser(
      verified.data.provider,
      verified.data.profile,
    );
    return complete(
      context,
      lease,
      { outcome: "success", user },
      { user },
    );
  }

  if (
    action !== "suspend_user" &&
    !recoveredSignout &&
    (recoveredUpdate || recoveredVerify)
  ) {
    return quarantineLostSecret(context, lease);
  }

  if (action === "reactivate_user" && recoveredSignout) {
    const beforeActivation = await verifyFinalIdentity(
      context,
      lease,
      email,
      recoveredSignout.userId,
      {
        isActive: false,
        mustChangePassword: true,
        ban: "none",
      },
    );
    if (!beforeActivation.ok) {
      return beforeActivation.response;
    }
    lease = beforeActivation.lease;
    if (
      !beforeActivation.data ||
      beforeActivation.data.profile.isActive ||
      beforeActivation.data.profile.credentialVersion !==
        recoveredSignout.credentialVersion
    ) {
      return needsReview(context, lease, "identity_mismatch");
    }
    const activated = await context.profiles.activateForOperation({
      operationId: request.operationId,
      fenceVersion: lease.operation.fenceVersion,
      leaseToken: lease.leaseToken,
      userId: recoveredSignout.userId,
      email,
      credentialVersion: recoveredSignout.credentialVersion,
    });
    if (!activated.ok) {
      return needsReview(context, lease, "profile_state_conflict");
    }
    const verified = await verifyFinalIdentity(
      context,
      lease,
      email,
      recoveredSignout.userId,
      {
        isActive: true,
        mustChangePassword: true,
        ban: "none",
      },
    );
    if (!verified.ok) {
      return verified.response;
    }
    lease = verified.lease;
    if (!verified.data) {
      return needsReview(context, lease, "identity_mismatch");
    }
    const user = safeUser(
      verified.data.provider,
      verified.data.profile,
    );
    return complete(
      context,
      lease,
      { outcome: "success", user },
      { user },
    );
  }

  if (lease.operation.stage === "claimed") {
    const identity = await readIdentity(context, lease, email);
    if (!identity.ok) {
      return identity.response;
    }
    lease = identity.lease;
    const exact = exactIdentity(identity.providerUsers, identity.profiles);
    if (!exact || !lifecyclePrecondition(action, exact.profile)) {
      return needsReview(context, lease, "identity_mismatch");
    }
    provider = exact.provider;
    if (action === "suspend_user") {
      suspensionExpectedMustChangePassword =
        exact.profile.mustChangePassword;
    }
    const advanced = await context.profiles.advanceForOperation({
      operationId: request.operationId,
      fenceVersion: lease.operation.fenceVersion,
      leaseToken: lease.leaseToken,
      userId: provider.id,
      email,
      ...lifecycleNextState(action, exact.profile),
    });
    if (!advanced.ok) {
      return needsReview(context, lease, "profile_state_conflict");
    }
    profile = advanced.data;
    credentialVersion = profile.credentialVersion;
  } else {
    const userId =
      recoveredUpdate?.userId ??
      recoveredSignout?.userId ??
      lease.operation.targetUserId;
    const storedVersion =
      recoveredUpdate?.credentialVersion ??
      recoveredSignout?.credentialVersion ??
      (Number.isSafeInteger(lease.operation.safeResult?.credentialVersion)
        ? (lease.operation.safeResult?.credentialVersion as number)
        : null);
    if (!userId || !storedVersion) {
      return needsReview(context, lease, "profile_state_conflict");
    }
    const renewedRead = await renew(context, lease);
    if (!renewedRead.ok) {
      return renewedRead.response;
    }
    lease = renewedRead.lease;
    const [providerResult, profileResult] = await Promise.all([
      context.auth.findByNormalizedEmail(
        { email },
        renewedRead.deadline,
      ),
      context.profiles.findByUserId({ userId }),
    ]);
    if (
      !providerResult.ok ||
      providerResult.data.length !== 1 ||
      !profileResult.ok ||
      !profileResult.data
    ) {
      return needsReview(context, lease, "identity_mismatch");
    }
    provider = providerResult.data[0];
    profile = profileResult.data;
    credentialVersion = storedVersion;
    const durableProfileCheckpoint =
      lease.operation.stage === "profile_advanced";
    const checkpointIsActive =
      lease.operation.safeResult?.profileIsActive;
    const checkpointMustChange =
      lease.operation.safeResult?.profileForcedFlag;
    const suspensionCheckpoint =
      lease.operation.safeResult
        ?.suspensionExpectedForcedFlag;
    const expectedSuspensionFlag = durableProfileCheckpoint
      ? checkpointMustChange
      : suspensionCheckpoint;
    const authVersion = authCredentialVersion(provider);
    const exactRecoveredIdentity =
      provider.id === userId &&
      profile.userId === userId &&
      normalizedEmail(provider.email) === email &&
      profile.email === email &&
      isManaged(provider) &&
      profile.credentialVersion === storedVersion &&
      (durableProfileCheckpoint
        ? authVersion === storedVersion - 1 &&
          typeof checkpointIsActive === "boolean" &&
          typeof checkpointMustChange === "boolean" &&
          profile.isActive === checkpointIsActive &&
          profile.mustChangePassword === checkpointMustChange
        : authVersion === storedVersion) &&
      (action !== "suspend_user" ||
        (typeof expectedSuspensionFlag === "boolean" &&
          profile.mustChangePassword === expectedSuspensionFlag));
    if (!exactRecoveredIdentity) {
      return needsReview(context, lease, "identity_mismatch");
    }
    if (action === "suspend_user") {
      suspensionExpectedMustChangePassword =
        expectedSuspensionFlag as boolean;
    }
  }

  if (!recoveredUpdate && !recoveredSignout) {
    temporaryPassword =
      action === "suspend_user"
        ? undefined
        : context.generateTemporaryPassword();
    const update = await journaledProviderMutation(
      context,
      lease,
      "auth_update",
      provider.id,
      credentialVersion,
      (deadline) =>
        context.auth.updateManagedUser(
          {
            user: provider,
            credentialVersion,
            ...(temporaryPassword
              ? { password: temporaryPassword }
              : {}),
            ...(action === "suspend_user"
              ? { banDuration: "876000h" as const }
              : action === "reactivate_user"
                ? { banDuration: "none" as const }
                : {}),
          },
          deadline,
        ),
    );
    if (!update.ok) {
      return update.response;
    }
    provider = update.data;
    lease = update.lease;
  } else if (
    action !== "suspend_user" &&
    !recoveredSignout
  ) {
    return quarantineLostSecret(context, lease);
  }

  const observedVersion = authCredentialVersion(provider);
  if (observedVersion === null) {
    return needsReview(context, lease, "identity_mismatch");
  }
  if (observedVersion !== credentialVersion) {
    await context.operations.recordLateFence({
      operationId: request.operationId,
      fenceVersion: lease.operation.fenceVersion,
      expectedCredentialVersion: credentialVersion,
      observedCredentialVersion: observedVersion,
    });
    return response(
      request.operationId,
      "needs_review",
      "late_fence",
      safeError("credential_version_mismatch"),
    );
  }

  if (action !== "suspend_user" && !recoveredSignout) {
    const verification = await journaledProviderMutation(
      context,
      lease,
      "password_verify",
      provider.id,
      credentialVersion,
      (deadline) =>
        context.auth.verifyPassword(
          {
            email,
            password: temporaryPassword as string,
            expectedUserId: provider.id,
          },
          deadline,
        ),
    );
    if (!verification.ok) {
      return verification.response;
    }
    lease = verification.lease;

    const signout = await journaledProviderMutation(
      context,
      lease,
      "global_signout",
      provider.id,
      credentialVersion,
      (deadline) =>
        context.auth.globallySignOut(
          { accessToken: verification.data.accessToken },
          deadline,
        ),
    );
    if (!signout.ok) {
      return signout.response;
    }
    lease = signout.lease;
  }

  if (action === "reactivate_user") {
    const beforeActivation = await verifyFinalIdentity(
      context,
      lease,
      email,
      provider.id,
      {
        isActive: false,
        mustChangePassword: true,
        ban: "none",
      },
    );
    if (!beforeActivation.ok) {
      return beforeActivation.response;
    }
    lease = beforeActivation.lease;
    if (
      !beforeActivation.data ||
      beforeActivation.data.profile.isActive ||
      beforeActivation.data.profile.credentialVersion !==
        credentialVersion
    ) {
      return needsReview(context, lease, "identity_mismatch");
    }
    const activated = await context.profiles.activateForOperation({
      operationId: request.operationId,
      fenceVersion: lease.operation.fenceVersion,
      leaseToken: lease.leaseToken,
      userId: provider.id,
      email,
      credentialVersion,
    });
    if (!activated.ok) {
      return needsReview(context, lease, "profile_state_conflict");
    }
    profile = activated.data;
  }

  const verified = await verifyFinalIdentity(
    context,
    lease,
    email,
    provider.id,
    action === "suspend_user"
      ? {
          isActive: false,
          mustChangePassword:
            suspensionExpectedMustChangePassword,
          ban: "future",
        }
      : {
          isActive: true,
          mustChangePassword: true,
          ban: "none",
        },
  );
  if (!verified.ok) {
    return verified.response;
  }
  lease = verified.lease;
  if (!verified.data) {
    return needsReview(context, lease, "identity_mismatch");
  }
  profile = verified.data.profile;
  const user = safeUser(verified.data.provider, profile);
  return complete(
    context,
    lease,
    { outcome: "success", user },
    {
      user,
      ...(temporaryPassword ? { temporaryPassword } : {}),
    },
  );
}

async function executeMutation(
  context: CentralUserOperationContext,
  request: MutationRequest,
): Promise<AgentOperationResponse> {
  if (request.action === "reissue_temporary_password") {
    const profiles = await context.profiles.findByNormalizedEmail({
      email: request.payload.email,
    });
    const profile = profiles.ok && profiles.data.length === 1
      ? profiles.data[0]
      : null;

    if (profile && !profile.isActive) {
      return response(
        request.operationId,
        "rejected",
        "rejected",
        safeError("invalid_lifecycle_transition"),
      );
    }
  }

  const claimed = await context.operations.claim({
    operationId: request.operationId,
    actorKind: "central_admin",
    actorUid: request.actorUid,
    action: request.action,
    targetUserId: null,
    targetEmailNormalized: request.payload.email,
    requestHash: context.requestHash,
  });
  if (!claimed.ok) {
    return failureResponse(request.operationId, claimed.error);
  }
  if (
    claimed.data.operation.status === "completed" ||
    claimed.data.operation.status === "quarantined" ||
    claimed.data.operation.status === "needs_review"
  ) {
    return terminalResponse(claimed.data.operation);
  }
  if (!claimed.data.leaseToken) {
    return response(
      request.operationId,
      "in_progress",
      claimed.data.operation.stage,
      safeError("lease_conflict"),
    );
  }

  const lease = {
    operation: claimed.data.operation,
    leaseToken: claimed.data.leaseToken,
  };
  return request.action === "create_user"
    ? executeCreate(context, request, lease)
    : executeLifecycle(context, request, lease);
}

export async function executeCentralUserOperation(
  context: CentralUserOperationContext,
  request: AgentOperationRequest,
): Promise<AgentOperationResponse> {
  return request.action === "list_users"
    ? executeList(
        context,
        request as AgentOperationRequest & {
          action: "list_users";
          payload: { page: number; pageSize: number };
        },
      )
    : executeMutation(context, request as MutationRequest);
}
