import "server-only";

import { isCanonicalCentralBearerToken } from "./bearer-auth";

const CONFIGURATION_ERROR =
  "Central User Manager Agent configuration is invalid.";
const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const ATTESTATION_DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;
const MAX_VERSION_LENGTH = 64;
const MAX_SUPABASE_SECRET_KEY_LENGTH = 1024;

export interface CentralUserManagerAgentConfig {
  enabled: boolean;
  credentialFenceEnabled: boolean;
  tenantId: string;
  projectRef: string;
  agentVersion: string;
  schemaVersion: string;
  tokenVersion: number;
  bearerToken: string;
  authAttestation: {
    version: string;
    digest: string;
    checkedAt: string;
  };
  supabaseUrl: string;
  supabaseSecretKey: string;
}

function invalidConfiguration(): never {
  throw new Error(CONFIGURATION_ERROR);
}

function readBoolean(value: string | undefined): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return invalidConfiguration();
}

function readVersion(value: string | undefined): string {
  if (
    !value ||
    value.length > MAX_VERSION_LENGTH ||
    !VERSION_PATTERN.test(value)
  ) {
    return invalidConfiguration();
  }

  return value;
}

function readTokenVersion(value: string | undefined): number {
  if (!value || !POSITIVE_INTEGER_PATTERN.test(value)) {
    return invalidConfiguration();
  }

  const tokenVersion = Number(value);

  if (!Number.isSafeInteger(tokenVersion) || tokenVersion <= 0) {
    return invalidConfiguration();
  }

  return tokenVersion;
}

function isCanonicalUtcTimestamp(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value);

  return !Number.isNaN(timestamp.getTime()) && timestamp.toISOString() === value;
}

function isHttpsOrigin(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/"
    );
  } catch {
    return false;
  }
}

/**
 * Reads and validates the server-only configuration for a Central User
 * Manager Agent deployment.
 *
 * @throws {Error} When any required Agent configuration is invalid.
 */
export function getCentralUserManagerAgentConfig(): CentralUserManagerAgentConfig {
  const enabled = readBoolean(process.env.CENTRAL_USER_MANAGER_AGENT_ENABLED);
  const credentialFenceEnabled = readBoolean(
    process.env.CENTRAL_USER_MANAGER_CREDENTIAL_FENCE_ENABLED,
  );
  const tenantId = process.env.CENTRAL_USER_MANAGER_TENANT_ID;
  const projectRef = process.env.CENTRAL_USER_MANAGER_PROJECT_REF;
  const bearerToken = process.env.CENTRAL_USER_MANAGER_BEARER_TOKEN;
  const attestationDigest =
    process.env.CENTRAL_USER_MANAGER_AUTH_ATTESTATION_DIGEST;
  const attestationCheckedAt =
    process.env.CENTRAL_USER_MANAGER_AUTH_ATTESTATION_CHECKED_AT;
  const supabaseUrl = process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (
    !tenantId ||
    !CANONICAL_UUID_PATTERN.test(tenantId) ||
    !projectRef ||
    !PROJECT_REF_PATTERN.test(projectRef) ||
    !bearerToken ||
    !isCanonicalCentralBearerToken(bearerToken) ||
    !attestationDigest ||
    !ATTESTATION_DIGEST_PATTERN.test(attestationDigest) ||
    !isCanonicalUtcTimestamp(attestationCheckedAt) ||
    !isHttpsOrigin(supabaseUrl) ||
    !supabaseSecretKey ||
    supabaseSecretKey.length > MAX_SUPABASE_SECRET_KEY_LENGTH ||
    !supabaseSecretKey.startsWith("sb_secret_")
  ) {
    return invalidConfiguration();
  }

  return {
    enabled,
    credentialFenceEnabled,
    tenantId,
    projectRef,
    agentVersion: readVersion(process.env.CENTRAL_USER_MANAGER_AGENT_VERSION),
    schemaVersion: readVersion(
      process.env.CENTRAL_USER_MANAGER_SCHEMA_VERSION,
    ),
    tokenVersion: readTokenVersion(
      process.env.CENTRAL_USER_MANAGER_TOKEN_VERSION,
    ),
    bearerToken,
    authAttestation: {
      version: readVersion(
        process.env.CENTRAL_USER_MANAGER_AUTH_ATTESTATION_VERSION,
      ),
      digest: attestationDigest,
      checkedAt: attestationCheckedAt,
    },
    supabaseUrl,
    supabaseSecretKey,
  };
}
