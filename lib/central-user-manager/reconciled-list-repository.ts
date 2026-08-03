import "server-only";

import type { CentralAdminUser } from "./contracts";
import { normalizeAdminEmail } from "./email";
import type { CentralUserManagerAdminClient } from "./operation-repository";
import {
  createSafeAgentError,
  SAFE_AGENT_ERROR_CATALOG,
  type SafeAgentError,
} from "./safe-errors";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PAGE_KEYS = ["users", "hasMore"] as const;
const USER_KEYS = [
  "userId",
  "email",
  "status",
  "createdAt",
  "lastSignInAt",
  "credentialVersion",
  "authCredentialVersion",
] as const;
const USER_STATUSES = new Set<CentralAdminUser["status"]>([
  "active",
  "password_change_required",
  "suspended",
  "abnormal",
]);

export type ReconciledListRepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SafeAgentError };

export interface ReconciledListRepositoryDependencies {
  client: CentralUserManagerAdminClient;
}

export interface ReconciledAdminUserPage {
  users: CentralAdminUser[];
  hasMore: boolean;
}

function failure<T>(
  code: "database_unavailable" | "profile_data_invalid",
): ReconciledListRepositoryResult<T> {
  return {
    ok: false,
    error: createSafeAgentError(SAFE_AGENT_ERROR_CATALOG[code]),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value);
  return (
    actual.length === keys.length &&
    actual.every((key) => keys.includes(key))
  );
}

function isNullableTimestamp(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" && Number.isFinite(Date.parse(value)))
  );
}

function isNullablePositiveInteger(value: unknown): value is number | null {
  return (
    value === null ||
    (Number.isSafeInteger(value) && (value as number) > 0)
  );
}

function mapUser(value: unknown): CentralAdminUser | null {
  if (!isRecord(value) || !hasExactKeys(value, USER_KEYS)) {
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
    typeof userId !== "string" ||
    !UUID.test(userId) ||
    typeof email !== "string" ||
    normalizedEmail !== email ||
    typeof status !== "string" ||
    !USER_STATUSES.has(status as CentralAdminUser["status"]) ||
    !isNullableTimestamp(createdAt) ||
    createdAt === null ||
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

function mapPage(
  value: unknown,
  pageSize: number,
): ReconciledAdminUserPage | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, PAGE_KEYS) ||
    !Array.isArray(value.users) ||
    value.users.length > pageSize ||
    typeof value.hasMore !== "boolean"
  ) {
    return null;
  }

  const users = value.users.map(mapUser);
  return users.every((user): user is CentralAdminUser => user !== null)
    ? { users, hasMore: value.hasMore }
    : null;
}

export async function listReconciledAdminUsers(
  input: { page: number; pageSize: number },
  deps: ReconciledListRepositoryDependencies,
): Promise<ReconciledListRepositoryResult<ReconciledAdminUserPage>> {
  if (
    !Number.isSafeInteger(input.page) ||
    input.page < 1 ||
    input.page > 100 ||
    !Number.isSafeInteger(input.pageSize) ||
    input.pageSize < 1 ||
    input.pageSize > 100
  ) {
    return failure("profile_data_invalid");
  }

  let response: { data: unknown; error: unknown };
  try {
    response = await deps.client.rpc(
      "list_reconciled_admin_users_v1",
      {
        p_page: input.page,
        p_page_size: input.pageSize,
      },
    );
  } catch {
    return failure("database_unavailable");
  }

  if (response.error) {
    return failure("database_unavailable");
  }

  const page = mapPage(response.data, input.pageSize);
  return page
    ? { ok: true, data: page }
    : failure("profile_data_invalid");
}
