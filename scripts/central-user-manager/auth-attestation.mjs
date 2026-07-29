import { createHash } from "node:crypto";

/** @type {"v1"} */
const ATTESTATION_VERSION = "v1";
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const REQUIRED_KEYS = new Set([
  "version",
  "projectRef",
  "checkedAt",
  "disableSignup",
  "anonymousSignInsEnabled",
  "passwordMinLength",
  "passwordRequiredCharacters",
]);
const MAX_PASSWORD_MIN_LENGTH = 128;
const MAX_REQUIRED_CHARACTERS_LENGTH = 256;
const INVALID_ATTESTATION =
  "Central User Manager Auth attestation is invalid.";

/** @returns {never} */
function invalidAttestation() {
  throw new Error(INVALID_ATTESTATION);
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isCanonicalUtcTimestamp(value) {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = new Date(value);
  return !Number.isNaN(timestamp.getTime()) && timestamp.toISOString() === value;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function hasExactKeys(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const keys = Reflect.ownKeys(value);
  return (
    keys.length === REQUIRED_KEYS.size &&
    keys.every(
      (key) => typeof key === "string" && REQUIRED_KEYS.has(key),
    )
  );
}

/**
 * Builds a deterministic digest from a previously read, non-secret hosted Auth
 * configuration. It deliberately accepts no credentials or provider errors.
 *
 * @param {unknown} input
 * @returns {{
 *   version: "v1",
 *   digest: string,
 *   checkedAt: string,
 *   values: {
 *     version: "v1",
 *     projectRef: string,
 *     checkedAt: string,
 *     disableSignup: true,
 *     anonymousSignInsEnabled: false,
 *     passwordMinLength: number,
 *     passwordRequiredCharacters: string
 *   }
 * }}
 */
function buildAttestation(input) {
  if (!hasExactKeys(input)) {
    return invalidAttestation();
  }

  const {
    version,
    projectRef,
    checkedAt,
    disableSignup,
    anonymousSignInsEnabled,
    passwordMinLength,
    passwordRequiredCharacters,
  } = input;

  if (
    version !== ATTESTATION_VERSION ||
    typeof projectRef !== "string" ||
    !PROJECT_REF_PATTERN.test(projectRef) ||
    !isCanonicalUtcTimestamp(checkedAt) ||
    disableSignup !== true ||
    anonymousSignInsEnabled !== false ||
    typeof passwordMinLength !== "number" ||
    !Number.isSafeInteger(passwordMinLength) ||
    passwordMinLength <= 0 ||
    passwordMinLength > MAX_PASSWORD_MIN_LENGTH ||
    typeof passwordRequiredCharacters !== "string" ||
    passwordRequiredCharacters.length > MAX_REQUIRED_CHARACTERS_LENGTH ||
    /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u.test(
      passwordRequiredCharacters,
    )
  ) {
    return invalidAttestation();
  }

  /** @type {{
   *   version: "v1",
   *   projectRef: string,
   *   checkedAt: string,
   *   disableSignup: true,
   *   anonymousSignInsEnabled: false,
   *   passwordMinLength: number,
   *   passwordRequiredCharacters: string
   * }} */
  const values = {
    version: ATTESTATION_VERSION,
    projectRef,
    checkedAt,
    disableSignup: true,
    anonymousSignInsEnabled: false,
    passwordMinLength,
    passwordRequiredCharacters,
  };
  const digest = createHash("sha256")
    .update(JSON.stringify(values), "utf8")
    .digest("hex");

  return {
    version: ATTESTATION_VERSION,
    digest,
    checkedAt,
    values,
  };
}

/**
 * @param {unknown} input
 * @returns {ReturnType<typeof buildAttestation>}
 */
export function buildCentralUserManagerAuthAttestation(input) {
  try {
    return buildAttestation(input);
  } catch {
    return invalidAttestation();
  }
}
