import "server-only";

import type { CentralUserAction } from "./contracts";
import {
  createSafeAgentError,
  SAFE_AGENT_ERROR_CATALOG,
  type SafeAgentError,
  type SafeAgentErrorCode,
} from "./safe-errors";
import { createCentralUserManagerAdminClient } from "./supabase-admin";

export type CentralUserManagerAdminClient = ReturnType<
  typeof createCentralUserManagerAdminClient
>;

export interface OperationRepositoryDependencies {
  client: CentralUserManagerAdminClient;
  crypto?: Pick<Crypto, "getRandomValues" | "subtle">;
}

export type RepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SafeAgentError };

export interface AdminUserOperationRecord {
  operationId: string;
  actorKind: "central_admin" | "target_admin";
  actorUid: string;
  action: CentralUserAction | "complete_password_change";
  targetUserId: string | null;
  targetEmailNormalized: string | null;
  requestHash: string;
  status:
    | "received"
    | "leased"
    | "provider_intent"
    | "provider_outcome"
    | "completed"
    | "quarantined"
    | "needs_review";
  stage: string;
  fenceVersion: number;
  attemptCount: number;
  leaseExpiresAt: string | null;
  safeResult: Record<string, unknown> | null;
  safeError: SafeAgentError | null;
}

export interface ClaimedOperation {
  operation: AdminUserOperationRecord;
  leaseToken: string | null;
  disposition: "first_claim" | "exact_retry" | "completed_retry";
}

type RpcResponse = {
  data: unknown;
  error: unknown;
};

const DEFAULT_LEASE_SECONDS = 30;
const HASH = /^[0-9a-f]{64}$/;
const SAFE_TEXT = /^[a-z0-9_]{1,64}$/;
const OPERATION_ACTIONS = new Set([
  "list_users",
  "create_user",
  "reissue_temporary_password",
  "suspend_user",
  "reactivate_user",
  "complete_password_change",
]);
const OPERATION_STATUSES = new Set([
  "received",
  "leased",
  "provider_intent",
  "provider_outcome",
  "completed",
  "quarantined",
  "needs_review",
]);
const ACTOR_KINDS = new Set(["central_admin", "target_admin"]);
const DISPOSITIONS = new Set([
  "first_claim",
  "exact_retry",
  "completed_retry",
]);
const MAPPED_DATABASE_ERRORS = new Set<SafeAgentErrorCode>([
  "operation_conflict",
  "lease_conflict",
  "operation_quarantined",
  "provider_ambiguous",
  "lease_lost",
  "identity_mismatch",
  "profile_write_failed",
  "profile_state_conflict",
  "credential_version_mismatch",
]);
const FORBIDDEN_RESULT_KEY_PARTS = [
  "password",
  "token",
  "secret",
  "authorization",
  "hash",
  "rawerror",
  "stack",
  "details",
  "hint",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isSafeResult(
  value: unknown,
): value is Record<string, unknown> | null {
  if (value === null) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }

  const pending: unknown[] = [value];
  const seen = new WeakSet<object>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null) {
      continue;
    }
    if (seen.has(current)) {
      return false;
    }
    seen.add(current);

    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }

    for (const [key, child] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (
        FORBIDDEN_RESULT_KEY_PARTS.some((part) =>
          normalizedKey.includes(part),
        )
      ) {
        return false;
      }
      pending.push(child);
    }
  }

  return true;
}

function failure<T>(code: SafeAgentErrorCode): RepositoryResult<T> {
  return {
    ok: false,
    error: createSafeAgentError(SAFE_AGENT_ERROR_CATALOG[code]),
  };
}

function mapDatabaseError<T>(error: unknown): RepositoryResult<T> {
  const rawCode =
    isRecord(error) && typeof error.message === "string"
      ? error.message
      : undefined;
  const code =
    rawCode && MAPPED_DATABASE_ERRORS.has(rawCode as SafeAgentErrorCode)
      ? (rawCode as SafeAgentErrorCode)
      : "database_unavailable";

  return failure(code);
}

function mapSafeError(
  code: unknown,
  message: unknown,
): SafeAgentError | null | undefined {
  if (code === null && message === null) {
    return null;
  }
  if (typeof code !== "string" || typeof message !== "string") {
    return undefined;
  }

  const catalogEntry =
    SAFE_AGENT_ERROR_CATALOG[code as SafeAgentErrorCode] ?? undefined;
  if (!catalogEntry || catalogEntry.message !== message) {
    return undefined;
  }

  return createSafeAgentError(catalogEntry);
}

function mapOperation(value: unknown): AdminUserOperationRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    operation_id: operationId,
    actor_kind: actorKind,
    actor_uid: actorUid,
    action,
    target_user_id: targetUserId,
    target_email_normalized: targetEmailNormalized,
    request_hash: requestHash,
    status,
    stage,
    fence_version: fenceVersion,
    attempt_count: attemptCount,
    lease_expires_at: leaseExpiresAt,
    safe_result: safeResult,
    safe_error_code: safeErrorCode,
    safe_error_message: safeErrorMessage,
  } = value;
  const safeError = mapSafeError(safeErrorCode, safeErrorMessage);

  if (
    typeof operationId !== "string" ||
    typeof actorKind !== "string" ||
    !ACTOR_KINDS.has(actorKind) ||
    typeof actorUid !== "string" ||
    typeof action !== "string" ||
    !OPERATION_ACTIONS.has(action) ||
    !isNullableString(targetUserId) ||
    !isNullableString(targetEmailNormalized) ||
    typeof requestHash !== "string" ||
    !HASH.test(requestHash) ||
    typeof status !== "string" ||
    !OPERATION_STATUSES.has(status) ||
    typeof stage !== "string" ||
    !SAFE_TEXT.test(stage) ||
    !Number.isInteger(fenceVersion) ||
    (fenceVersion as number) < 1 ||
    !Number.isInteger(attemptCount) ||
    (attemptCount as number) < 0 ||
    !isNullableString(leaseExpiresAt) ||
    !isSafeResult(safeResult) ||
    safeError === undefined
  ) {
    return null;
  }

  return {
    operationId,
    actorKind: actorKind as AdminUserOperationRecord["actorKind"],
    actorUid,
    action: action as AdminUserOperationRecord["action"],
    targetUserId,
    targetEmailNormalized,
    requestHash,
    status: status as AdminUserOperationRecord["status"],
    stage,
    fenceVersion: fenceVersion as number,
    attemptCount: attemptCount as number,
    leaseExpiresAt,
    safeResult,
    safeError,
  };
}

function mapClaimedOperation(
  value: unknown,
  rawLeaseToken: string,
): ClaimedOperation | null {
  if (
    !isRecord(value) ||
    typeof value.disposition !== "string" ||
    !DISPOSITIONS.has(value.disposition) ||
    typeof value.lease_token_accepted !== "boolean"
  ) {
    return null;
  }

  const operation = mapOperation(value.operation);
  if (!operation) {
    return null;
  }

  return {
    operation,
    leaseToken: value.lease_token_accepted ? rawLeaseToken : null,
    disposition: value.disposition as ClaimedOperation["disposition"],
  };
}

async function callRpc(
  client: CentralUserManagerAdminClient,
  name: string,
  params: Record<string, unknown>,
): Promise<RpcResponse> {
  try {
    return (await client.rpc(name, params)) as RpcResponse;
  } catch (error) {
    return { data: null, error };
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function createLeaseToken(
  cryptoProvider: Pick<Crypto, "getRandomValues" | "subtle">,
) {
  const bytes = cryptoProvider.getRandomValues(new Uint8Array(32));
  const raw = encodeBase64Url(bytes);
  return { raw, hash: await hashLeaseToken(raw, cryptoProvider) };
}

async function hashLeaseToken(
  raw: string,
  cryptoProvider: Pick<Crypto, "getRandomValues" | "subtle">,
) {
  const digest = await cryptoProvider.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function getCrypto(
  deps: OperationRepositoryDependencies,
): Pick<Crypto, "getRandomValues" | "subtle"> {
  return deps.crypto ?? globalThis.crypto;
}

async function runClaim(
  rpcName:
    | "claim_forced_password_change_v2"
    | "resume_admin_user_operation_v2",
  params: Record<string, unknown>,
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<ClaimedOperation>> {
  try {
    const token = await createLeaseToken(getCrypto(deps));
    const response = await callRpc(deps.client, rpcName, {
      ...params,
      p_lease_token_hash: token.hash,
    });
    if (response.error) {
      return mapDatabaseError(response.error);
    }

    const claimed = mapClaimedOperation(response.data, token.raw);
    return claimed
      ? { ok: true, data: claimed }
      : failure("database_unavailable");
  } catch {
    return failure("database_unavailable");
  }
}

export async function resumeAdminUserOperation(
  input: {
    operationId: string;
    actorUid: string;
    action: CentralUserAction;
    targetUserId?: string | null;
    targetEmailNormalized: string;
    requestHash: string;
    leaseSeconds?: number;
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<ClaimedOperation>> {
  return runClaim(
    "resume_admin_user_operation_v2",
    {
      p_operation_id: input.operationId,
      p_actor_uid: input.actorUid,
      p_action: input.action,
      p_target_user_id: input.targetUserId ?? null,
      p_target_email_normalized: input.targetEmailNormalized,
      p_request_hash: input.requestHash,
      p_lease_seconds: input.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
    },
    deps,
  );
}

export async function renewAdminUserOperationLease(
  input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    leaseSeconds?: number;
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<ClaimedOperation>> {
  try {
    const cryptoProvider = getCrypto(deps);
    const currentHash = await hashLeaseToken(input.leaseToken, cryptoProvider);
    const nextToken = await createLeaseToken(cryptoProvider);
    const response = await callRpc(
      deps.client,
      "renew_admin_user_operation_lease",
      {
        p_operation_id: input.operationId,
        p_fence_version: input.fenceVersion,
        p_current_lease_token_hash: currentHash,
        p_new_lease_token_hash: nextToken.hash,
        p_lease_seconds: input.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
      },
    );
    if (response.error) {
      return mapDatabaseError(response.error);
    }

    const claimed = mapClaimedOperation(response.data, nextToken.raw);
    return claimed
      ? { ok: true, data: claimed }
      : failure("database_unavailable");
  } catch {
    return failure("database_unavailable");
  }
}

async function runOperationRpc(
  rpcName:
    | "commit_admin_user_provider_intent_v2"
    | "commit_admin_user_provider_outcome_v2"
    | "complete_admin_user_operation_v2"
    | "quarantine_admin_user_operation"
    | "mark_admin_user_operation_needs_review"
    | "record_admin_user_late_fence"
    | "record_admin_user_late_fence_v2"
    | "advance_forced_password_change"
    | "complete_forced_password_change_v2"
    | "release_forced_password_change_v2"
    | "rollback_forced_password_change_v2"
    | "record_forced_password_late_fence_v2",
  params: Record<string, unknown>,
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<AdminUserOperationRecord>> {
  const response = await callRpc(deps.client, rpcName, params);
  if (response.error) {
    return mapDatabaseError(response.error);
  }

  const operation = mapOperation(response.data);
  return operation
    ? { ok: true, data: operation }
    : failure("database_unavailable");
}

export type AdminUserProviderStep =
  | "auth_create"
  | "auth_delete"
  | "auth_update"
  | "password_verify"
  | "global_signout";

export type AdminUserProviderOutcomeErrorCode =
  | "provider_timeout"
  | "provider_unavailable"
  | "provider_rejected"
  | "provider_identity_mismatch"
  | "provider_pagination_limit";

export async function commitAdminUserProviderIntent(
  input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    providerStep: AdminUserProviderStep;
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<AdminUserOperationRecord>> {
  try {
    return runOperationRpc(
      "commit_admin_user_provider_intent_v2",
      {
        p_operation_id: input.operationId,
        p_fence_version: input.fenceVersion,
        p_lease_token_hash: await hashLeaseToken(
          input.leaseToken,
          getCrypto(deps),
        ),
        p_provider_step: input.providerStep,
      },
      deps,
    );
  } catch {
    return failure("database_unavailable");
  }
}

export async function commitAdminUserProviderOutcome(
  input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    providerStep: AdminUserProviderStep;
    outcome: "succeeded" | "rejected";
    targetUserId: string | null;
    credentialVersion: number;
    providerErrorCode: AdminUserProviderOutcomeErrorCode | null;
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<AdminUserOperationRecord>> {
  try {
    return runOperationRpc(
      "commit_admin_user_provider_outcome_v2",
      {
        p_operation_id: input.operationId,
        p_fence_version: input.fenceVersion,
        p_lease_token_hash: await hashLeaseToken(
          input.leaseToken,
          getCrypto(deps),
        ),
        p_provider_step: input.providerStep,
        p_outcome: input.outcome,
        p_target_user_id: input.targetUserId,
        p_credential_version: input.credentialVersion,
        p_provider_error_code: input.providerErrorCode,
      },
      deps,
    );
  } catch {
    return failure("database_unavailable");
  }
}

export async function quarantineAdminUserOperation(
  input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    errorCode: "provider_ambiguous" | "lease_lost";
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<AdminUserOperationRecord>> {
  try {
    const leaseTokenHash = await hashLeaseToken(
      input.leaseToken,
      getCrypto(deps),
    );
    return runOperationRpc(
      "quarantine_admin_user_operation",
      {
        p_operation_id: input.operationId,
        p_fence_version: input.fenceVersion,
        p_lease_token_hash: leaseTokenHash,
        p_error_code: input.errorCode,
      },
      deps,
    );
  } catch {
    return failure("database_unavailable");
  }
}

export interface CompletedAdminUser {
  userId: string;
  email: string;
  status:
    | "active"
    | "password_change_required"
    | "suspended"
    | "abnormal";
  createdAt: string | null;
  lastSignInAt: string | null;
  credentialVersion: number;
  authCredentialVersion: number;
}

export async function completeAdminUserOperationV2(
  input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    terminalKind: "success" | "duplicate" | "compensated";
    user: CompletedAdminUser | null;
    errorCode: "user_exists" | "create_compensated" | null;
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<AdminUserOperationRecord>> {
  try {
    const user = input.user;
    return runOperationRpc(
      "complete_admin_user_operation_v2",
      {
        p_operation_id: input.operationId,
        p_fence_version: input.fenceVersion,
        p_lease_token_hash: await hashLeaseToken(
          input.leaseToken,
          getCrypto(deps),
        ),
        p_terminal_kind: input.terminalKind,
        p_user_id: user?.userId ?? null,
        p_email_normalized: user?.email ?? null,
        p_user_status: user?.status ?? null,
        p_created_at: user?.createdAt ?? null,
        p_last_sign_in_at: user?.lastSignInAt ?? null,
        p_credential_version: user?.credentialVersion ?? null,
        p_auth_credential_version:
          user?.authCredentialVersion ?? null,
        p_error_code: input.errorCode,
      },
      deps,
    );
  } catch {
    return failure("database_unavailable");
  }
}

export async function markAdminUserOperationNeedsReview(
  input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    errorCode:
      | "identity_mismatch"
      | "profile_write_failed"
      | "profile_state_conflict";
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<AdminUserOperationRecord>> {
  try {
    const leaseTokenHash = await hashLeaseToken(
      input.leaseToken,
      getCrypto(deps),
    );
    return runOperationRpc(
      "mark_admin_user_operation_needs_review",
      {
        p_operation_id: input.operationId,
        p_fence_version: input.fenceVersion,
        p_lease_token_hash: leaseTokenHash,
        p_error_code: input.errorCode,
      },
      deps,
    );
  } catch {
    return failure("database_unavailable");
  }
}

export async function recordAdminUserLateFence(
  input: {
    operationId: string;
    fenceVersion: number;
    expectedCredentialVersion: number;
    observedCredentialVersion: number;
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<AdminUserOperationRecord>> {
  return runOperationRpc(
    "record_admin_user_late_fence_v2",
    {
      p_operation_id: input.operationId,
      p_fence_version: input.fenceVersion,
      p_expected_credential_version: input.expectedCredentialVersion,
      p_observed_credential_version: input.observedCredentialVersion,
    },
    deps,
  );
}

export async function claimForcedPasswordChangeV2(
  input: {
    operationId: string;
    actorUid: string;
    targetUserId: string;
    targetEmailNormalized: string;
    requestHash: string;
    leaseSeconds?: number;
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<ClaimedOperation>> {
  return runClaim(
    "claim_forced_password_change_v2",
    {
      p_operation_id: input.operationId,
      p_actor_uid: input.actorUid,
      p_target_user_id: input.targetUserId,
      p_target_email_normalized: input.targetEmailNormalized,
      p_request_hash: input.requestHash,
      p_lease_seconds: input.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
    },
    deps,
  );
}

export async function advanceForcedPasswordChange(
  input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    stage: string;
    safeResult?: Record<string, unknown> | null;
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<AdminUserOperationRecord>> {
  if (!isSafeResult(input.safeResult ?? null)) {
    return failure("operation_conflict");
  }

  try {
    const leaseTokenHash = await hashLeaseToken(
      input.leaseToken,
      getCrypto(deps),
    );
    return runOperationRpc(
      "advance_forced_password_change",
      {
        p_operation_id: input.operationId,
        p_fence_version: input.fenceVersion,
        p_lease_token_hash: leaseTokenHash,
        p_stage: input.stage,
        p_safe_result: input.safeResult ?? null,
      },
      deps,
    );
  } catch {
    return failure("database_unavailable");
  }
}

interface ForcedPasswordLeaseInput {
  operationId: string;
  fenceVersion: number;
  leaseToken: string;
  userId: string;
  email: string;
}

async function runForcedPasswordLeaseRpc(
  name:
    | "complete_forced_password_change_v2"
    | "release_forced_password_change_v2"
    | "rollback_forced_password_change_v2"
    | "record_forced_password_late_fence_v2",
  input: ForcedPasswordLeaseInput,
  extra: Record<string, unknown>,
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<AdminUserOperationRecord>> {
  try {
    return runOperationRpc(
      name,
      {
        p_operation_id: input.operationId,
        p_fence_version: input.fenceVersion,
        p_lease_token_hash: await hashLeaseToken(
          input.leaseToken,
          getCrypto(deps),
        ),
        p_user_id: input.userId,
        p_email_normalized: input.email,
        ...extra,
      },
      deps,
    );
  } catch {
    return failure("database_unavailable");
  }
}

export function completeForcedPasswordChangeV2(
  input: ForcedPasswordLeaseInput & { credentialVersion: number },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<AdminUserOperationRecord>> {
  return runForcedPasswordLeaseRpc(
    "complete_forced_password_change_v2",
    input,
    { p_credential_version: input.credentialVersion },
    deps,
  );
}

export function releaseForcedPasswordChangeV2(
  input: ForcedPasswordLeaseInput & { stage: string },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<AdminUserOperationRecord>> {
  return runForcedPasswordLeaseRpc(
    "release_forced_password_change_v2",
    input,
    { p_stage: input.stage },
    deps,
  );
}

export function rollbackForcedPasswordChangeV2(
  input: ForcedPasswordLeaseInput & {
    expectedCredentialVersion: number;
    nextCredentialVersion: number;
    stage: string;
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<AdminUserOperationRecord>> {
  return runForcedPasswordLeaseRpc(
    "rollback_forced_password_change_v2",
    input,
    {
      p_expected_credential_version: input.expectedCredentialVersion,
      p_next_credential_version: input.nextCredentialVersion,
      p_stage: input.stage,
    },
    deps,
  );
}

export interface ForcedPasswordProfile {
  userId: string;
  email: string;
  credentialVersion: number;
  mustChangePassword: true;
}

export async function advanceForcedPasswordProfileV2(
  input: ForcedPasswordLeaseInput & {
    expectedCredentialVersion: number;
    nextCredentialVersion: number;
    expectedStage: "claimed" | "auth_n1_aligned";
    nextStage: "profile_n1" | "profile_n2";
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<ForcedPasswordProfile>> {
  try {
    const response = await callRpc(
      deps.client,
      "advance_forced_password_profile_v2",
      {
        p_operation_id: input.operationId,
        p_fence_version: input.fenceVersion,
        p_lease_token_hash: await hashLeaseToken(
          input.leaseToken,
          getCrypto(deps),
        ),
        p_user_id: input.userId,
        p_email_normalized: input.email,
        p_expected_credential_version: input.expectedCredentialVersion,
        p_next_credential_version: input.nextCredentialVersion,
        p_expected_stage: input.expectedStage,
        p_next_stage: input.nextStage,
      },
    );
    if (response.error) {
      return mapDatabaseError(response.error);
    }
    const row = response.data;
    if (
      !isRecord(row) ||
      row.user_id !== input.userId ||
      row.email !== input.email ||
      row.is_active !== true ||
      row.must_change_password !== true ||
      row.credential_version !== input.nextCredentialVersion
    ) {
      return failure("database_unavailable");
    }
    return {
      ok: true,
      data: {
        userId: input.userId,
        email: input.email,
        credentialVersion: input.nextCredentialVersion,
        mustChangePassword: true,
      },
    };
  } catch {
    return failure("database_unavailable");
  }
}

export async function recordForcedPasswordLateFenceV2(
  input: ForcedPasswordLeaseInput & {
    reason:
      | "identity_mismatch"
      | "profile_state_conflict"
      | "credential_version_mismatch";
    expectedCredentialVersion: number;
    observedCredentialVersion: number | null;
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<AdminUserOperationRecord>> {
  return runForcedPasswordLeaseRpc(
    "record_forced_password_late_fence_v2",
    input,
    {
      p_reason: input.reason,
      p_expected_credential_version: input.expectedCredentialVersion,
      p_observed_credential_version: input.observedCredentialVersion,
    },
    deps,
  );
}
