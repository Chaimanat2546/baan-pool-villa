import type {
  AgentOperationRequest,
  AgentOperationResponse,
  CentralAdminUser,
} from "./contracts";
import type { CentralUserManagerAgentConfig } from "./config";
import {
  getCentralUserManagerAgentConfig,
} from "./config";
import {
  requireCentralBearer,
  type VerifiedCentralBearerRequest,
} from "./bearer-auth";
import {
  SAFE_AGENT_ERROR_CATALOG,
  type SafeAgentError,
} from "./safe-errors";
import { isCanonicalRfc9562Uuid } from "./canonical-uuid";
import { normalizeAdminEmail } from "./email";

export const AGENT_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
} as const;

export const MAX_AGENT_OPERATION_BODY_BYTES = 16_384;

const AVAILABILITY_ERROR_CODES = new Set([
  "database_unavailable",
  "provider_failure",
]);
const AGENT_OPERATION_STATUSES = new Set([
  "completed",
  "in_progress",
  "needs_review",
  "quarantined",
]);
const SAFE_OPERATION_STAGES = new Set([
  "list",
  "listed",
  "claimed",
  "completed",
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

export function applyAgentResponseHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(AGENT_RESPONSE_HEADERS)) {
    response.headers.set(name, value);
  }

  return response;
}

export function agentJsonResponse(
  body: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(AGENT_RESPONSE_HEADERS)) {
    headers.set(name, value);
  }

  return Response.json(body, { ...init, headers });
}

export function agentErrorResponse(
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit,
): Response {
  return agentJsonResponse(
    { error: { code, message } },
    { status, headers },
  );
}

export function agentMethodNotAllowedResponse(allow: "GET" | "POST") {
  return agentErrorResponse(
    405,
    "method_not_allowed",
    "Method not allowed.",
    { Allow: allow },
  );
}

export interface AgentAuthorizationDependencies {
  getConfig?: () => CentralUserManagerAgentConfig;
  requireBearer?: typeof requireCentralBearer;
}

export type AuthorizedAgentRequest =
  | {
      ok: true;
      config: CentralUserManagerAgentConfig;
      bearer: VerifiedCentralBearerRequest;
    }
  | { ok: false; response: Response };

export async function authorizeCentralAgentRequest(
  request: Request,
  dependencies: AgentAuthorizationDependencies = {},
): Promise<AuthorizedAgentRequest> {
  const getConfig =
    dependencies.getConfig ?? getCentralUserManagerAgentConfig;
  const verifyBearer =
    dependencies.requireBearer ?? requireCentralBearer;
  let config: CentralUserManagerAgentConfig;

  try {
    config = getConfig();
  } catch {
    return {
      ok: false,
      response: agentErrorResponse(
        503,
        "agent_unavailable",
        "Central User Manager Agent is unavailable.",
      ),
    };
  }

  if (!config.enabled || !config.credentialFenceEnabled) {
    return {
      ok: false,
      response: agentErrorResponse(
        503,
        "agent_unavailable",
        "Central User Manager Agent is unavailable.",
      ),
    };
  }

  let bearer: Awaited<ReturnType<typeof requireCentralBearer>>;
  try {
    bearer = await verifyBearer(
      request,
      config.bearerToken,
      config.tokenVersion,
    );
  } catch {
    return {
      ok: false,
      response: agentErrorResponse(
        503,
        "agent_unavailable",
        "Central User Manager Agent is unavailable.",
      ),
    };
  }
  if (bearer instanceof Response) {
    return {
      ok: false,
      response: applyAgentResponseHeaders(bearer),
    };
  }

  if (request.headers.get("X-CUM-Version") !== "1") {
    return {
      ok: false,
      response: agentErrorResponse(
        422,
        "invalid_protocol_version",
        "Invalid Central User Manager protocol version.",
      ),
    };
  }

  return { ok: true, config, bearer };
}

export type BoundedRequestBytesResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: "too_large" | "invalid_body" };

function precheckedContentLength(request: Request): number | null {
  const value = request.headers.get("Content-Length");
  if (!value || !/^(?:0|[1-9]\d*)$/.test(value)) {
    return null;
  }

  const length = Number(value);
  return Number.isSafeInteger(length) ? length : null;
}

export async function readBoundedRequestBytes(
  request: Request,
  maximumBytes = MAX_AGENT_OPERATION_BODY_BYTES,
): Promise<BoundedRequestBytesResult> {
  const contentLength = precheckedContentLength(request);
  if (contentLength !== null && contentLength > maximumBytes) {
    return { ok: false, reason: "too_large" };
  }

  let body: ReadableStream<Uint8Array> | null;
  try {
    body = request.body;
  } catch {
    return { ok: false, reason: "invalid_body" };
  }
  if (!body) {
    return { ok: true, bytes: new Uint8Array() };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = body.getReader();
  } catch {
    return { ok: false, reason: "invalid_body" };
  }

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      if (!(chunk.value instanceof Uint8Array)) {
        return { ok: false, reason: "invalid_body" };
      }
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maximumBytes) {
        try {
          await reader.cancel();
        } catch {
          // The request is already rejected; cancellation is best effort.
        }
        return { ok: false, reason: "too_large" };
      }
      chunks.push(chunk.value);
    }
  } catch {
    return { ok: false, reason: "invalid_body" };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, bytes };
}

export async function sha256Hex(
  bytes: Uint8Array,
  cryptoDependency: Pick<Crypto, "subtle"> = globalThis.crypto,
): Promise<string> {
  const ownedBytes = new Uint8Array(bytes.byteLength);
  ownedBytes.set(bytes);
  const digest = await cryptoDependency.subtle.digest(
    "SHA-256",
    ownedBytes.buffer,
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

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
  const catalogError =
    SAFE_AGENT_ERROR_CATALOG[
      error.code as keyof typeof SAFE_AGENT_ERROR_CATALOG
    ];

  return catalogError
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
    !Array.isArray(result.users) ||
    result.users.length > expectedPageSize ||
    !isRecord(result.pagination) ||
    result.user !== undefined
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
  request: AgentOperationRequest,
  status: AgentOperationResponse["status"],
  result: AgentOperationResponse["result"],
): ResultProjection {
  if (!result || status !== "completed") {
    return { ok: true };
  }
  if (
    request.action === "list_users" ||
    !("email" in request.payload) ||
    result.users !== undefined ||
    result.pagination !== undefined
  ) {
    return { ok: false };
  }
  const projected: NonNullable<AgentOperationResponse["result"]> = {};
  if (result.user) {
    const user = projectUser(result.user);
    if (
      !user ||
      user.email !== request.payload.email ||
      (request.action === "suspend_user"
        ? user.status !== "suspended"
        : user.status !== "password_change_required")
    ) {
      return { ok: false };
    }
    projected.user = user;
  }
  if (
    typeof result.temporaryPassword === "string" &&
    PASSWORD_RESPONSE_ACTIONS.has(request.action) &&
    TEMPORARY_PASSWORD.test(result.temporaryPassword)
  ) {
    projected.temporaryPassword = result.temporaryPassword;
  }

  return {
    ok: true,
    ...(Object.keys(projected).length > 0 ? { result: projected } : {}),
  };
}

function projectResult(
  request: AgentOperationRequest,
  operation: AgentOperationResponse,
): ResultProjection {
  if (request.action === "list_users") {
    if (operation.status !== "completed") {
      return { ok: true };
    }
    if (!("page" in request.payload)) {
      return { ok: false };
    }
    return projectListResult(
      request.payload.page,
      request.payload.pageSize,
      operation.result,
    );
  }

  return projectMutationResult(request, operation.status, operation.result);
}

export function operationRouteResponse(
  config: CentralUserManagerAgentConfig,
  request: AgentOperationRequest,
  operation: AgentOperationResponse,
): Response {
  if (
    request.tenantId !== config.tenantId ||
    !isCanonicalRfc9562Uuid(operation.operationId) ||
    operation.operationId !== request.operationId ||
    !AGENT_OPERATION_STATUSES.has(operation.status) ||
    !SAFE_OPERATION_STAGES.has(operation.stage) ||
    (operation.status === "completed" &&
      operation.stage !== (
        request.action === "list_users" ? "listed" : "completed"
      ))
  ) {
    return agentErrorResponse(
      503,
      "agent_unavailable",
      "Central User Manager Agent is unavailable.",
    );
  }

  const errorProjection = projectError(operation.error);
  const resultProjection = projectResult(request, operation);
  if (!errorProjection.ok || !resultProjection.ok) {
    return agentErrorResponse(
      503,
      "agent_unavailable",
      "Central User Manager Agent is unavailable.",
    );
  }
  const { error } = errorProjection;
  const { result } = resultProjection;
  const status = AVAILABILITY_ERROR_CODES.has(error?.code ?? "")
    ? 503
    : operation.status === "completed"
      ? 200
      : 409;

  return agentJsonResponse(
    {
      tenantId: config.tenantId,
      protocolVersion: 1,
      operationId: operation.operationId,
      status: operation.status,
      stage: operation.stage,
      ...(result ? { result } : {}),
      ...(error ? { error } : {}),
    },
    { status },
  );
}
