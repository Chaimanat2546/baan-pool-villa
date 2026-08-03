import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { CentralUserManagerAgentConfig } from "./config";

/**
 * Creates a non-persistent, server-only Supabase client for privileged Agent
 * operations.
 */
export function createCentralUserManagerAdminClient(
  config: CentralUserManagerAgentConfig,
) {
  return createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "User-Agent": "baan-pool-villa-central-user-manager/1.0",
      },
    },
  });
}
