import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260729142548_finalize_central_user_operation_proofs.sql",
  ),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("Task 6 round-three SQL proof contract", () => {
  it("claims forced-password work as the exact target actor on a monotonic tombstone", () => {
    expect(sql).toContain("'target_admin'");
    expect(sql).toContain("'complete_password_change'");
    expect(sql).toContain("p_actor_uid is distinct from p_target_user_id");
    expect(sql).toContain("admin_user_mutation_fences");
    expect(sql).toContain("last_fence_version = greatest(");
    expect(sql).not.toContain(
      "return private.resume_admin_user_operation_v2_impl(",
    );
  });

  it("persists and proves the immutable suspension forced-flag checkpoint", () => {
    expect(sql).toContain(
      "suspension_expected_must_change_password boolean",
    );
    expect(sql).toContain(
      "'suspensionexpectedmustchangepassword'",
    );
    expect(sql).toContain(
      "v_profile.must_change_password is distinct from v_operation.suspension_expected_must_change_password",
    );
  });

  it("rejects null, infinite, future, ancient, and misordered timestamps", () => {
    expect(sql).toContain("p_created_at is null");
    expect(sql).toContain("isfinite(p_created_at)");
    expect(sql).toContain(
      "p_created_at < timestamptz '2000-01-01 00:00:00+00'",
    );
    expect(sql).toContain("p_created_at > v_now + interval '5 minutes'");
    expect(sql).toContain("not isfinite(p_last_sign_in_at)");
    expect(sql).toContain("p_last_sign_in_at < p_created_at");
    expect(sql).toContain(
      "p_last_sign_in_at > v_now + interval '5 minutes'",
    );
  });
});
