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
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isSafeResult(
  value: unknown,
): value is Record<string, unknown> | null {
  return (
    value === null ||
    (isRecord(value) &&
      !Object.prototype.hasOwnProperty.call(value, "temporaryPassword"))
  );
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
  rpcName: "claim_admin_user_operation" | "claim_forced_password_change",
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

export async function claimAdminUserOperation(
  input: {
    operationId: string;
    actorKind: "central_admin" | "target_admin";
    actorUid: string;
    action: CentralUserAction;
    targetUserId?: string | null;
    targetEmailNormalized?: string | null;
    requestHash: string;
    leaseSeconds?: number;
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<ClaimedOperation>> {
  return runClaim(
    "claim_admin_user_operation",
    {
      p_operation_id: input.operationId,
      p_actor_kind: input.actorKind,
      p_actor_uid: input.actorUid,
      p_action: input.action,
      p_target_user_id: input.targetUserId ?? null,
      p_target_email_normalized: input.targetEmailNormalized ?? null,
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
    | "commit_admin_user_operation_stage"
    | "complete_admin_user_operation"
    | "quarantine_admin_user_operation"
    | "advance_forced_password_change",
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

export async function commitAdminUserOperationStage(
  input: {
    operationId: string;
    fenceVersion: number;
    leaseToken: string;
    stage: "provider_intent" | "provider_outcome";
    targetUserId?: string | null;
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
      "commit_admin_user_operation_stage",
      {
        p_operation_id: input.operationId,
        p_fence_version: input.fenceVersion,
        p_lease_token_hash: leaseTokenHash,
        p_stage: input.stage,
        p_target_user_id: input.targetUserId ?? null,
        p_safe_result: input.safeResult ?? null,
      },
      deps,
    );
  } catch {
    return failure("database_unavailable");
  }
}

export async function completeAdminUserOperation(
  input: {
    operationId: string;
    fenceVersion?: number;
    leaseToken?: string;
    safeResult?: Record<string, unknown> | null;
  },
  deps: OperationRepositoryDependencies,
): Promise<RepositoryResult<AdminUserOperationRecord>> {
  if (!isSafeResult(input.safeResult ?? null)) {
    return failure("operation_conflict");
  }

  try {
    const leaseTokenHash = input.leaseToken
      ? await hashLeaseToken(input.leaseToken, getCrypto(deps))
      : null;
    return runOperationRpc(
      "complete_admin_user_operation",
      {
        p_operation_id: input.operationId,
        p_fence_version: input.fenceVersion ?? null,
        p_lease_token_hash: leaseTokenHash,
        p_safe_result: input.safeResult ?? null,
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

export async function claimForcedPasswordChange(
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
    "claim_forced_password_change",
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
