import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260729135540_close_central_user_operation_composition.sql",
  ),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();
const composedSql = readdirSync(join(process.cwd(), "supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) =>
    readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8"),
  )
  .join("\n")
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("Task 6 round-two composed migration contract", () => {
  it.each([
    "claim_admin_user_operation",
    "resume_admin_user_operation",
    "commit_admin_user_operation_stage",
    "commit_admin_user_provider_stage",
    "complete_admin_user_operation",
    "record_admin_user_late_fence",
    "create_admin_user_profile_for_operation",
    "advance_admin_user_profile_for_operation",
    "activate_admin_user_profile_for_operation",
    "claim_forced_password_change",
  ])("revokes the obsolete service-role entrypoint %s", (name) => {
    const grant = composedSql.lastIndexOf(
      `grant execute on function public.${name}(`,
    );
    const revoke = composedSql.lastIndexOf(
      `revoke execute on function public.${name}(`,
    );
    expect(grant).toBeGreaterThan(-1);
    expect(revoke).toBeGreaterThan(grant);
  });

  it("provides forced-password compatibility through the monotonic v2 resume path", () => {
    expect(sql).toContain(
      "create or replace function public.claim_forced_password_change_v2",
    );
    expect(sql).toContain(
      "return private.resume_admin_user_operation_v2_impl(",
    );
  });

  it("closes provider errors and completion scalar/profile/action proof", () => {
    for (const code of [
      "provider_timeout",
      "provider_unavailable",
      "provider_rejected",
      "provider_identity_mismatch",
      "provider_pagination_limit",
    ]) {
      expect(sql).toContain(`'${code}'`);
    }
    expect(sql).toContain("p_user_status is null");
    expect(sql).toContain("p_credential_version <= 0");
    expect(sql).toContain(
      "v_profile.credential_version is distinct from p_credential_version",
    );
    expect(sql).toContain(
      "v_operation.target_email_normalized is distinct from p_email_normalized",
    );
    expect(sql).toContain(
      "v_operation.stage is distinct from case v_operation.action",
    );
  });

  it("binds suspension to the exact prior forced-password flag", () => {
    expect(sql).toContain(
      "p_next_must_change_password is distinct from p_expected_must_change_password",
    );
  });
});
