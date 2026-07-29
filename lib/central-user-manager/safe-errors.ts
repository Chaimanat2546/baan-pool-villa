export const MAX_SAFE_ERROR_CODE_LENGTH = 64;
export const MAX_SAFE_ERROR_MESSAGE_LENGTH = 240;

export interface SafeAgentError {
  code: string;
  message: string;
}

const SAFE_ERROR_CODE = /^[a-z0-9_]+$/;

function isSafeErrorCode(value: string) {
  return (
    value.length > 0 &&
    value.length <= MAX_SAFE_ERROR_CODE_LENGTH &&
    SAFE_ERROR_CODE.test(value)
  );
}

function isSafeErrorMessage(value: string) {
  return value.length > 0 && value.length <= MAX_SAFE_ERROR_MESSAGE_LENGTH;
}

export function createSafeAgentError(fallback: SafeAgentError): SafeAgentError {
  if (
    !isSafeErrorCode(fallback.code) ||
    !isSafeErrorMessage(fallback.message)
  ) {
    throw new Error("Invalid safe agent error fallback.");
  }

  return { code: fallback.code, message: fallback.message };
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

  constructor(message = "Invalid agent operation request.") {
    const safeError = createSafeAgentError({
      code: "invalid_request",
      message:
        isSafeErrorMessage(message)
          ? message
          : "Invalid agent operation request.",
    });
    super(safeError.message);
    this.name = "AgentContractError";
  }
}
