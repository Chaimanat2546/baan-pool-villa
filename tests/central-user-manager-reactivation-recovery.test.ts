import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDirectory).find((name) =>
  /^\d+_repair_reactivation_provider_chain\.sql$/.test(name),
);

if (!migrationName) {
  throw new Error("Reactivation provider-chain repair migration is missing.");
}

const sql = readFileSync(join(migrationsDirectory, migrationName), "utf8");
const normalizedSql = sql.replace(/\s+/g, " ").trim().toLowerCase();

function expectSql(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("Central User Manager reactivation provider-chain repair", () => {
  it("starts the first provider step from leased and later steps from provider_outcome", () => {
    expectSql(
      /p_provider_step = 'auth_update'[\s\S]*v_expected_status := 'leased'/,
    );
    expectSql(
      /p_provider_step = 'password_verify'[\s\S]*v_expected_status := 'provider_outcome'/,
    );
    expectSql(
      /p_provider_step = 'global_signout'[\s\S]*v_expected_status := 'provider_outcome'/,
    );
    expectSql(
      /v_operation\.stage is distinct from v_expected_stage or v_operation\.status is distinct from v_expected_status/,
    );
  });

  it("recovers only expired reactivations with the exact durable Auth update proof", () => {
    for (const predicate of [
      /v_operation\.action is distinct from 'reactivate_user'/,
      /v_operation\.status is distinct from 'provider_outcome'/,
      /v_operation\.stage is distinct from 'auth_update_succeeded'/,
      /v_operation\.lease_expires_at > v_now/,
      /v_lock\.state is distinct from 'leased'/,
      /v_lock\.operation_id is distinct from v_operation\.operation_id/,
      /v_lock\.fence_version is distinct from v_operation\.fence_version/,
      /v_lock\.lease_token_hash is distinct from v_operation\.lease_token_hash/,
      /v_lock\.lease_expires_at > v_now/,
      /v_fence\.is_quarantined/,
      /v_fence\.last_fence_version is distinct from v_operation\.fence_version/,
      /v_event\.provider_step is distinct from 'auth_update'/,
      /v_event\.outcome is distinct from 'succeeded'/,
      /v_event\.target_user_id is distinct from v_operation\.target_user_id/,
      /v_event\.credential_version is distinct from v_credential_version/,
      /v_profile\.is_active/,
      /v_profile\.must_change_password is distinct from true/,
      /v_profile\.credential_version is distinct from v_credential_version/,
      /v_auth_managed is distinct from true/,
      /v_auth_credential_version is distinct from v_credential_version/,
      /v_auth_user\.banned_until is null/,
      /v_auth_user\.banned_until <= v_now/,
    ]) {
      expectSql(predicate);
    }

    expectSql(
      /begin v_auth_managed := \(v_auth_user\.raw_app_meta_data ->> 'bpv_admin_managed'\)::boolean; v_auth_credential_version := \(v_auth_user\.raw_app_meta_data ->> 'credential_version'\)::integer; exception when others then continue; end/,
    );
  });

  it("keeps the old operation non-successful and releases only its exact expired lock", () => {
    expectSql(
      /update public\.admin_user_operations set status = 'needs_review', stage = 'needs_review', safe_error_code = 'profile_state_conflict'/,
    );
    expectSql(/lease_token_hash = null, lease_expires_at = null/);
    expectSql(
      /delete from public\.admin_user_mutation_locks where target_email_normalized = v_operation\.target_email_normalized and operation_id = v_operation\.operation_id and fence_version = v_operation\.fence_version and lease_token_hash = v_operation\.lease_token_hash and state = 'leased' and lease_expires_at <= v_now/,
    );
    expect(normalizedSql).not.toMatch(
      /delete from public\.admin_user_operations/,
    );
    expect(normalizedSql).not.toMatch(
      /delete from public\.admin_user_provider_events/,
    );
    expect(normalizedSql).not.toMatch(/delete from public\.admin_users/);
    expect(normalizedSql).not.toMatch(/delete from auth\.users/);
  });

  it("keeps the replacement private and reloads the API schema", () => {
    expectSql(
      /revoke all on function private\.commit_admin_user_provider_intent_v2_impl\(\s*uuid, integer, text, text\s*\) from public, anon, authenticated, service_role/,
    );
    expectSql(/notify pgrst, 'reload schema'/);
  });
});
