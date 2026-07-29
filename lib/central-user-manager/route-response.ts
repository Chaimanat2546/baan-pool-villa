import type {
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
const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SAFE_OPERATION_STAGE = /^[a-z0-9_]{1,64}$/;

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

  const bearer = await verifyBearer(
    request,
    config.bearerToken,
    config.tokenVersion,
  );
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

function projectUser(user: CentralAdminUser): CentralAdminUser {
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

function projectError(error: SafeAgentError | undefined): SafeAgentError | undefined {
  if (!error) {
    return undefined;
  }
  const catalogError =
    SAFE_AGENT_ERROR_CATALOG[
      error.code as keyof typeof SAFE_AGENT_ERROR_CATALOG
    ];

  return catalogError
    ? { code: catalogError.code, message: catalogError.message }
    : {
        code: SAFE_AGENT_ERROR_CATALOG.provider_failure.code,
        message: SAFE_AGENT_ERROR_CATALOG.provider_failure.message,
      };
}

function projectResult(
  result: AgentOperationResponse["result"],
): AgentOperationResponse["result"] | undefined {
  if (!result) {
    return undefined;
  }
  const projected: NonNullable<AgentOperationResponse["result"]> = {};

  if (Array.isArray(result.users)) {
    projected.users = result.users.map(projectUser);
  }
  if (result.pagination) {
    projected.pagination = {
      page: result.pagination.page,
      pageSize: result.pagination.pageSize,
      hasMore: result.pagination.hasMore,
    };
  }
  if (result.user) {
    projected.user = projectUser(result.user);
  }
  if (typeof result.temporaryPassword === "string") {
    projected.temporaryPassword = result.temporaryPassword;
  }

  return Object.keys(projected).length > 0 ? projected : undefined;
}

export function operationRouteResponse(
  tenantId: string,
  operation: AgentOperationResponse,
): Response {
  if (
    !CANONICAL_UUID.test(operation.operationId) ||
    !AGENT_OPERATION_STATUSES.has(operation.status) ||
    !SAFE_OPERATION_STAGE.test(operation.stage)
  ) {
    return agentErrorResponse(
      503,
      "agent_unavailable",
      "Central User Manager Agent is unavailable.",
    );
  }

  const error = projectError(operation.error);
  const result = projectResult(operation.result);
  const status = AVAILABILITY_ERROR_CODES.has(error?.code ?? "")
    ? 503
    : operation.status === "completed"
      ? 200
      : 409;

  return agentJsonResponse(
    {
      tenantId,
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
