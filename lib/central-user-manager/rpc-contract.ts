import { isCanonicalRfc9562Uuid } from "./canonical-uuid";
import {
  type AgentOperationRequest,
  type AgentOperationResponse,
  type CentralUserAction,
} from "./contracts";
import { normalizeAdminEmail } from "./email";
import { AgentContractError } from "./safe-errors";

export type CentralUserRpcRequest =
  | (Omit<AgentOperationRequest, "action" | "payload"> & {
      protocolVersion: 1;
      action: "list_users";
      payload: { page: number; pageSize: number };
    })
  | (Omit<AgentOperationRequest, "action" | "payload"> & {
      protocolVersion: 1;
      action: Exclude<CentralUserAction, "list_users">;
      payload: { email: string };
    });

export type CentralUserRpcResult =
  | { ok: true; operation: AgentOperationResponse }
  | {
      ok: false;
      error: {
        code: "invalid_request" | "agent_unavailable";
        message: string;
      };
    };

const REQUEST_KEYS = [
  "protocolVersion",
  "tenantId",
  "operationId",
  "actorUid",
  "action",
  "payload",
] as const;

const MUTATION_ACTIONS = new Set<Exclude<CentralUserAction, "list_users">>([
  "create_user",
  "reissue_temporary_password",
  "suspend_user",
  "reactivate_user",
]);

function invalidRequest(): never {
  throw new AgentContractError();
}

function isExactRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    actualKeys.every((key) => keys.includes(key))
  );
}

function readUuid(value: unknown): string {
  if (!isCanonicalRfc9562Uuid(value)) {
    return invalidRequest();
  }

  return value;
}

function readListPayload(value: unknown): { page: number; pageSize: number } {
  if (!isExactRecord(value) || !hasExactKeys(value, ["page", "pageSize"])) {
    return invalidRequest();
  }

  const { page, pageSize } = value;
  if (
    typeof page !== "number" ||
    typeof pageSize !== "number" ||
    !Number.isInteger(page) ||
    !Number.isInteger(pageSize) ||
    page < 1 ||
    page > 100 ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    return invalidRequest();
  }

  return { page, pageSize };
}

function readMutationPayload(value: unknown): { email: string } {
  if (!isExactRecord(value) || !hasExactKeys(value, ["email"])) {
    return invalidRequest();
  }

  return { email: normalizeAdminEmail(value.email) };
}

export function parseCentralUserRpcRequest(
  value: unknown,
): CentralUserRpcRequest {
  if (!isExactRecord(value) || !hasExactKeys(value, REQUEST_KEYS)) {
    return invalidRequest();
  }

  const { protocolVersion, tenantId, operationId, actorUid, action, payload } =
    value;
  if (protocolVersion !== 1 || typeof action !== "string") {
    return invalidRequest();
  }

  const requestIds = {
    tenantId: readUuid(tenantId),
    operationId: readUuid(operationId),
    actorUid: readUuid(actorUid),
  };

  if (action === "list_users") {
    return {
      protocolVersion,
      ...requestIds,
      action,
      payload: readListPayload(payload),
    };
  }

  if (MUTATION_ACTIONS.has(action as Exclude<CentralUserAction, "list_users">)) {
    return {
      protocolVersion,
      ...requestIds,
      action: action as Exclude<CentralUserAction, "list_users">,
      payload: readMutationPayload(payload),
    };
  }

  return invalidRequest();
}

export function canonicalCentralUserRpcText(
  request: CentralUserRpcRequest,
): string {
  const payload =
    request.action === "list_users"
      ? `${request.payload.page}\n${request.payload.pageSize}`
      : request.payload.email;

  return `1\n${request.tenantId}\n${request.operationId}\n${request.actorUid}\n${request.action}\n${payload}`;
}

function toLowercaseHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function hashCentralUserRpcRequest(
  request: CentralUserRpcRequest,
  crypto: Pick<Crypto, "subtle"> = globalThis.crypto,
): Promise<string> {
  const text = canonicalCentralUserRpcText(request);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));

  return toLowercaseHex(new Uint8Array(digest));
}
