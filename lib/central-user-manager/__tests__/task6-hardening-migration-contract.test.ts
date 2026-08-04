import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDirectory).find((name) =>
  /^\d+_harden_central_user_operation_state_machines\.sql$/.test(name),
);

if (!migrationName) {
  throw new Error("Task 6 hardening migration is missing.");
}

const sql = readFileSync(join(migrationsDirectory, migrationName), "utf8");
const normalizedSql = sql.replace(/\s+/g, " ").trim().toLowerCase();

function expectSql(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("Task 6 hardened operation migration contract", () => {
  it("journals named provider steps and enforces the action transition graph", () => {
    expectSql(/create table public\.admin_user_provider_events/);
    expectSql(/primary key \(operation_id, provider_step\)/);
    expectSql(/unique \(operation_id, step_ordinal\)/);
    expectSql(/create or replace function private\.commit_admin_user_provider_intent_v2_impl/);
    expectSql(/v_expected_stage := 'profile_advanced'/);
    expectSql(/v_expected_stage := 'auth_update_succeeded'/);
    expectSql(/v_expected_stage := 'password_verify_succeeded'/);
    expectSql(/v_operation\.stage is distinct from v_expected_stage/);
    expectSql(/stage = p_provider_step \|\| '_intent'/);
    expectSql(/stage = p_provider_step \|\| '_rejected'/);
    expectSql(/stage = p_provider_step \|\| '_succeeded'/);
  });

  it("accepts only typed scalar outcomes and validates exact non-null proofs", () => {
    expectSql(/create or replace function private\.commit_admin_user_provider_outcome_v2_impl/);
    expectSql(/p_target_user_id is null/);
    expectSql(/p_credential_version is null or p_credential_version <= 0/);
    expectSql(/v_operation\.target_user_id is distinct from p_target_user_id/);
    expectSql(/p_provider_step is distinct from v_event\.provider_step/);
    expectSql(/p_outcome is distinct from 'succeeded'/);
    expect(normalizedSql).not.toMatch(
      /commit_admin_user_provider_outcome_v2_impl\([^;]+p_safe_result jsonb/,
    );
    expectSql(/jsonb_build_object\( 'providerstep', p_provider_step, 'outcome', p_outcome, 'userid', p_target_user_id, 'credentialversion', p_credential_version \)/);
  });

  it("uses exact create, lifecycle, activation, compensation, and completion CAS", () => {
    expectSql(/create or replace function private\.create_admin_user_profile_for_operation_v2_impl/);
    expectSql(/v_operation\.stage is distinct from 'auth_create_succeeded'/);
    expectSql(/v_operation\.target_user_id is distinct from p_user_id/);
    expectSql(/create or replace function private\.prepare_admin_user_create_compensation_v2_impl/);
    expectSql(/not exists \( select 1 from public\.admin_users where user_id = p_user_id or email = p_email_normalized \)/);
    expectSql(/create or replace function private\.advance_admin_user_profile_for_operation_v2_impl/);
    expectSql(/p_next_credential_version is distinct from p_expected_credential_version \+ 1/);
    expectSql(/create or replace function private\.activate_admin_user_profile_for_operation_v2_impl/);
    expectSql(/v_operation\.stage is distinct from 'global_signout_succeeded'/);
    expectSql(/create or replace function private\.complete_admin_user_operation_v2_impl/);
    for (const stage of [
      "profile_created",
      "auth_delete_succeeded",
      "auth_update_succeeded",
      "global_signout_succeeded",
      "profile_activated",
    ]) {
      expectSql(new RegExp(`v_operation\\.stage is distinct from '${stage}'`));
    }
  });

  it("keeps a monotonic per-email tombstone and quarantines late mismatches without replacing lock ownership", () => {
    expectSql(/create table public\.admin_user_mutation_fences/);
    expectSql(/last_fence_version integer not null/);
    expectSql(/is_quarantined boolean not null default false/);
    expectSql(/last_fence_version = greatest\(/);
    expectSql(/set state = 'quarantined', quarantine_code = 'credential_version_mismatch'/);
    expect(normalizedSql).not.toMatch(
      /record_admin_user_late_fence_v2_impl[\s\S]+set operation_id =/,
    );
    expect(normalizedSql).not.toMatch(
      /record_admin_user_late_fence_v2_impl[\s\S]+set lease_token_hash =/,
    );
    expect(normalizedSql).not.toMatch(
      /record_admin_user_late_fence_v2_impl[\s\S]+set lease_expires_at =/,
    );
  });

  it("revokes legacy generic bypasses and exposes only fixed-path service-role v2 wrappers", () => {
    for (const legacy of [
      "claim_admin_user_operation",
      "commit_admin_user_operation_stage",
      "commit_admin_user_provider_stage",
      "complete_admin_user_operation",
    ]) {
      expectSql(
        new RegExp(
          `revoke execute on function public\\.${legacy}\\([^)]*\\) from service_role`,
        ),
      );
    }
    for (const name of [
      "resume_admin_user_operation_v2",
      "commit_admin_user_provider_intent_v2",
      "commit_admin_user_provider_outcome_v2",
      "complete_admin_user_operation_v2",
      "record_admin_user_late_fence_v2",
      "create_admin_user_profile_for_operation_v2",
      "prepare_admin_user_create_compensation_v2",
      "advance_admin_user_profile_for_operation_v2",
      "activate_admin_user_profile_for_operation_v2",
    ]) {
      expectSql(
        new RegExp(
          `create or replace function public\\.${name}\\([^;]+security definer set search_path = pg_catalog, public, private, extensions`,
        ),
      );
      expectSql(
        new RegExp(
          `grant execute on function public\\.${name}\\([^)]*\\) to service_role`,
        ),
      );
    }
  });
});
