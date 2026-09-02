import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase/migrations");
const migrationName = readdirSync(migrationsDirectory).find((name) =>
  name.endsWith("_add_gallery_category_order_constraint.sql"),
);

describe("gallery category order database constraint", () => {
  it("permits the complete categoryOrder option only for Gallery styles", () => {
    expect(migrationName).toBeDefined();

    const migration = readFileSync(
      join(migrationsDirectory, migrationName as string),
      "utf8",
    );

    expect(migration).toContain("drop constraint if exists site_web_styles_options_check");
    expect(migration).toMatch(/options\s*-\s*'backgroundColor'\s*-\s*'textColor'\s*-\s*'categoryOrder'/i);
    expect(migration).toMatch(/jsonb_array_length\(options\s*->\s*'categoryOrder'\)\s*=\s*11/i);
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
