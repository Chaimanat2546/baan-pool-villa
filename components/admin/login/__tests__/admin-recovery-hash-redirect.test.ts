import { describe, expect, it } from "vitest";

import { getAdminRecoveryHashRedirect } from "../admin-recovery-hash-redirect";

describe("getAdminRecoveryHashRedirect", () => {
  it("redirects Supabase recovery hashes from the public root to the admin reset page", () => {
    expect(
      getAdminRecoveryHashRedirect("#access_token=token&type=recovery"),
    ).toBe("/admin/reset-password#access_token=token&type=recovery");
  });

  it("ignores non-recovery hashes", () => {
    expect(getAdminRecoveryHashRedirect("#type=invite&access_token=token")).toBeNull();
    expect(getAdminRecoveryHashRedirect("#type=recovery")).toBeNull();
  });
});
