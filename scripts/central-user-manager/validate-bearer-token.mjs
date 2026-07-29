const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_BYTES = 32;
const INVALID_TOKEN = Object.freeze({
  valid: false,
  error: "Central User Manager Bearer token is invalid.",
});

/**
 * Validates a provisioning-time Central User Manager Bearer credential without
 * retaining or returning the credential.
 *
 * @param {unknown} token
 * @param {unknown} tokenVersion
 * @returns {{ valid: true, byteLength: 32, tokenVersion: number } | { valid: false, error: string }}
 */
export function validateCentralUserManagerBearerToken(token, tokenVersion) {
  if (
    typeof token !== "string" ||
    !TOKEN_PATTERN.test(token) ||
    typeof tokenVersion !== "number" ||
    !Number.isSafeInteger(tokenVersion) ||
    tokenVersion <= 0
  ) {
    return { ...INVALID_TOKEN };
  }

  const decoded = Buffer.from(token, "base64url");
  if (
    decoded.byteLength !== TOKEN_BYTES ||
    decoded.toString("base64url") !== token
  ) {
    return { ...INVALID_TOKEN };
  }

  return {
    valid: true,
    byteLength: TOKEN_BYTES,
    tokenVersion,
  };
}
