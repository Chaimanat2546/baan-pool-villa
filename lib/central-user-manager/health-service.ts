import "server-only";

import type { CentralUserManagerAgentConfig } from "./config";
import type { CentralUserManagerAdminClient } from "./operation-repository";

const HEALTH_PROBE_KEYS = [
  "database",
  "adminUsersTable",
  "operationTables",
] as const;
const HEALTH_ERROR = {
  code: "health_unavailable",
  message: "Central User Manager health checks failed.",
} as const;

interface HealthProbe {
  database: true;
  adminUsersTable: true;
  operationTables: true;
}

export interface CentralUserManagerHealthData {
  tenantId: string;
  protocolVersion: 1;
  tokenVersion: number;
  projectRef: string;
  agentVersion: string;
  schemaVersion: string;
  checks: {
    database: "ok";
    adminUsersTable: "ok";
    operationTables: "ok";
  };
  authAttestation: {
    version: string;
    digest: string;
    checkedAt: string;
  };
}

export type CentralUserManagerHealthResult =
  | { ok: true; data: CentralUserManagerHealthData }
  | { ok: false; error: typeof HEALTH_ERROR };

function failure(): { ok: false; error: typeof HEALTH_ERROR } {
  return { ok: false, error: { ...HEALTH_ERROR } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExactHealthyProbe(value: unknown): value is HealthProbe {
  if (!isRecord(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return (
    keys.length === HEALTH_PROBE_KEYS.length &&
    keys.every((key) => HEALTH_PROBE_KEYS.includes(
      key as (typeof HEALTH_PROBE_KEYS)[number],
    )) &&
    value.database === true &&
    value.adminUsersTable === true &&
    value.operationTables === true
  );
}

export function isCentralUserManagerHealthData(
  value: unknown,
): value is CentralUserManagerHealthData {
  if (!isRecord(value) || !isRecord(value.checks) || !isRecord(value.authAttestation)) {
    return false;
  }

  return (
    Object.keys(value).length === 8 &&
    value.protocolVersion === 1 &&
    typeof value.tenantId === "string" &&
    Number.isSafeInteger(value.tokenVersion) &&
    (value.tokenVersion as number) > 0 &&
    typeof value.projectRef === "string" &&
    typeof value.agentVersion === "string" &&
    typeof value.schemaVersion === "string" &&
    Object.keys(value.checks).length === 3 &&
    value.checks.database === "ok" &&
    value.checks.adminUsersTable === "ok" &&
    value.checks.operationTables === "ok" &&
    Object.keys(value.authAttestation).length === 3 &&
    typeof value.authAttestation.version === "string" &&
    typeof value.authAttestation.digest === "string" &&
    typeof value.authAttestation.checkedAt === "string"
  );
}

export async function probeCentralUserManagerHealth(
  client: CentralUserManagerAdminClient,
): Promise<
  { ok: true; data: HealthProbe } | { ok: false; error: typeof HEALTH_ERROR }
> {
  let response: { data: unknown; error: unknown };
  try {
    response = await client.rpc("central_user_manager_health_probe_v1", {});
  } catch {
    return failure();
  }

  if (response.error || !isExactHealthyProbe(response.data)) {
    return failure();
  }

  return { ok: true, data: response.data };
}

export async function getCentralUserManagerHealth(
  config: CentralUserManagerAgentConfig,
  tokenVersion: number,
  client: CentralUserManagerAdminClient,
): Promise<CentralUserManagerHealthResult> {
  if (tokenVersion !== config.tokenVersion) {
    return failure();
  }
  const probe = await probeCentralUserManagerHealth(client);
  if (!probe.ok) {
    return probe;
  }

  return {
    ok: true,
    data: {
      tenantId: config.tenantId,
      protocolVersion: 1,
      tokenVersion,
      projectRef: config.projectRef,
      agentVersion: config.agentVersion,
      schemaVersion: config.schemaVersion,
      checks: {
        database: "ok",
        adminUsersTable: "ok",
        operationTables: "ok",
      },
      authAttestation: {
        version: config.authAttestation.version,
        digest: config.authAttestation.digest,
        checkedAt: config.authAttestation.checkedAt,
      },
    },
  };
}
