import "server-only";

import { normalizeAdminEmail } from "./email";
import type { CentralUserManagerAdminClient } from "./operation-repository";
import {
  createSafeAgentError,
  SAFE_AGENT_ERROR_CATALOG,
  type SafeAgentError,
  type SafeAgentErrorCode,
} from "./safe-errors";

const PROFILE_PROJECTION =
  "user_id,email,role,is_active,must_change_password,credential_version,created_at";
const MAPPED_PROFILE_ERRORS = new Set<SafeAgentErrorCode>([
  "operation_conflict",
  "operation_quarantined",
  "lease_lost",
  "profile_data_invalid",
  "profile_state_conflict",
  "profile_write_failed",
  "credential_version_mismatch",
]);

export interface CentralAdminProfile {
  userId: string;
  email: string;
  role: "admin";
  isActive: boolean;
  mustChangePassword: boolean;
  credentialVersion: number;
  createdAt: string;
}

export type ProfileRepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SafeAgentError };

export interface ProfileRepositoryDependencies {
  client: CentralUserManagerAdminClient;
  crypto?: Pick<Crypto, "subtle">;
}

interface OperationLeaseInput {
  operationId: string;
  fenceVersion: number;
  leaseToken: string;
  userId: string;
  email: string;
}

interface AdvanceAdminProfileInput extends OperationLeaseInput {
  expectedIsActive: boolean;
  expectedMustChangePassword: boolean;
  expectedCredentialVersion: number;
  nextIsActive: boolean;
  nextMustChangePassword: boolean;
  nextCredentialVersion: number;
}

interface ActivateAdminProfileInput extends OperationLeaseInput {
  credentialVersion: number;
}

function failure<T>(code: SafeAgentErrorCode): ProfileRepositoryResult<T> {
  return {
    ok: false,
    error: createSafeAgentError(SAFE_AGENT_ERROR_CATALOG[code]),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapProfile(value: unknown): CentralAdminProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    user_id: userId,
    email,
    role,
    is_active: isActive,
    must_change_password: mustChangePassword,
    credential_version: credentialVersion,
    created_at: createdAt,
  } = value;

  if (
    typeof userId !== "string" ||
    typeof email !== "string" ||
    normalizeAdminEmail(email) !== email ||
    role !== "admin" ||
    typeof isActive !== "boolean" ||
    typeof mustChangePassword !== "boolean" ||
    !Number.isSafeInteger(credentialVersion) ||
    (credentialVersion as number) <= 0 ||
    typeof createdAt !== "string" ||
    !Number.isFinite(Date.parse(createdAt))
  ) {
    return null;
  }

  return {
    userId,
    email,
    role,
    isActive,
    mustChangePassword,
    credentialVersion: credentialVersion as number,
    createdAt,
  };
}

function mapProfiles(values: unknown): CentralAdminProfile[] | null {
  if (!Array.isArray(values)) {
    return null;
  }

  const profiles = values.map(mapProfile);
  return profiles.every(
    (profile): profile is CentralAdminProfile => profile !== null,
  )
    ? profiles
    : null;
}

function mapDatabaseError<T>(error: unknown): ProfileRepositoryResult<T> {
  const rawCode =
    isRecord(error) && typeof error.message === "string"
      ? error.message
      : undefined;
  const code =
    rawCode && MAPPED_PROFILE_ERRORS.has(rawCode as SafeAgentErrorCode)
      ? (rawCode as SafeAgentErrorCode)
      : "database_unavailable";

  return failure(code);
}

async function hashLeaseToken(
  leaseToken: string,
  deps: ProfileRepositoryDependencies,
): Promise<string> {
  const digest = await (deps.crypto ?? globalThis.crypto).subtle.digest(
    "SHA-256",
    new TextEncoder().encode(leaseToken),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function callRpc(
  name: string,
  params: Record<string, unknown>,
  deps: ProfileRepositoryDependencies,
): Promise<ProfileRepositoryResult<CentralAdminProfile>> {
  let response: { data: unknown; error: unknown };

  try {
    response = await deps.client.rpc(name, params);
  } catch {
    return failure("database_unavailable");
  }

  if (response.error) {
    return mapDatabaseError(response.error);
  }

  const profile = mapProfile(response.data);
  return profile
    ? { ok: true, data: profile }
    : failure("profile_data_invalid");
}

export async function listAdminProfilesPage(
  input: { page: number; pageSize: number },
  deps: ProfileRepositoryDependencies,
): Promise<
  ProfileRepositoryResult<{
    profiles: CentralAdminProfile[];
    hasMore: boolean;
  }>
> {
  if (
    !Number.isSafeInteger(input.page) ||
    input.page < 1 ||
    !Number.isSafeInteger(input.pageSize) ||
    input.pageSize < 1 ||
    input.pageSize > 100
  ) {
    return failure("profile_data_invalid");
  }

  const from = (input.page - 1) * input.pageSize;
  let response: { data: unknown; error: unknown };

  try {
    response = await deps.client
      .from("admin_users")
      .select(PROFILE_PROJECTION)
      .order("created_at", { ascending: true })
      .range(from, from + input.pageSize - 1);
  } catch {
    return failure("database_unavailable");
  }

  if (response.error) {
    return mapDatabaseError(response.error);
  }

  const profiles = mapProfiles(response.data);
  return profiles
    ? {
        ok: true,
        data: {
          profiles,
          hasMore: profiles.length === input.pageSize,
        },
      }
    : failure("profile_data_invalid");
}

async function findProfiles(
  column: "email" | "user_id",
  value: string,
  deps: ProfileRepositoryDependencies,
): Promise<ProfileRepositoryResult<CentralAdminProfile[]>> {
  let response: { data: unknown; error: unknown };

  try {
    response = await deps.client
      .from("admin_users")
      .select(PROFILE_PROJECTION)
      .eq(column, value)
      .limit(2);
  } catch {
    return failure("database_unavailable");
  }

  if (response.error) {
    return mapDatabaseError(response.error);
  }

  const profiles = mapProfiles(response.data);
  if (!profiles || profiles.length > 1) {
    return failure("profile_data_invalid");
  }

  return { ok: true, data: profiles };
}

export async function findAdminProfilesByNormalizedEmail(
  input: { email: string },
  deps: ProfileRepositoryDependencies,
): Promise<ProfileRepositoryResult<CentralAdminProfile[]>> {
  let email: string;

  try {
    email = normalizeAdminEmail(input.email);
  } catch {
    return failure("profile_data_invalid");
  }

  return findProfiles("email", email, deps);
}

export async function findAdminProfileByUserId(
  input: { userId: string },
  deps: ProfileRepositoryDependencies,
): Promise<ProfileRepositoryResult<CentralAdminProfile | null>> {
  const result = await findProfiles("user_id", input.userId, deps);

  return result.ok
    ? { ok: true, data: result.data[0] ?? null }
    : result;
}

export async function createAdminProfileForOperation(
  input: OperationLeaseInput,
  deps: ProfileRepositoryDependencies,
): Promise<ProfileRepositoryResult<CentralAdminProfile>> {
  try {
    return callRpc(
      "create_admin_user_profile_for_operation",
      {
        p_operation_id: input.operationId,
        p_fence_version: input.fenceVersion,
        p_lease_token_hash: await hashLeaseToken(input.leaseToken, deps),
        p_user_id: input.userId,
        p_email_normalized: normalizeAdminEmail(input.email),
      },
      deps,
    );
  } catch {
    return failure("profile_data_invalid");
  }
}

export async function advanceAdminProfileForOperation(
  input: AdvanceAdminProfileInput,
  deps: ProfileRepositoryDependencies,
): Promise<ProfileRepositoryResult<CentralAdminProfile>> {
  try {
    return callRpc(
      "advance_admin_user_profile_for_operation",
      {
        p_operation_id: input.operationId,
        p_fence_version: input.fenceVersion,
        p_lease_token_hash: await hashLeaseToken(input.leaseToken, deps),
        p_user_id: input.userId,
        p_email_normalized: normalizeAdminEmail(input.email),
        p_expected_is_active: input.expectedIsActive,
        p_expected_must_change_password: input.expectedMustChangePassword,
        p_expected_credential_version: input.expectedCredentialVersion,
        p_next_is_active: input.nextIsActive,
        p_next_must_change_password: input.nextMustChangePassword,
        p_next_credential_version: input.nextCredentialVersion,
      },
      deps,
    );
  } catch {
    return failure("profile_data_invalid");
  }
}

export async function activateAdminProfileForOperation(
  input: ActivateAdminProfileInput,
  deps: ProfileRepositoryDependencies,
): Promise<ProfileRepositoryResult<CentralAdminProfile>> {
  try {
    return callRpc(
      "activate_admin_user_profile_for_operation",
      {
        p_operation_id: input.operationId,
        p_fence_version: input.fenceVersion,
        p_lease_token_hash: await hashLeaseToken(input.leaseToken, deps),
        p_user_id: input.userId,
        p_email_normalized: normalizeAdminEmail(input.email),
        p_credential_version: input.credentialVersion,
      },
      deps,
    );
  } catch {
    return failure("profile_data_invalid");
  }
}
