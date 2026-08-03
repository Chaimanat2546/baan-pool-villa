import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDirectory).find((name) =>
  name.endsWith("_list_reconciled_admin_users.sql"),
);
const sql = migrationName
  ? readFileSync(join(migrationsDirectory, migrationName), "utf8")
      .replace(/--.*$/gm, "")
      .replace(/\s+/g, " ")
      .toLowerCase()
  : "";

describe("Task 6 round-five reconciled list migration", () => {
  it("creates one private definer and one fixed-path public wrapper", () => {
    expect(migrationName).toBeDefined();
    expect(sql).toContain(
      "create function private.list_reconciled_admin_users_v1_impl(",
    );
    expect(sql).toContain(
      "create function public.list_reconciled_admin_users_v1(",
    );
    expect(sql.match(/security definer/g)).toHaveLength(2);
    expect(sql.match(/set search_path = ''/g)).toHaveLength(2);
  });

  it("uses only the approved fully-qualified Auth and profile fields", () => {
    for (const field of [
      "auth.users",
      "public.admin_users",
      "id",
      "email",
      "created_at",
      "last_sign_in_at",
      "confirmed_at",
      "banned_until",
      "raw_app_meta_data",
      "user_id",
      "role",
      "is_active",
      "must_change_password",
      "credential_version",
    ]) {
      expect(sql).toContain(field);
    }
    for (const forbidden of [
      "encrypted_password",
      "raw_user_meta_data",
      "phone",
      "identities",
      "confirmation_token",
      "recovery_token",
    ]) {
      expect(sql).not.toContain(forbidden);
    }
  });

  it("reconciles exact UIDs and global normalized-email ownership", () => {
    expect(sql).toContain("full outer join");
    expect(sql).toMatch(/\bon\s+a\.user_id\s*=\s*p\.user_id\b/);
    expect(sql).toContain("email_claims");
    expect(sql).toContain("email_ownership");
    expect(sql).toMatch(
      /select\s+auth_email\s+as\s+normalized_email,\s*user_id\s+from\s+auth_source\s+union\s+select\s+profile_email\s+as\s+normalized_email,\s*user_id\s+from\s+profile_source/,
    );
    expect(sql).toContain("count(*)");
  });

  it("derives exact abnormal and lifecycle statuses before stable paging", () => {
    for (const status of [
      "'active'",
      "'password_change_required'",
      "'suspended'",
      "'abnormal'",
    ]) {
      expect(sql).toContain(status);
    }
    expect(sql).toContain("bpv_admin_managed");
    expect(sql).toContain("credential_version");
    expect(sql).toContain("confirmed_at");
    expect(sql).toContain("banned_until");
    expect(sql).toMatch(
      /order by\s+display_email\s+asc,\s*user_id\s+asc/,
    );
    expect(sql).toContain("p_page between 1 and 100");
    expect(sql).toContain("p_page_size between 1 and 100");
    expect(sql).toContain("p_page_size + 1");
    expect(sql).toContain("p_page < 100");
  });

  it("returns only the strict DTO and pagination fields", () => {
    for (const key of [
      "'users'",
      "'hasmore'",
      "'userid'",
      "'email'",
      "'status'",
      "'createdat'",
      "'lastsigninat'",
      "'credentialversion'",
      "'authcredentialversion'",
    ]) {
      expect(sql).toContain(key);
    }
    expect(sql).not.toMatch(
      /jsonb_build_object\([^;]*(raw_app_meta_data|metadata|confirmed_at|banned_until)/,
    );
  });

  it("is read-only and contains no Auth DML, locks, triggers, or dynamic SQL", () => {
    expect(sql).not.toMatch(
      /\b(insert|update|delete|merge|truncate|lock|for update|create trigger)\b/,
    );
    expect(sql).not.toMatch(/\bexecute\s+(format|immediate)\b/);
    expect(sql).not.toMatch(
      /\b(insert into|update|delete from)\s+auth\.users\b/,
    );
  });

  it("revokes every direct path and grants only the public wrapper to service_role", () => {
    expect(sql).toMatch(
      /revoke all on function private\.list_reconciled_admin_users_v1_impl\(\s*integer,\s*integer\s*\) from public, anon, authenticated, service_role/,
    );
    expect(sql).toMatch(
      /revoke all on function public\.list_reconciled_admin_users_v1\(\s*integer,\s*integer\s*\) from public, anon, authenticated, service_role/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.list_reconciled_admin_users_v1\(\s*integer,\s*integer\s*\) to service_role/,
    );
    expect(sql).not.toContain(
      "grant execute on function private.list_reconciled_admin_users_v1_impl",
    );
  });
});
