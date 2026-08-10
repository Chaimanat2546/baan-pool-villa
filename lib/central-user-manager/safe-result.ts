import type {
  AgentOperationResponse,
  CentralAdminUser,
} from "./contracts";
import type { CentralUserManagerAgentConfig } from "./config";
import type { CentralUserRpcRequest } from "./rpc-contract";
import {
  SAFE_AGENT_ERROR_CATALOG,
  type SafeAgentError,
} from "./safe-errors";
import { isCanonicalRfc9562Uuid } from "./canonical-uuid";
import { normalizeAdminEmail } from "./email";

const AGENT_OPERATION_STATUSES = new Set([
  "completed",
  "rejected",
  "in_progress",
  "needs_review",
  "quarantined",
]);
const SAFE_OPERATION_STAGES = new Set([
  "list",
  "listed",
  "claimed",
  "completed",
  "rejected",
  "needs_review",
  "quarantined",
  "late_fence",
  "provider_intent",
  "provider_outcome",
  "profile_created",
  "compensation_ready",
  "profile_advanced",
  "profile_activated",
  "auth_create_intent",
  "auth_create_succeeded",
  "auth_create_rejected",
  "auth_delete_intent",
  "auth_delete_succeeded",
  "auth_delete_rejected",
  "auth_update_intent",
  "auth_update_succeeded",
  "auth_update_rejected",
  "password_verify_intent",
  "password_verify_succeeded",
  "password_verify_rejected",
  "global_signout_intent",
  "global_signout_succeeded",
  "global_signout_rejected",
]);
const CENTRAL_ADMIN_USER_STATUSES = new Set([
  "active",
  "password_change_required",
  "suspended",
  "abnormal",
]);
const PASSWORD_RESPONSE_ACTIONS = new Set([
  "create_user",
  "reissue_temporary_password",
  "reactivate_user",
]);
const SAFE_AGENT_ERRORS_BY_CODE = new Map<string, SafeAgentError>(
  Object.values(SAFE_AGENT_ERROR_CATALOG).map((error) => [
    error.code,
    error,
  ]),
);
const CENTRAL_ADMIN_USER_KEYS = [
  "userId",
  "email",
  "status",
  "createdAt",
  "lastSignInAt",
  "credentialVersion",
  "authCredentialVersion",
] as const;
const TEMPORARY_PASSWORD = /^[!-~]{20}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    actualKeys.every((key) => keys.includes(key))
  );
}

function isNullableTimestamp(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" && Number.isFinite(Date.parse(value)))
  );
}

function isNullablePositiveInteger(
  value: unknown,
): value is number | null {
  return (
    value === null ||
    (Number.isSafeInteger(value) && (value as number) > 0)
  );
}

function projectUser(value: unknown): CentralAdminUser | null {
  if (!isRecord(value) || !hasExactKeys(value, CENTRAL_ADMIN_USER_KEYS)) {
    return null;
  }
  const {
    userId,
    email,
    status,
    createdAt,
    lastSignInAt,
    credentialVersion,
    authCredentialVersion,
  } = value;
  let normalizedEmail: string;
  try {
    normalizedEmail = normalizeAdminEmail(email);
  } catch {
    return null;
  }

  if (
    !isCanonicalRfc9562Uuid(userId) ||
    typeof email !== "string" ||
    normalizedEmail !== email ||
    typeof status !== "string" ||
    !CENTRAL_ADMIN_USER_STATUSES.has(status) ||
    !isNullableTimestamp(createdAt) ||
    !isNullableTimestamp(lastSignInAt) ||
    !isNullablePositiveInteger(credentialVersion) ||
    !isNullablePositiveInteger(authCredentialVersion)
  ) {
    return null;
  }

  return {
    userId,
    email,
    status: status as CentralAdminUser["status"],
    createdAt,
    lastSignInAt,
    credentialVersion,
    authCredentialVersion,
  };
}

type ErrorProjection =
  | { ok: true; error?: SafeAgentError }
  | { ok: false };

function projectError(error: SafeAgentError | undefined): ErrorProjection {
  if (!error) {
    return { ok: true };
  }
  if (!isRecord(error) || !hasExactKeys(error, ["code", "message"])) {
    return { ok: false };
  }
  if (typeof error.code !== "string" || typeof error.message !== "string") {
    return { ok: false };
  }
  const catalogError = SAFE_AGENT_ERRORS_BY_CODE.get(error.code);

  return catalogError && error.message === catalogError.message
    ? {
        ok: true,
        error: { code: catalogError.code, message: catalogError.message },
      }
    : { ok: false };
}

type ResultProjection =
  | { ok: true; result?: AgentOperationResponse["result"] }
  | { ok: false };

function projectListResult(
  expectedPage: number,
  expectedPageSize: number,
  result: AgentOperationResponse["result"],
): ResultProjection {
  if (
    !result ||
    !isRecord(result) ||
    !hasExactKeys(result, ["users", "pagination"]) ||
    !Array.isArray(result.users) ||
    result.users.length > expectedPageSize ||
    !isRecord(result.pagination) ||
    !hasExactKeys(result.pagination, ["page", "pageSize", "hasMore"])
  ) {
    return { ok: false };
  }
  const users: CentralAdminUser[] = [];
  for (const value of result.users) {
    const user = projectUser(value);
    if (!user) {
      return { ok: false };
    }
    users.push(user);
  }
  const { page, pageSize, hasMore } = result.pagination;
  if (
    !Number.isSafeInteger(page) ||
    page !== expectedPage ||
    !Number.isSafeInteger(pageSize) ||
    pageSize !== expectedPageSize ||
    typeof hasMore !== "boolean"
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    result: {
      users,
      pagination: { page, pageSize, hasMore },
    },
  };
}

function projectMutationResult(
  request: CentralUserRpcRequest,
  result: AgentOperationResponse["result"],
  error: SafeAgentError | undefined,
): ResultProjection {
  if (
    !result ||
    !isRecord(result) ||
    request.action === "list_users" ||
    !hasExactKeys(
      result,
      result.temporaryPassword === undefined
        ? ["user"]
        : ["user", "temporaryPassword"],
    )
  ) {
    return { ok: false };
  }
  const user = projectUser(result.user);
  const duplicateCreate =
    request.action === "create_user" && error?.code === "user_exists";
  if (
    !user ||
    user.email !== request.payload.email ||
    (duplicateCreate
      ? !["active", "password_change_required", "suspended"].includes(
          user.status,
        )
      : request.action === "suspend_user"
        ? user.status !== "suspended"
        : user.status !== "password_change_required")
  ) {
    return { ok: false };
  }
  const hasPassword = result.temporaryPassword !== undefined;
  if (
    hasPassword &&
    (typeof result.temporaryPassword !== "string" ||
      !PASSWORD_RESPONSE_ACTIONS.has(request.action) ||
      !TEMPORARY_PASSWORD.test(result.temporaryPassword) ||
      error !== undefined)
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    result: {
      user,
      ...(hasPassword
        ? { temporaryPassword: result.temporaryPassword as string }
        : {}),
    },
  };
}

type PayloadProjection =
  | {
      ok: true;
      result?: AgentOperationResponse["result"];
      error?: SafeAgentError;
    }
  | { ok: false };

function projectPayload(
  request: CentralUserRpcRequest,
  operation: AgentOperationResponse,
): PayloadProjection {
  const errorProjection = projectError(operation.error);
  if (!errorProjection.ok) {
    return { ok: false };
  }
  const { error } = errorProjection;

  if (operation.status !== "completed") {
    return operation.result === undefined &&
      error !== undefined &&
      (operation.status !== "rejected" ||
        error.code === "invalid_lifecycle_transition")
      ? { ok: true, error }
      : { ok: false };
  }

  if (request.action === "list_users") {
    if (error !== undefined) {
      return { ok: false };
    }
    const projected = projectListResult(
      request.payload.page,
      request.payload.pageSize,
      operation.result,
    );
    return projected.ok ? projected : { ok: false };
  }

  if (error?.code === "create_compensated") {
    return request.action === "create_user" && operation.result === undefined
      ? { ok: true, error }
      : { ok: false };
  }
  if (
    error !== undefined &&
    !(request.action === "create_user" && error.code === "user_exists")
  ) {
    return { ok: false };
  }

  const projected = projectMutationResult(request, operation.result, error);
  return projected.ok
    ? { ok: true, result: projected.result, ...(error ? { error } : {}) }
    : { ok: false };
}

/**
 * Returns a newly owned, safe operation envelope or null when any field is
 * inconsistent with the authenticated Tenant request.
 */
export function projectSafeCentralUserOperation(
  config: CentralUserManagerAgentConfig,
  request: CentralUserRpcRequest,
  operation: AgentOperationResponse,
): AgentOperationResponse | null {
  if (
    request.tenantId !== config.tenantId ||
    !isCanonicalRfc9562Uuid(operation.operationId) ||
    operation.operationId !== request.operationId ||
    !AGENT_OPERATION_STATUSES.has(operation.status) ||
    !SAFE_OPERATION_STAGES.has(operation.stage) ||
    (operation.status === "completed" &&
      operation.stage !== (
        request.action === "list_users" ? "listed" : "completed"
      )) ||
    (operation.status === "rejected" && operation.stage !== "rejected")
  ) {
    return null;
  }

  const payloadProjection = projectPayload(request, operation);
  if (!payloadProjection.ok) {
    return null;
  }

  return {
    operationId: operation.operationId,
    status: operation.status,
    stage: operation.stage,
    ...(payloadProjection.result ? { result: payloadProjection.result } : {}),
    ...(payloadProjection.error ? { error: payloadProjection.error } : {}),
  };
}
