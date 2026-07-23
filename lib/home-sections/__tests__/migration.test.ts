import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260723110345_create_home_page_layout.sql",
  ),
  "utf8",
);
const rpcPermissionPatch = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260723110605_restrict_home_section_snapshot_rpc.sql",
  ),
  "utf8",
);

describe("home page layout migration", () => {
  it("derives rail display order from rail positions in the saved layout", () => {
    const insert = migration.slice(
      migration.indexOf("insert into public.home_sections"),
      migration.indexOf("insert into public.home_section_items"),
    );

    expect(insert).toMatch(/with\s+rail_order\s+as/i);
    expect(insert).toMatch(
      /row_number\(\)\s+over\s*\(\s*order by layout_ordinality\s*\)\s*-\s*1/i,
    );
    expect(insert).toMatch(/where\s+item\s*->>\s*'kind'\s*=\s*'rail'/i);
    expect(insert).not.toContain("section ->> 'display_order'");
  });

  it("removes inherited anonymous RPC grants", () => {
    expect(rpcPermissionPatch).toMatch(
      /revoke all on function public\.save_home_section_snapshot\(jsonb\)\s+from anon, public;/i,
    );
  });
});
