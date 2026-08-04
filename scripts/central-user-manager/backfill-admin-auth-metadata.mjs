import { fileURLToPath } from "node:url";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import {
  resolveBackfillConfig,
  runAdminAuthMetadataBackfill,
} from "./backfill-lib.mjs";

/**
 * @param {{
 *   argv?: string[],
 *   env?: Record<string, string | undefined>,
 *   createClient?: (...args: any[]) => any,
 *   write?: (value: string) => void,
 *   clock?: () => Date,
 * }} [options]
 */
export async function runBackfillCli({
  argv = process.argv.slice(2),
  env = process.env,
  createClient = createSupabaseClient,
  write = (value) => console.log(value),
  clock,
} = {}) {
  const config = resolveBackfillConfig({ argv, env });
  let outcome;
  try {
    const client = createClient(
      config.supabaseUrl,
      config.supabaseSecretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    outcome = await runAdminAuthMetadataBackfill({
      client,
      mode: config.mode,
      projectRef: config.projectRef,
      supabaseUrl: config.supabaseUrl,
      ...(clock ? { clock } : {}),
    });
  } catch {
    outcome = {
      ok: false,
      report: {
        projectRef: config.projectRef,
        mode: config.mode,
        counts: {
          profiles: 0,
          authUsers: 0,
          matched: 0,
          updatesPlanned: 0,
          updated: 0,
          unchanged: 0,
          verified: 0,
          blocking: 1,
        },
        categories: { execution_failed: 1 },
        references: [],
        completedAt: (clock ?? (() => new Date()))().toISOString(),
      },
    };
  }

  write(JSON.stringify(outcome.report));
  return outcome.ok ? 0 : 1;
}

async function main() {
  try {
    process.exitCode = await runBackfillCli();
  } catch {
    console.error("Central User Manager backfill failed.");
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  void main();
}
