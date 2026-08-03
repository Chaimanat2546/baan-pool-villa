import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = resolve(
  "supabase/migrations/20260730220000_restore_public_images_read_access.sql",
);

describe("public images read access migration", () => {
  it("restores anon SELECT without granting public writes", async () => {
    const sql = (await readFile(MIGRATION_PATH, "utf8")).toLowerCase();

    expect(sql).toContain("grant select on table public.images to anon");
    expect(sql).toContain("create policy \"public can read images\"");
    expect(sql).toContain("for select");
    expect(sql).toContain("to anon");
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)/);
  });
});
