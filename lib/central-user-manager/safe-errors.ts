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
