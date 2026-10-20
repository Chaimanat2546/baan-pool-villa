import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADVERTISEMENT_ZONES } from "../validation";
const sql = readFileSync(
  "supabase/migrations/20261020000000_create_site_advertisements.sql",
  "utf8",
);
describe("site advertisement migration", () => {
  it("ships the identical online patch and shared zone contract", () => {
    expect(
      readFileSync("supabase/patches/20261020_site_advertisements.sql", "utf8"),
    ).toBe(sql);
    for (const zone of ADVERTISEMENT_ZONES)
      expect(sql).toContain(`'${zone.value}'`);
  });
  it("ships the public-read repair as an identical online patch", () => {
    expect(readFileSync("supabase/patches/20261020_site_advertisement_public_reads.sql", "utf8")).toBe(
      readFileSync("supabase/migrations/20261020010000_fix_site_advertisement_public_reads.sql", "utf8"),
    );
  });
  it("ships the two-image restriction as an identical online patch", () => {
    expect(readFileSync("supabase/patches/20261020_site_advertisement_two_images.sql", "utf8")).toBe(
      readFileSync("supabase/migrations/20261020020000_limit_site_advertisement_images_to_two.sql", "utf8"),
    );
  });
  it("keeps privileged mutations private and scoped", () => {
    expect(sql).toContain("security definer set search_path = pg_catalog");
    expect(sql).toContain("security invoker set search_path = pg_catalog");
    expect(sql).toContain("where advertisement_id = v_id");
    expect(sql).toContain("using errcode = '40001'");
    expect(sql).toContain(
      "u.attached_at is null and u.created_by = auth.uid()",
    );
    expect(sql).not.toContain("public.advertisements");
  });
});
