import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDirectory).find((name) =>
  /^\d+_add_central_user_manager_health_probe\.sql$/.test(name),
);
const sql = migrationName
  ? readFileSync(join(migrationsDirectory, migrationName), "utf8")
      .replace(/--.*$/gm, "")
      .replace(/\s+/g, " ")
      .toLowerCase()
  : "";

describe("Central User Manager health probe migration", () => {
  it("creates a read-only fixed-path private implementation and public wrapper", () => {
    expect(migrationName).toBeDefined();
    expect(sql).toContain(
      "create function private.central_user_manager_health_probe_v1_impl()",
    );
    expect(sql).toContain(
      "create function public.central_user_manager_health_probe_v1()",
    );
    expect(sql.match(/security definer/g)).toHaveLength(2);
    expect(sql.match(/set search_path = ''/g)).toHaveLength(2);
    expect(sql).toContain(
      "select private.central_user_manager_health_probe_v1_impl()",
    );
  });

  it("checks required tables, columns, and exact runtime function owners through pg_catalog", () => {
    for (const object of [
      "public.admin_users",
      "public.admin_user_operations",
      "public.admin_user_mutation_locks",
      "public.admin_user_provider_events",
      "public.resume_admin_user_operation_v2",
      "public.renew_admin_user_operation_lease",
      "public.commit_admin_user_provider_intent_v2",
      "public.commit_admin_user_provider_outcome_v2",
      "public.complete_admin_user_operation_v2",
      "public.list_reconciled_admin_users_v1",
    ]) {
      expect(sql).toContain(object);
    }
    for (const column of [
      "user_id",
      "email",
      "is_active",
      "must_change_password",
      "credential_version",
      "operation_id",
      "request_hash",
      "fence_version",
    ]) {
      expect(sql).toContain(`'${column}'`);
    }
  });

  it("returns only exact boolean checks and contains no writes, locks, triggers, or dynamic SQL", () => {
    for (const key of [
      "'database'",
      "'adminuserstable'",
      "'operationtables'",
    ]) {
      expect(sql).toContain(key);
    }
    expect(sql).not.toMatch(
      /\b(insert|update|delete|merge|truncate|lock|for update|create trigger)\b/,
    );
    expect(sql).not.toMatch(/\bexecute\s+(format|immediate)\b/);
  });

  it("revokes all direct paths and grants only the public wrapper to service_role", () => {
    expect(sql).toMatch(
      /revoke all on function private\.central_user_manager_health_probe_v1_impl\(\) from public, anon, authenticated, service_role/,
    );
    expect(sql).toMatch(
      /revoke all on function public\.central_user_manager_health_probe_v1\(\) from public, anon, authenticated, service_role/,
    );
    expect(sql).toContain(
      "grant execute on function public.central_user_manager_health_probe_v1() to service_role",
    );
    expect(sql).not.toContain(
      "grant execute on function private.central_user_manager_health_probe_v1_impl",
    );
  });
});
