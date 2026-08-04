import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDirectory).find((name) =>
  /^\d+_add_central_user_operation_state_machines\.sql$/.test(name),
);

if (!migrationName) {
  throw new Error("Task 6 Central User Manager migration is missing.");
}

const sql = readFileSync(join(migrationsDirectory, migrationName), "utf8");
const normalizedSql = sql.replace(/\s+/g, " ").trim().toLowerCase();

function expectSql(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("Task 6 Central User Manager migration contract", () => {
  it("adds resumable same-operation claims and repeatable provider journaling", () => {
    expectSql(/create or replace function private\.resume_admin_user_operation_impl/);
    expectSql(/status = 'provider_intent'.+state = 'quarantined'/);
    expectSql(/status not in \('leased', 'provider_outcome'\)/);
    expectSql(/fence_version = fence_version \+ 1/);
    expectSql(/create or replace function private\.commit_admin_user_provider_stage_impl/);
    expectSql(/p_stage not in \('intent', 'outcome'\)/);
    expectSql(/p_provider_step not in \( 'auth_create', 'auth_delete', 'auth_update', 'password_verify', 'global_signout' \)/);
  });

  it("creates exact operation-bound profile create/advance/activate CAS helpers", () => {
    expectSql(/create or replace function private\.create_admin_user_profile_for_operation_impl/);
    expectSql(/insert into public\.admin_users.+p_user_id.+p_email_normalized.+true.+true.+1/);
    expectSql(/create or replace function private\.advance_admin_user_profile_for_operation_impl/);
    expectSql(/p_next_credential_version <> p_expected_credential_version \+ 1/);
    expectSql(/where user_id = p_user_id and email = p_email_normalized and is_active = p_expected_is_active and must_change_password = p_expected_must_change_password and credential_version = p_expected_credential_version/);
    expectSql(/create or replace function private\.activate_admin_user_profile_for_operation_impl/);
    expectSql(/where user_id = p_user_id and email = p_email_normalized and is_active = false and must_change_password = true and credential_version = p_credential_version/);
  });

  it("records needs-review and late lower fences without clearing a newer lock", () => {
    expectSql(/create or replace function private\.mark_admin_user_operation_needs_review_impl/);
    expectSql(/set state = 'quarantined'/);
    expectSql(/create or replace function private\.record_admin_user_late_fence_impl/);
    expectSql(/v_lock\.operation_id <> p_operation_id/);
    expectSql(/v_lock\.fence_version > p_fence_version/);
    expectSql(/v_lock\.operation_id = p_operation_id and v_lock\.fence_version > p_fence_version/);
    expectSql(/when v_preserve_newer_lease then lease_token_hash else null/);
    expectSql(/when v_preserve_newer_lease then lease_expires_at else null/);
    expect(normalizedSql).not.toMatch(
      /record_admin_user_late_fence_impl.+delete from public\.admin_user_mutation_locks/,
    );
  });

  it("takes each email advisory lock before the operation row lock", () => {
    expect(normalizedSql).not.toMatch(
      /select \* into (?:strict )?v_operation from public\.admin_user_operations where operation_id = p_operation_id for update; perform pg_advisory_xact_lock/,
    );
  });

  it("uses private fixed-search-path implementations and least-privilege public wrappers", () => {
    for (const name of [
      "resume_admin_user_operation",
      "commit_admin_user_provider_stage",
      "mark_admin_user_operation_needs_review",
      "record_admin_user_late_fence",
      "create_admin_user_profile_for_operation",
      "advance_admin_user_profile_for_operation",
      "activate_admin_user_profile_for_operation",
    ]) {
      expectSql(
        new RegExp(
          `create or replace function private\\.${name}_impl\\([^;]+security definer set search_path = pg_catalog, public, private, extensions`,
        ),
      );
      expectSql(
        new RegExp(
          `create or replace function public\\.${name}\\([^;]+security definer set search_path = pg_catalog, public, private, extensions[^;]+return private\\.${name}_impl\\(`,
        ),
      );
      expectSql(
        new RegExp(
          `revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated`,
        ),
      );
      expectSql(
        new RegExp(
          `grant execute on function public\\.${name}\\([^)]*\\) to service_role`,
        ),
      );
    }
    expect(normalizedSql).not.toMatch(
      /\b(?:insert\s+into|update|delete\s+from)\s+auth\.users\b/,
    );
  });
});
