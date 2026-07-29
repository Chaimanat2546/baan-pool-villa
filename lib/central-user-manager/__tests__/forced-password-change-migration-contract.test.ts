import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730010000_complete_forced_password_change_v2.sql",
  ),
  "utf8",
)
  .toLowerCase()
  .replace(/\s+/g, " ");

describe("forced-password completion migration", () => {
  it("keeps implementations private and public wrappers service-role only", () => {
    for (const name of [
      "complete_forced_password_change_v2",
      "release_forced_password_change_v2",
      "rollback_forced_password_change_v2",
    ]) {
      expect(sql).toContain(`function private.${name}_impl(`);
      expect(sql).toContain(`function public.${name}(`);
      expect(sql).toContain(
        "set search_path = pg_catalog, public, private, extensions",
      );
      expect(sql).toMatch(
        new RegExp(
          `revoke all on function public\\.${name}\\([^;]+ from public, anon, authenticated`,
        ),
      );
      expect(sql).toMatch(
        new RegExp(`grant execute on function public\\.${name}\\([^;]+ to service_role`),
      );
    }
  });

  it("clears only the forced flag at exact N+2 after Auth alignment", () => {
    expect(sql).toContain("v_operation.stage is distinct from 'auth_n2_aligned'");
    expect(sql).toContain("user_id = p_user_id");
    expect(sql).toContain("email = p_email_normalized");
    expect(sql).toContain("is_active = true");
    expect(sql).toContain("must_change_password = true");
    expect(sql).toContain("credential_version = p_credential_version");
    expect(sql).toContain("set must_change_password = false");
    expect(sql).not.toContain("credential_version = credential_version + 1");
    expect(sql).toContain("owner_kind = 'password_change'");
    expect(sql).toContain("fence_version = p_fence_version");
    expect(sql).toContain("lease_token_hash = p_lease_token_hash");
  });

  it("allows only exact one-step rollback while forced and active", () => {
    expect(sql).toContain(
      "p_next_credential_version is distinct from p_expected_credential_version - 1",
    );
    expect(sql).toContain("set credential_version = p_next_credential_version");
    expect(sql).toContain("and is_active = true");
    expect(sql).toContain("and must_change_password = true");
  });

  it("never mutates Auth tables and reloads PostgREST", () => {
    expect(sql).not.toMatch(/\b(update|insert into|delete from)\s+auth\.users\b/);
    expect(sql).toContain("notify pgrst, 'reload schema'");
  });

  it("extends the health attestation with all three exact runtime RPCs", () => {
    expect(sql).toContain(
      "private.central_user_manager_forced_password_health_v1()",
    );
    expect(sql).toContain(
      "public.complete_forced_password_change_v2(uuid,integer,text,uuid,text,integer)",
    );
    expect(sql).toContain(
      "public.release_forced_password_change_v2(uuid,integer,text,uuid,text,text)",
    );
    expect(sql).toContain(
      "public.rollback_forced_password_change_v2(uuid,integer,text,uuid,text,integer,integer,text)",
    );
    expect(sql).toContain(
      "and checkpoint.ok and forced_password.ok",
    );
    expect(sql).toContain(
      "pg_catalog.has_function_privilege( 'service_role', routine.oid, 'execute' )",
    );
  });
});
