export const MAX_SAFE_ERROR_CODE_LENGTH = 64;
export const MAX_SAFE_ERROR_MESSAGE_LENGTH = 240;

export interface SafeAgentError {
  code: string;
  message: string;
}

export const SAFE_AGENT_ERROR_CATALOG = {
  invalid_request: {
    code: "invalid_request",
    message: "Invalid agent operation request.",
  },
  provider_failure: {
    code: "provider_failure",
    message: "Unable to complete request.",
  },
  database_unavailable: {
    code: "database_unavailable",
    message: "The operation database is unavailable.",
  },
  operation_conflict: {
    code: "operation_conflict",
    message: "Operation conflicts with an existing request.",
  },
  lease_conflict: {
    code: "lease_conflict",
    message: "The operation lease is owned by another request.",
  },
  operation_quarantined: {
    code: "operation_quarantined",
    message: "The operation is permanently quarantined.",
  },
  provider_ambiguous: {
    code: "provider_ambiguous",
    message: "Provider outcome is ambiguous.",
  },
  lease_lost: {
    code: "lease_lost",
    message: "The operation lease was lost.",
  },
  user_exists: {
    code: "user_exists",
    message: "An admin user already exists for this email.",
  },
  identity_mismatch: {
    code: "identity_mismatch",
    message: "The Auth user and admin profile do not match.",
  },
  profile_write_failed: {
    code: "profile_write_failed",
    message: "Unable to update the admin profile.",
  },
  profile_data_invalid: {
    code: "profile_data_invalid",
    message: "Admin profile data is invalid.",
  },
  profile_state_conflict: {
    code: "profile_state_conflict",
    message: "Admin profile state changed.",
  },
  credential_version_mismatch: {
    code: "credential_version_mismatch",
    message: "Credential versions do not match.",
  },
  create_compensated: {
    code: "create_compensated",
    message: "User creation was rolled back safely.",
  },
} as const;

export type SafeAgentErrorCode = keyof typeof SAFE_AGENT_ERROR_CATALOG;

const SAFE_ERROR_BY_CODE = new Map<string, SafeAgentError>(
  Object.values(SAFE_AGENT_ERROR_CATALOG).map((error) => [error.code, error]),
);

export function createSafeAgentError(fallback: SafeAgentError): SafeAgentError {
  const knownError = SAFE_ERROR_BY_CODE.get(fallback.code);

  if (!knownError || knownError.message !== fallback.message) {
    throw new Error("Invalid safe agent error fallback.");
  }

  return { ...knownError };
}

export function normalizeSafeAgentError(
  _error: unknown,
  fallback: SafeAgentError,
): SafeAgentError {
  return createSafeAgentError(fallback);
}

export class AgentContractError extends Error {
  readonly code = "invalid_request";
  readonly status = 422;

  constructor() {
    const safeError = createSafeAgentError(
      SAFE_AGENT_ERROR_CATALOG.invalid_request,
    );
    super(safeError.message);
    this.name = "AgentContractError";
  }
}
