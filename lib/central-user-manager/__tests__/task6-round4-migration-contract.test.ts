import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260729145110_repair_central_suspension_and_list_budget.sql",
  ),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("Task 6 round-four suspension composition", () => {
  it("uses firewall-safe forced-flag scalar keys", () => {
    expect(sql).toContain("'profileforcedflag'");
    expect(sql).toContain("'suspensionexpectedforcedflag'");
    expect(sql).not.toContain("'profilemustchangepassword'");
    expect(sql).not.toContain("'suspensionexpectedmustchangepassword'");
  });

  it("preserves the exact suspension flag and returns profile JSON", () => {
    expect(sql).toContain(
      "p_next_must_change_password is distinct from p_expected_must_change_password",
    );
    expect(sql).toContain("return to_jsonb(v_profile)");
  });
});
