import { normalizeAdminEmail } from "./email";
import { AgentContractError } from "./safe-errors";
import { isCanonicalRfc9562Uuid } from "./canonical-uuid";

export { AgentContractError } from "./safe-errors";

export type CentralUserAction =
  | "list_users"
  | "create_user"
  | "reissue_temporary_password"
  | "suspend_user"
  | "reactivate_user";

export type CentralUserPayload =
  | { page: number; pageSize: number }
  | { email: string };

export interface AgentOperationRequest {
  tenantId: string;
  operationId: string;
  actorUid: string;
  action: CentralUserAction;
  payload: CentralUserPayload;
}

export type AgentOperationStatus =
  | "completed"
  | "in_progress"
  | "needs_review"
  | "quarantined";

export type CentralAdminUserStatus =
  | "active"
  | "password_change_required"
  | "suspended"
  | "abnormal";

export interface CentralAdminUser {
  userId: string;
  email: string;
  status: CentralAdminUserStatus;
  createdAt: string | null;
  lastSignInAt: string | null;
  credentialVersion: number | null;
  authCredentialVersion: number | null;
}

export interface AgentOperationResponse {
  operationId: string;
  status: AgentOperationStatus;
  stage: string;
  result?: {
    users?: CentralAdminUser[];
    pagination?: { page: number; pageSize: number; hasMore: boolean };
    user?: CentralAdminUser;
    temporaryPassword?: string;
  };
  error?: { code: string; message: string };
}

const REQUEST_KEYS = [
  "tenantId",
  "operationId",
  "actorUid",
  "action",
  "payload",
] as const;
const MUTATION_ACTIONS = new Set<CentralUserAction>([
  "create_user",
  "reissue_temporary_password",
  "suspend_user",
  "reactivate_user",
]);

function invalidRequest(): never {
  throw new AgentContractError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  if (!isRecord(value) || !hasExactKeys(value, ["page", "pageSize"])) {
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
  if (!isRecord(value) || !hasExactKeys(value, ["email"])) {
    return invalidRequest();
  }

  return { email: normalizeAdminEmail(value.email) };
}

export function parseAgentOperationRequest(value: unknown): AgentOperationRequest {
  if (!isRecord(value) || !hasExactKeys(value, REQUEST_KEYS)) {
    return invalidRequest();
  }

  const { tenantId, operationId, actorUid, action, payload } = value;
  if (typeof action !== "string") {
    return invalidRequest();
  }

  const requestIds = {
    tenantId: readUuid(tenantId),
    operationId: readUuid(operationId),
    actorUid: readUuid(actorUid),
  };

  if (action === "list_users") {
    return { ...requestIds, action, payload: readListPayload(payload) };
  }

  if (MUTATION_ACTIONS.has(action as CentralUserAction)) {
    return {
      ...requestIds,
      action: action as CentralUserAction,
      payload: readMutationPayload(payload),
    };
  }

  return invalidRequest();
}
