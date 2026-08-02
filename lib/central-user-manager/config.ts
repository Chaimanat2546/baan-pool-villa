import "server-only";

import { isCanonicalRfc9562Uuid } from "./canonical-uuid";

const CONFIGURATION_ERROR =
  "Central User Manager Agent configuration is invalid.";
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const MAX_SUPABASE_SECRET_KEY_LENGTH = 1024;

export interface CentralUserManagerAgentConfig {
  enabled: boolean;
  tenantId: string;
  projectRef: string;
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

function isSupabaseProjectOrigin(
  value: string | undefined,
  projectRef: string,
): value is string {
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
      url.pathname === "/" &&
      url.hostname === `${projectRef}.supabase.co`
    );
  } catch {
    return false;
  }
}

/** Reads the minimal server-only configuration for a Tenant RPC deployment. */
export function getCentralUserManagerAgentConfig(): CentralUserManagerAgentConfig {
  const enabled = readBoolean(process.env.CENTRAL_USER_MANAGER_AGENT_ENABLED);
  const tenantId = process.env.CENTRAL_USER_MANAGER_TENANT_ID;
  const projectRef = process.env.CENTRAL_USER_MANAGER_PROJECT_REF;
  const supabaseUrl = process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (
    !tenantId ||
    !isCanonicalRfc9562Uuid(tenantId) ||
    !projectRef ||
    !PROJECT_REF_PATTERN.test(projectRef) ||
    !isSupabaseProjectOrigin(supabaseUrl, projectRef) ||
    !supabaseSecretKey ||
    supabaseSecretKey.length > MAX_SUPABASE_SECRET_KEY_LENGTH ||
    !supabaseSecretKey.startsWith("sb_secret_")
  ) {
    return invalidConfiguration();
  }

  return {
    enabled,
    tenantId,
    projectRef,
    supabaseUrl,
    supabaseSecretKey,
  };
}
