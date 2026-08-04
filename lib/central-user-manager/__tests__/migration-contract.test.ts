import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDirectory).find((name) =>
  /^\d+_prepare_central_user_manager_agent\.sql$/.test(name),
);

if (!migrationName) {
  throw new Error("Central User Manager prepare migration is missing.");
}

const sql = readFileSync(join(migrationsDirectory, migrationName), "utf8");
const normalizedSql = sql.replace(/\s+/g, " ").trim().toLowerCase();

function expectSql(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("Central User Manager prepare migration contract", () => {
  it("preflights and normalizes admin email before adding credential fences", () => {
    expectSql(/where email is null or btrim\(email\) = ''/);
    expectSql(/do \$\$.+admin_users.+raise exception.+invalid.+raise exception.+duplicate/);
    expectSql(/update public\.admin_users set email = lower\(btrim\(email\)\)/);
    expectSql(/must_change_password boolean not null default false/);
    expectSql(
      /credential_version integer not null default 1 check \(credential_version > 0\)/,
    );
    expectSql(
      /create unique index.+on public\.admin_users \(lower\(btrim\(email\)\)\)/,
    );
  });

  it("creates constrained operation and mutation-lock tables", () => {
    expectSql(/create table public\.admin_user_operations/);
    expectSql(
      /actor_kind text not null check \(actor_kind in \('central_admin', 'target_admin'\)\)/,
    );
    expectSql(
      /action text not null check \(action in \('list_users', 'create_user', 'reissue_temporary_password', 'suspend_user', 'reactivate_user', 'complete_password_change'\)\)/,
    );
    expectSql(
      /status text not null default 'received' check \(status in \('received', 'leased', 'provider_intent', 'provider_outcome', 'completed', 'quarantined', 'needs_review'\)\)/,
    );
    expectSql(/fence_version integer not null.+check \(fence_version > 0\)/);
    expectSql(/attempt_count integer not null.+check \(attempt_count >= 0\)/);
    expectSql(/request_hash text not null.+\^\[0-9a-f\]\{64\}\$/);
    expectSql(/lease_token_hash text.+\^\[0-9a-f\]\{64\}\$/);
    expectSql(/safe_result jsonb.+private\.admin_user_safe_json\(safe_result\)/);
    expectSql(
      /\(action = 'list_users' and target_email_normalized is null\) or \(\s*action <> 'list_users' and target_email_normalized is not null and target_email_normalized = lower\(btrim\(target_email_normalized\)\)/,
    );

    expectSql(/create table public\.admin_user_mutation_locks/);
    expectSql(/target_email_normalized text primary key/);
    expectSql(
      /owner_kind text not null check \(owner_kind in \('central_operation', 'password_change'\)\)/,
    );
    expectSql(
      /state text not null check \(state in \('leased', 'quarantined'\)\)/,
    );
    expectSql(/fence_version integer not null check \(fence_version > 0\)/);
    expectSql(/lease_token_hash text not null.+\^\[0-9a-f\]\{64\}\$/);
  });

  it("uses RLS and explicit least-privilege grants", () => {
    for (const table of [
      "admin_user_operations",
      "admin_user_mutation_locks",
    ]) {
      expectSql(
        new RegExp(
          `alter table public\\.${table} enable row level security`,
        ),
      );
      expectSql(
        new RegExp(`alter table public\\.${table} force row level security`),
      );
    }

    expectSql(
      /revoke all on table public\.admin_user_operations, public\.admin_user_mutation_locks from public, anon, authenticated/,
    );
    expectSql(
      /revoke all on table public\.admin_user_operations, public\.admin_user_mutation_locks from service_role/,
    );
    expect(normalizedSql).not.toMatch(
      /grant .+ on table public\.admin_user_operations.+to service_role/,
    );
    expectSql(/pg_advisory_xact_lock\(hashtextextended\(/);
  });

  it("keeps privileged mutation private behind narrow service-role wrappers", () => {
    const functions = [
      "claim_admin_user_operation",
      "renew_admin_user_operation_lease",
      "commit_admin_user_operation_stage",
      "complete_admin_user_operation",
      "quarantine_admin_user_operation",
      "claim_forced_password_change",
      "advance_forced_password_change",
    ];

    for (const functionName of functions) {
      expectSql(
        new RegExp(
          `create (?:or replace )?function private\\.${functionName}_impl\\([^;]+security definer set search_path = pg_catalog, public, private, extensions`,
        ),
      );
      expectSql(
        new RegExp(
          `create (?:or replace )?function public\\.${functionName}\\([^;]+security definer set search_path = pg_catalog, public, private, extensions[^;]+return private\\.${functionName}_impl\\(`,
        ),
      );
      expectSql(
        new RegExp(
          `revoke all on function public\\.${functionName}\\([^)]*\\) from public, anon, authenticated`,
        ),
      );
      expectSql(
        new RegExp(
          `grant execute on function public\\.${functionName}\\([^)]*\\) to service_role`,
        ),
      );
    }
  });

  it("recursively rejects normalized sensitive result keys", () => {
    expectSql(
      /create or replace function private\.admin_user_safe_json\(p_value jsonb\)/,
    );
    expectSql(/jsonb_each\(p_value\)/);
    expectSql(/jsonb_array_elements\(p_value\)/);
    expectSql(/regexp_replace\(lower\(v_key\), '\[\^a-z0-9\]', '', 'g'\)/);
    expectSql(
      /password\|token\|secret\|authorization\|hash\|rawerror\|stack\|details\|hint/,
    );
    expectSql(
      /p_safe_result is not null and not private\.admin_user_safe_json\(p_safe_result\)/,
    );
  });

  it("sets a provider target once only for create-user provider outcome", () => {
    expectSql(
      /if p_target_user_id is not null then if v_operation\.target_user_id is not null and v_operation\.target_user_id <> p_target_user_id then raise exception.+operation_conflict/,
    );
    expectSql(
      /elsif v_operation\.target_user_id is null and \(\s*v_operation\.action <> 'create_user' or p_stage <> 'provider_outcome'\s*\) then raise exception.+operation_conflict/,
    );
    expectSql(
      /target_user_id = case when target_user_id is null and action = 'create_user' and p_stage = 'provider_outcome' then p_target_user_id else target_user_id end/,
    );
    expect(normalizedSql).not.toContain(
      "target_user_id = coalesce(p_target_user_id, target_user_id)",
    );
  });

  it("quarantines provider ambiguity permanently and gives generic stage commit sole provider-transition ownership", () => {
    expectSql(
      /v_operation\.status in \('provider_intent', 'provider_outcome', 'needs_review', 'quarantined'\).+set state = 'quarantined'.+quarantine_code = 'provider_ambiguous'/,
    );
    expectSql(
      /if p_stage in \('provider_intent', 'provider_outcome'\).+raise exception.+operation_conflict/,
    );
    expectSql(
      /commit_admin_user_operation_stage_impl.+set status = p_stage,.+provider_intent_at = case when p_stage = 'provider_intent'.+provider_outcome_at = case when p_stage = 'provider_outcome'/,
    );
  });

  it("exposes exact security-definer wrappers without private service-role access", () => {
    const signatures = {
      claim_admin_user_operation:
        "uuid, text, uuid, text, uuid, text, text, text, integer",
      renew_admin_user_operation_lease: "uuid, integer, text, text, integer",
      commit_admin_user_operation_stage:
        "uuid, integer, text, text, uuid, jsonb",
      complete_admin_user_operation: "uuid, integer, text, jsonb",
      quarantine_admin_user_operation: "uuid, integer, text, text",
      claim_forced_password_change:
        "uuid, uuid, uuid, text, text, text, integer",
      advance_forced_password_change: "uuid, integer, text, text, jsonb",
    } as const;

    expectSql(/revoke usage on schema private from service_role/);
    expect(normalizedSql).not.toContain(
      "grant usage on schema private to service_role",
    );

    for (const [name, signature] of Object.entries(signatures)) {
      expectSql(
        new RegExp(
          `revoke all on function private\\.${name}_impl\\(${signature}\\) from service_role`,
        ),
      );
      expect(normalizedSql).not.toContain(
        `grant execute on function private.${name}_impl(${signature}) to service_role`,
      );
      expectSql(
        new RegExp(
          `revoke all on function public\\.${name}\\(${signature}\\) from public, anon, authenticated`,
        ),
      );
      expectSql(
        new RegExp(
          `grant execute on function public\\.${name}\\(${signature}\\) to service_role`,
        ),
      );
    }
  });

  it("never mutates auth.users or changes the existing admin predicate", () => {
    expect(normalizedSql).not.toMatch(
      /\b(?:insert\s+into|update|delete\s+from)\s+auth\.users\b/,
    );
    expect(normalizedSql).not.toContain(
      "create or replace function private.is_home_config_admin",
    );
  });
});
