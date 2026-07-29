import "server-only";

import {
  isAuthApiError,
  isAuthSessionMissingError,
  isAuthWeakPasswordError,
} from "@supabase/supabase-js";

import { normalizeAdminEmail } from "./email";
import type { CentralUserManagerAdminClient } from "./operation-repository";

const REQUIRED_LEASE_MARGIN_MS = 5_000;
const DEFAULT_LOOKUP_MAX_PAGES = 100;
const LOOKUP_PAGE_SIZE = 100;

const PROVIDER_ERRORS = {
  provider_unavailable: {
    code: "provider_unavailable",
    message: "Supabase Auth is unavailable.",
  },
  provider_timeout: {
    code: "provider_timeout",
    message: "Supabase Auth operation timed out.",
  },
  provider_rejected: {
    code: "provider_rejected",
    message: "Supabase Auth rejected the operation.",
  },
  provider_identity_mismatch: {
    code: "provider_identity_mismatch",
    message: "Supabase Auth identity did not match.",
  },
  provider_pagination_limit: {
    code: "provider_pagination_limit",
    message: "Supabase Auth pagination limit was reached.",
  },
} as const;

export interface ProviderUser {
  id: string;
  email: string;
  createdAt: string;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  bannedUntil: string | null;
  appMetadata: Record<string, unknown>;
}

export type ProviderErrorCode = keyof typeof PROVIDER_ERRORS;

export type ProviderResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: ProviderErrorCode; message: string };
      ambiguous: boolean;
    };

export interface ProviderDeadlineControls {
  timeoutMs: number;
  leaseExpiresAt: string;
  now?: () => number;
}

export interface AuthProviderDependencies {
  client: CentralUserManagerAdminClient;
  createTransientClient: () => CentralUserManagerAdminClient;
  deadline: ProviderDeadlineControls;
}

interface ListAuthUsersPageInput {
  page: number;
  pageSize: number;
}

interface ListAuthUsersRangeInput {
  offset: number;
  limit: number;
}

interface FindAuthUserByNormalizedEmailInput {
  email: string;
  maxPages?: number;
}

type FindAuthUsersByNormalizedEmailInput =
  FindAuthUserByNormalizedEmailInput;

interface CreateManagedAuthUserInput {
  email: string;
  password: string;
  operationId: string;
}

interface UpdateManagedAuthUserInput {
  user: ProviderUser;
  password?: string;
  credentialVersion: number;
  banDuration?: "876000h" | "none";
}

interface TransientlyVerifyPasswordInput {
  email: string;
  password: string;
  expectedUserId: string;
}

interface GloballySignOutAccessTokenInput {
  accessToken: string;
}

interface DeleteManagedAuthUserInput {
  userId: string;
}

type ProviderFailure = Extract<ProviderResult<never>, { ok: false }>;

function providerFailure(
  code: ProviderErrorCode,
  ambiguous: boolean,
): ProviderFailure {
  return {
    ok: false,
    error: { ...PROVIDER_ERRORS[code] },
    ambiguous,
  };
}

interface DefiniteCustomAuthErrorAllowlist {
  weakPassword?: true;
  sessionMissing?: true;
}

function classifyReturnedAuthError(
  error: unknown,
  allowlist: DefiniteCustomAuthErrorAllowlist = {},
): ProviderFailure {
  if (
    (isAuthApiError(error) &&
      error.status >= 400 &&
      error.status < 500) ||
    (allowlist.weakPassword === true &&
      isAuthWeakPasswordError(error) &&
      error.status >= 400 &&
      error.status < 500) ||
    (allowlist.sessionMissing === true &&
      isAuthSessionMissingError(error))
  ) {
    return providerFailure("provider_rejected", false);
  }

  return providerFailure("provider_unavailable", true);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toProviderUser(value: unknown): ProviderUser | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    email: typeof value.email === "string" ? value.email : "",
    createdAt: value.created_at,
    emailConfirmedAt: nullableString(value.email_confirmed_at),
    lastSignInAt: nullableString(value.last_sign_in_at),
    bannedUntil: nullableString(value.banned_until),
    appMetadata: isRecord(value.app_metadata)
      ? { ...value.app_metadata }
      : {},
  };
}

function hasSafeDeadline(deps: AuthProviderDependencies): boolean {
  const { timeoutMs, leaseExpiresAt, now = Date.now } = deps.deadline;
  const leaseExpiresAtMs = Date.parse(leaseExpiresAt);
  const currentTimeMs = now();

  return (
    Number.isSafeInteger(timeoutMs) &&
    timeoutMs > 0 &&
    Number.isFinite(leaseExpiresAtMs) &&
    Number.isFinite(currentTimeMs) &&
    timeoutMs + REQUIRED_LEASE_MARGIN_MS <
      leaseExpiresAtMs - currentTimeMs
  );
}

async function dispatchWithDeadline<T>(
  operation: () => Promise<T>,
  deps: AuthProviderDependencies,
): Promise<ProviderResult<T>> {
  if (!hasSafeDeadline(deps)) {
    return providerFailure("provider_timeout", false);
  }

  let operationPromise: Promise<T>;

  try {
    operationPromise = operation();
  } catch {
    return providerFailure("provider_unavailable", false);
  }

  const completed = operationPromise.then(
    (data) => ({ status: "completed" as const, data }),
    () => ({ status: "rejected" as const }),
  );
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ status: "timeout" }>((resolve) => {
    timeoutId = setTimeout(
      () => resolve({ status: "timeout" }),
      deps.deadline.timeoutMs,
    );
  });
  const outcome = await Promise.race([completed, timeout]);

  if (timeoutId !== undefined) {
    clearTimeout(timeoutId);
  }

  if (outcome.status === "timeout") {
    return providerFailure("provider_timeout", true);
  }

  if (outcome.status === "rejected") {
    return providerFailure("provider_unavailable", true);
  }

  return { ok: true, data: outcome.data };
}

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isNormalizedEmailMatch(email: string, normalizedEmail: string) {
  try {
    return normalizeAdminEmail(email) === normalizedEmail;
  } catch {
    return false;
  }
}

function isExactUpdatedManagedUser(
  returnedUser: ProviderUser,
  input: UpdateManagedAuthUserInput,
  deps: AuthProviderDependencies,
): boolean {
  const expectedProvenance =
    input.user.appMetadata.bpv_created_operation_id;
  const returnedProvenance =
    returnedUser.appMetadata.bpv_created_operation_id;
  const banMatches =
    input.banDuration === undefined ||
    (input.banDuration === "none" && returnedUser.bannedUntil === null) ||
    (input.banDuration === "876000h" &&
      returnedUser.bannedUntil !== null &&
      Date.parse(returnedUser.bannedUntil) >
        (deps.deadline.now ?? Date.now)());

  return (
    returnedUser.id === input.user.id &&
    isNormalizedEmailMatch(returnedUser.email, input.user.email) &&
    returnedUser.appMetadata.bpv_admin_managed === true &&
    returnedUser.appMetadata.credential_version ===
      input.credentialVersion &&
    returnedProvenance === expectedProvenance &&
    banMatches
  );
}

function isExactCreatedManagedUser(
  user: ProviderUser,
  input: CreateManagedAuthUserInput,
): boolean {
  return (
    isNormalizedEmailMatch(user.email, input.email) &&
    user.emailConfirmedAt !== null &&
    user.appMetadata.bpv_admin_managed === true &&
    user.appMetadata.credential_version === 1 &&
    user.appMetadata.bpv_created_operation_id === input.operationId
  );
}

export async function listAuthUsersPage(
  input: ListAuthUsersPageInput,
  deps: AuthProviderDependencies,
): Promise<
  ProviderResult<{
    users: ProviderUser[];
    hasMore: boolean;
  }>
> {
  if (
    !isPositiveInteger(input.page) ||
    !isPositiveInteger(input.pageSize) ||
    input.pageSize > 100
  ) {
    return providerFailure("provider_rejected", false);
  }

  const dispatched = await dispatchWithDeadline(
    () =>
      deps.client.auth.admin.listUsers({
        page: input.page,
        perPage: input.pageSize,
      }),
    deps,
  );

  if (!dispatched.ok) {
    return dispatched;
  }

  const response = dispatched.data;

  if (response.error || !response.data || !Array.isArray(response.data.users)) {
    return providerFailure("provider_rejected", false);
  }

  const users: ProviderUser[] = [];

  for (const rawUser of response.data.users) {
    const user = toProviderUser(rawUser);

    if (!user) {
      return providerFailure("provider_rejected", false);
    }

    users.push(user);
  }

  return {
    ok: true,
    data: {
      users,
      hasMore: typeof response.data.nextPage === "number",
    },
  };
}

export async function listAuthUsersRange(
  input: ListAuthUsersRangeInput,
  deps: AuthProviderDependencies,
): Promise<
  ProviderResult<{
    users: ProviderUser[];
    hasMore: boolean;
  }>
> {
  if (
    !Number.isSafeInteger(input.offset) ||
    input.offset < 0 ||
    !isPositiveInteger(input.limit) ||
    input.limit > 100
  ) {
    return providerFailure("provider_rejected", false);
  }

  const firstPage = Math.floor(input.offset / 100) + 1;
  const withinFirstPage = input.offset % 100;
  const users: ProviderUser[] = [];
  let page = firstPage;
  let skip = withinFirstPage;
  let sourceHasMore = false;

  while (users.length <= input.limit) {
    const listed = await listAuthUsersPage(
      { page, pageSize: 100 },
      deps,
    );
    if (!listed.ok) {
      return listed;
    }

    users.push(...listed.data.users.slice(skip));
    sourceHasMore = listed.data.hasMore;
    if (
      users.length > input.limit ||
      !sourceHasMore ||
      listed.data.users.length < 100
    ) {
      break;
    }
    page += 1;
    skip = 0;
  }

  return {
    ok: true,
    data: {
      users: users.slice(0, input.limit),
      hasMore: users.length > input.limit || sourceHasMore,
    },
  };
}

export async function findAuthUserByNormalizedEmail(
  input: FindAuthUserByNormalizedEmailInput,
  deps: AuthProviderDependencies,
): Promise<ProviderResult<ProviderUser | null>> {
  const matches = await findAuthUsersByNormalizedEmail(input, deps);

  return matches.ok
    ? { ok: true, data: matches.data[0] ?? null }
    : matches;
}

export async function findAuthUsersByNormalizedEmail(
  input: FindAuthUsersByNormalizedEmailInput,
  deps: AuthProviderDependencies,
): Promise<ProviderResult<ProviderUser[]>> {
  let normalizedEmail: string;

  try {
    normalizedEmail = normalizeAdminEmail(input.email);
  } catch {
    return providerFailure("provider_rejected", false);
  }

  const maxPages = input.maxPages ?? DEFAULT_LOOKUP_MAX_PAGES;

  if (
    !isPositiveInteger(maxPages) ||
    maxPages > DEFAULT_LOOKUP_MAX_PAGES
  ) {
    return providerFailure("provider_rejected", false);
  }

  const collectedMatches: ProviderUser[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const listed = await listAuthUsersPage(
      { page, pageSize: LOOKUP_PAGE_SIZE },
      deps,
    );

    if (!listed.ok) {
      return listed;
    }

    const matches = listed.data.users.filter((user) =>
      isNormalizedEmailMatch(user.email, normalizedEmail),
    );
    collectedMatches.push(...matches.slice(0, 2 - collectedMatches.length));

    if (collectedMatches.length === 2) {
      return { ok: true, data: collectedMatches };
    }

    if (listed.data.users.length < LOOKUP_PAGE_SIZE) {
      return { ok: true, data: collectedMatches };
    }
  }

  return providerFailure("provider_pagination_limit", false);
}

export async function createManagedAuthUser(
  input: CreateManagedAuthUserInput,
  deps: AuthProviderDependencies,
): Promise<ProviderResult<ProviderUser>> {
  const dispatched = await dispatchWithDeadline(
    () =>
      deps.client.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        app_metadata: {
          credential_version: 1,
          bpv_admin_managed: true,
          bpv_created_operation_id: input.operationId,
        },
      }),
    deps,
  );

  if (!dispatched.ok) {
    return dispatched;
  }

  if (dispatched.data.error) {
    return classifyReturnedAuthError(dispatched.data.error, {
      weakPassword: true,
    });
  }

  const user = toProviderUser(dispatched.data.data.user);

  return user && isExactCreatedManagedUser(user, input)
    ? { ok: true, data: user }
    : providerFailure("provider_identity_mismatch", false);
}

export async function updateManagedAuthUser(
  input: UpdateManagedAuthUserInput,
  deps: AuthProviderDependencies,
): Promise<ProviderResult<ProviderUser>> {
  if (!isPositiveInteger(input.credentialVersion)) {
    return providerFailure("provider_rejected", false);
  }

  const appMetadata: Record<string, unknown> = {
    ...input.user.appMetadata,
    credential_version: input.credentialVersion,
    bpv_admin_managed: true,
  };
  const attributes: {
    app_metadata: Record<string, unknown>;
    password?: string;
    ban_duration?: "876000h" | "none";
  } = { app_metadata: appMetadata };

  if (input.password !== undefined) {
    attributes.password = input.password;
  }

  if (input.banDuration !== undefined) {
    attributes.ban_duration = input.banDuration;
  }

  const dispatched = await dispatchWithDeadline(
    () =>
      deps.client.auth.admin.updateUserById(input.user.id, attributes),
    deps,
  );

  if (!dispatched.ok) {
    return dispatched;
  }

  if (dispatched.data.error) {
    return classifyReturnedAuthError(dispatched.data.error, {
      weakPassword: true,
    });
  }

  const user = toProviderUser(dispatched.data.data.user);

  return user && isExactUpdatedManagedUser(user, input, deps)
    ? { ok: true, data: user }
    : providerFailure("provider_identity_mismatch", false);
}

export async function transientlyVerifyPassword(
  input: TransientlyVerifyPasswordInput,
  deps: AuthProviderDependencies,
): Promise<ProviderResult<{ accessToken: string }>> {
  let transientClient: CentralUserManagerAdminClient;

  try {
    transientClient = deps.createTransientClient();
  } catch {
    return providerFailure("provider_unavailable", false);
  }

  const dispatched = await dispatchWithDeadline(
    () =>
      transientClient.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      }),
    deps,
  );

  if (!dispatched.ok) {
    return dispatched;
  }

  const response = dispatched.data;
  const accessToken = response.data?.session?.access_token;

  if (response.error) {
    return classifyReturnedAuthError(response.error);
  }

  if (
    !response.data.user ||
    response.data.user.id !== input.expectedUserId ||
    !response.data.session ||
    response.data.session.user.id !== input.expectedUserId ||
    typeof accessToken !== "string" ||
    accessToken.length === 0
  ) {
    return providerFailure("provider_identity_mismatch", false);
  }

  return { ok: true, data: { accessToken } };
}

export async function globallySignOutAccessToken(
  input: GloballySignOutAccessTokenInput,
  deps: AuthProviderDependencies,
): Promise<ProviderResult<null>> {
  const dispatched = await dispatchWithDeadline(
    () => deps.client.auth.admin.signOut(input.accessToken, "global"),
    deps,
  );

  if (!dispatched.ok) {
    return dispatched;
  }

  return dispatched.data.error
    ? classifyReturnedAuthError(dispatched.data.error, {
        sessionMissing: true,
      })
    : { ok: true, data: null };
}

export async function deleteManagedAuthUser(
  input: DeleteManagedAuthUserInput,
  deps: AuthProviderDependencies,
): Promise<ProviderResult<null>> {
  const dispatched = await dispatchWithDeadline(
    () => deps.client.auth.admin.deleteUser(input.userId, false),
    deps,
  );

  if (!dispatched.ok) {
    return dispatched;
  }

  return dispatched.data.error
    ? classifyReturnedAuthError(dispatched.data.error)
    : { ok: true, data: null };
}
