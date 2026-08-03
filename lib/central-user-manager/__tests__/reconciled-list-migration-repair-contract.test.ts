import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDirectory).find((name) =>
  name.endsWith("_repair_reconciled_admin_list_integer_cast.sql"),
);
const sql = migrationName
  ? readFileSync(join(migrationsDirectory, migrationName), "utf8")
      .replace(/--.*$/gm, "")
      .replace(/\s+/g, " ")
      .toLowerCase()
  : "";

describe("reconciled admin list integer-cast repair", () => {
  it("replaces only the private read-only implementation with a valid int4 cast", () => {
    expect(migrationName).toBeDefined();
    expect(sql).toContain(
      "create or replace function private.list_reconciled_admin_users_v1_impl(",
    );
    expect(sql).toContain("::pg_catalog.int4");
    expect(sql).not.toContain("::pg_catalog.integer");
    expect(sql).toContain("stable");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).not.toMatch(
      /\b(insert|update|delete|merge|truncate|lock|for update|create trigger)\b/,
    );
  });
});
