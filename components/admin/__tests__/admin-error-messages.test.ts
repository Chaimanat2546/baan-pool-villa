import { describe, expect, it } from "vitest";

import { getAdminErrorMessage } from "../admin-error-messages";

describe("getAdminErrorMessage", () => {
  it("translates Supabase weak password messages", () => {
    expect(getAdminErrorMessage({ message: "Password is too weak" }, "ไม่สามารถดำเนินการได้")).toBe(
      "รหัสผ่านใหม่ยังไม่ปลอดภัยพอ กรุณาใช้รหัสผ่านที่ยาวขึ้นและผสมตัวอักษรใหญ่ ตัวอักษรเล็ก ตัวเลข และสัญลักษณ์",
    );
  });

  it("translates Supabase weak password codes", () => {
    expect(getAdminErrorMessage({ code: "weak_password" }, "ไม่สามารถดำเนินการได้")).toBe(
      "รหัสผ่านใหม่ยังไม่ปลอดภัยพอ กรุณาใช้รหัสผ่านที่ยาวขึ้นและผสมตัวอักษรใหญ่ ตัวอักษรเล็ก ตัวเลข และสัญลักษณ์",
    );
  });

  it("translates Supabase password policy messages", () => {
    expect(
      getAdminErrorMessage(
        { message: "Password should be at least 8 characters" },
        "ไม่สามารถดำเนินการได้",
      ),
    ).toBe("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");

    expect(
      getAdminErrorMessage(
        { message: "New password should be different from the old password." },
        "ไม่สามารถดำเนินการได้",
      ),
    ).toBe("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม");
  });

  it("translates Supabase reauthentication password errors", () => {
    expect(getAdminErrorMessage({ code: "reauthentication_needed" }, "ไม่สามารถดำเนินการได้")).toBe(
      "กรุณายืนยันตัวตนอีกครั้งก่อนเปลี่ยนรหัสผ่าน",
    );
  });

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
