import { describe, expect, it } from "vitest";

import { getAdminErrorMessage } from "../admin-error-messages";

describe("getAdminErrorMessage", () => {
  it("keeps a Thai message from a Supabase-style error object", () => {
    const message = "รหัส OTP ไม่ถูกต้องหรือหมดอายุ";

    expect(getAdminErrorMessage({ message }, "ไม่สามารถดำเนินการได้")).toBe(
      message,
    );
  });

  it("keeps a Thai message from a thrown string", () => {
    const message = "ส่ง OTP ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";

    expect(getAdminErrorMessage(message, "ไม่สามารถดำเนินการได้")).toBe(
      message,
    );
  });
});
