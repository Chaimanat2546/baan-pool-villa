import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDirectory).find((name) =>
  /^\d+_enforce_admin_credential_fence\.sql$/.test(name),
);
const sql = migrationName
  ? readFileSync(join(migrationsDirectory, migrationName), "utf8")
      .replace(/--.*$/gm, "")
      .replace(/\s+/g, " ")
      .toLowerCase()
  : "";

describe("admin credential fence migration", () => {
  it("replaces the strict helper with an exact active, non-forced credential fence", () => {
    expect(migrationName).toBeDefined();
    expect(sql).toContain(
      "create or replace function private.is_home_config_admin()",
    );
    expect(sql).toContain("v_uid uuid := auth.uid()");
    expect(sql).toContain("if v_uid is null then return false");
    expect(sql).toContain("admin_user.user_id = v_uid");
    expect(sql).toContain("admin_user.role = 'admin'");
    expect(sql).toContain("admin_user.is_active = true");
    expect(sql).toContain("admin_user.must_change_password = false");
    expect(sql).toContain("admin_user.credential_version > 0");
    expect(sql).toContain(
      "admin_user.credential_version = v_jwt_credential_version",
    );
  });

  it("parses JWT app metadata structurally without an unsafe direct integer cast", () => {
    expect(sql).toContain(
      "v_version_json := auth.jwt() -> 'app_metadata' -> 'credential_version'",
    );
    expect(sql).toContain("jsonb_typeof(v_version_json) <> 'number'");
    expect(sql).toContain("v_version_text !~ '^[1-9][0-9]*$'");
    expect(sql).toContain("pg_catalog.char_length(v_version_text) > 10");
    expect(sql).toContain("v_version_text::numeric > 2147483647");
    expect(sql).not.toMatch(
      /auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'credential_version'\s*\)::integer/,
    );
  });

  it.each([
    ["null UID", "if v_uid is null then return false"],
    ["inactive profile", "admin_user.is_active = true"],
    ["forced profile", "admin_user.must_change_password = false"],
    ["missing JWT version", "v_version_json is null"],
    ["zero JWT version", "v_version_text !~ '^[1-9][0-9]*$'"],
    ["malformed JWT version", "jsonb_typeof(v_version_json) <> 'number'"],
    ["huge JWT version", "v_version_text::numeric > 2147483647"],
    ["fractional JWT version", "v_version_text !~ '^[1-9][0-9]*$'"],
    [
      "database mismatch",
      "admin_user.credential_version = v_jwt_credential_version",
    ],
    ["exact success", "return exists ( select 1 from public.admin_users"],
  ])("contains the fail-closed predicate for %s", (_case, predicate) => {
    expect(sql).toContain(predicate);
  });

  it("uses a fixed empty search path, explicit owner, and least-privilege execute ACL", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain(
      "alter function private.is_home_config_admin() owner to postgres",
    );
    expect(sql).toContain(
      "revoke all on function private.is_home_config_admin() from public, anon, authenticated, service_role",
    );
    expect(sql).toContain(
      "grant execute on function private.is_home_config_admin() to authenticated",
    );
  });

  it("replaces broad browser enumeration with an exact-self SELECT policy", () => {
    expect(sql).toContain(
      'drop policy if exists "authenticated admins can select admin users" on public.admin_users',
    );
    expect(sql).toContain(
      'create policy "authenticated users can select own admin user" on public.admin_users for select to authenticated',
    );
    expect(sql).toContain(
      "user_id = (select auth.uid())",
    );
    expect(sql).not.toContain(
      'create policy "authenticated admins can select admin users"',
    );
    expect(sql).not.toMatch(
      /create policy "authenticated users can select own admin user"[^;]+private\.is_home_config_admin\(\)/,
    );
  });

  it("retains only the browser columns needed for exact-self session classification", () => {
    expect(sql).toContain(
      "revoke all on table public.admin_users from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant select (user_id, email, is_active, must_change_password, credential_version) on public.admin_users to authenticated",
    );
  });

  it("does not mutate Auth users and reloads PostgREST", () => {
    expect(sql).not.toMatch(
      /\b(insert into|update|delete from|merge into)\s+auth\.users\b/,
    );
    expect(sql).toContain("notify pgrst, 'reload schema'");
  });
});
