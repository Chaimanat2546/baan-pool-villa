/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  changeInput,
  click,
  flushEffects,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  readAdminAccessToken: vi.fn(),
  replace: vi.fn(),
  signOut: vi.fn(),
  signInWithOtp: vi.fn(),
  updateUser: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createBrowserHomeConfigClient: () => ({
    auth: {
      getUser: mocks.getUser,
      signOut: mocks.signOut,
      signInWithOtp: mocks.signInWithOtp,
      updateUser: mocks.updateUser,
      verifyOtp: mocks.verifyOtp,
    },
  }),
}));

import { AdminPasswordSecurityCard } from "../admin-password-security-card";

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((item) =>
    item.textContent?.includes(label),
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

async function openPasswordModal(container: HTMLElement) {
  await click(findButton(container, "เปลี่ยนรหัสผ่าน"));
}

async function submitPasswordChange(
  container: HTMLElement,
  {
    confirmPassword,
    newPassword,
    otp = "123456",
  }: {
    confirmPassword?: string;
    newPassword: string;
    otp?: string;
  },
) {
  await changeInput(
    container.querySelector("#adminPasswordOtp") as HTMLInputElement,
    otp,
  );
  await changeInput(
    container.querySelector("#adminNewPassword") as HTMLInputElement,
    newPassword,
  );
  await changeInput(
    container.querySelector("#adminConfirmPassword") as HTMLInputElement,
    confirmPassword ?? newPassword,
  );
  await click(findButton(container, "ยืนยันและเปลี่ยนรหัสผ่าน"));
  await flushEffects();
}

describe("AdminPasswordSecurityCard", () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({
      data: { user: { email: "admin@example.com" } },
      error: null,
    });
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    mocks.updateUser.mockResolvedValue({
      data: { user: { id: "admin-user" } },
      error: null,
    });
    mocks.verifyOtp.mockResolvedValue({
      data: {
        session: { access_token: "otp-token" },
        user: { email: "admin@example.com" },
      },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.getUser.mockClear();
    mocks.replace.mockReset();
    mocks.signOut.mockClear();
    mocks.signInWithOtp.mockClear();
    mocks.updateUser.mockClear();
    mocks.verifyOtp.mockClear();
  });

  afterEach(() => {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    vi.unstubAllGlobals();
  });

  it("locks page scrolling while the password modal is open", async () => {
    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "auto";
    const page = await mountAdminPage(<AdminPasswordSecurityCard />);

    await openPasswordModal(page.container);

    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");

    const closeButton = page.container.querySelector(
      "[role='dialog'] button[aria-label]",
    );

    expect(closeButton).toBeInstanceOf(HTMLButtonElement);

    await click(closeButton as HTMLButtonElement);

    expect(document.body.style.overflow).toBe("auto");
    expect(document.documentElement.style.overflow).toBe("auto");

    await page.unmount();
  });

  it("sends an email OTP from the modal", async () => {
    const page = await mountAdminPage(<AdminPasswordSecurityCard />);

    await click(findButton(page.container, "เปลี่ยนรหัสผ่าน"));
    await click(findButton(page.container, "ส่งรหัส OTP ไปอีเมล"));
    await flushEffects();

    expect(mocks.readAdminAccessToken).toHaveBeenCalled();
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "admin@example.com",
      options: { shouldCreateUser: false },
    });
    expect(page.container.textContent).toContain("ส่งรหัส OTP แล้ว");

    await page.unmount();
  });

  it("shows a Thai cooldown message when OTP sending is rate limited", async () => {
    mocks.signInWithOtp.mockResolvedValue({
      data: {},
      error: new Error("429 Too Many Requests"),
    });
    const page = await mountAdminPage(<AdminPasswordSecurityCard />);

    await click(findButton(page.container, "เปลี่ยนรหัสผ่าน"));
    await click(findButton(page.container, "ส่งรหัส OTP ไปอีเมล"));
    await flushEffects();

    expect(page.container.textContent).toContain("ส่ง OTP ถี่เกินไป");
    expect(page.container.textContent).toContain("60 วินาที");

    await page.unmount();
  });

  it("shows a useful Thai message when OTP sending times out", async () => {
    mocks.signInWithOtp.mockResolvedValue({
      data: {},
      error: { message: "{}", status: 504 },
    });
    const page = await mountAdminPage(<AdminPasswordSecurityCard />);

    await openPasswordModal(page.container);
    await click(findButton(page.container, "ส่งรหัส OTP ไปอีเมล"));
    await flushEffects();

    expect(page.container.textContent).toContain(
      "ระบบส่ง OTP มีปัญหาชั่วคราว",
    );
    expect(page.container.textContent).toContain("Supabase Auth Logs");
    expect(page.container.textContent).not.toContain("{}");

    await page.unmount();
  });

  it("prevents immediate OTP resend after a successful send", async () => {
    const page = await mountAdminPage(<AdminPasswordSecurityCard />);

    await click(findButton(page.container, "เปลี่ยนรหัสผ่าน"));
    const sendButton = findButton(page.container, "ส่งรหัส OTP ไปอีเมล");

    await click(sendButton);
    await flushEffects();
    await click(sendButton);
    await flushEffects();

    expect(mocks.signInWithOtp).toHaveBeenCalledTimes(1);
    expect(page.container.textContent).toContain("ส่ง OTP อีกครั้งใน");

    await page.unmount();
  });

  it("updates the password, signs out globally, and redirects to login", async () => {
    const page = await mountAdminPage(<AdminPasswordSecurityCard />);

    await click(findButton(page.container, "เปลี่ยนรหัสผ่าน"));
    await click(findButton(page.container, "ส่งรหัส OTP ไปอีเมล"));
    await flushEffects();
    await changeInput(
      page.container.querySelector("#adminPasswordOtp") as HTMLInputElement,
      "123456",
    );
    await changeInput(
      page.container.querySelector("#adminNewPassword") as HTMLInputElement,
      "Newpassword123\\",
    );
    await changeInput(
      page.container.querySelector("#adminConfirmPassword") as HTMLInputElement,
      "Newpassword123\\",
    );
    await click(findButton(page.container, "ยืนยันและเปลี่ยนรหัสผ่าน"));
    await flushEffects();

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "admin@example.com",
      token: "123456",
      type: "email",
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: "Newpassword123\\",
    });
    expect(mocks.signOut).toHaveBeenCalledWith();
    expect(mocks.replace).toHaveBeenCalledWith("/admin/login");

    await page.unmount();
  });

  it("does not update the password when the email OTP is invalid", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Token has expired or is invalid" },
    });
    const page = await mountAdminPage(<AdminPasswordSecurityCard />);

    await click(findButton(page.container, "เปลี่ยนรหัสผ่าน"));
    await click(findButton(page.container, "ส่งรหัส OTP ไปอีเมล"));
    await flushEffects();
    await changeInput(
      page.container.querySelector("#adminPasswordOtp") as HTMLInputElement,
      "000000",
    );
    await changeInput(
      page.container.querySelector("#adminNewPassword") as HTMLInputElement,
      "New-password-123!",
    );
    await changeInput(
      page.container.querySelector("#adminConfirmPassword") as HTMLInputElement,
      "New-password-123!",
    );
    await click(findButton(page.container, "ยืนยันและเปลี่ยนรหัสผ่าน"));
    await flushEffects();

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "admin@example.com",
      token: "000000",
      type: "email",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalledWith("/admin/login");

    await page.unmount();
  });

  it("shows a Thai error and stays signed in when Supabase rejects a weak password", async () => {
    mocks.updateUser.mockResolvedValue({
      data: { user: null },
      error: { code: "weak_password", message: "Password is too weak" },
    });
    const page = await mountAdminPage(<AdminPasswordSecurityCard />);

    await click(findButton(page.container, "เปลี่ยนรหัสผ่าน"));
    await click(findButton(page.container, "ส่งรหัส OTP ไปอีเมล"));
    await flushEffects();
    await changeInput(
      page.container.querySelector("#adminPasswordOtp") as HTMLInputElement,
      "123456",
    );
    await changeInput(
      page.container.querySelector("#adminNewPassword") as HTMLInputElement,
      "ValidPass1!",
    );
    await changeInput(
      page.container.querySelector("#adminConfirmPassword") as HTMLInputElement,
      "ValidPass1!",
    );
    await click(findButton(page.container, "ยืนยันและเปลี่ยนรหัสผ่าน"));
    await flushEffects();

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "admin@example.com",
      token: "123456",
      type: "email",
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "ValidPass1!" });
    expect(page.container.textContent).toContain("รหัสผ่านใหม่ยังอ่อนเกินไป");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalledWith("/admin/login");

    await page.unmount();
  });

  it("checks the typed OTP even when this modal did not send it first", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Token has expired or is invalid" },
    });
    const page = await mountAdminPage(<AdminPasswordSecurityCard />);

    await click(findButton(page.container, "เปลี่ยนรหัสผ่าน"));
    await changeInput(
      page.container.querySelector("#adminPasswordOtp") as HTMLInputElement,
      "000000",
    );
    await changeInput(
      page.container.querySelector("#adminNewPassword") as HTMLInputElement,
      "New-password-123!",
    );
    await changeInput(
      page.container.querySelector("#adminConfirmPassword") as HTMLInputElement,
      "New-password-123!",
    );
    await click(findButton(page.container, "ยืนยันและเปลี่ยนรหัสผ่าน"));
    await flushEffects();

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "admin@example.com",
      token: "000000",
      type: "email",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(page.container.textContent).toContain("รหัส OTP ไม่ถูกต้องหรือหมดอายุ");
    expect(page.container.textContent).not.toContain("กดส่งรหัส OTP ไปอีเมลก่อน");

    await page.unmount();
  });

  it("blocks submit when passwords do not match", async () => {
    const page = await mountAdminPage(<AdminPasswordSecurityCard />);

    await click(findButton(page.container, "เปลี่ยนรหัสผ่าน"));
    await changeInput(
      page.container.querySelector("#adminPasswordOtp") as HTMLInputElement,
      "123456",
    );
    await changeInput(
      page.container.querySelector("#adminNewPassword") as HTMLInputElement,
      "New-password-123!",
    );
    await changeInput(
      page.container.querySelector("#adminConfirmPassword") as HTMLInputElement,
      "different-password",
    );
    await click(findButton(page.container, "ยืนยันและเปลี่ยนรหัสผ่าน"));
    await flushEffects();

    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(page.container.textContent).toContain(
      "รหัสผ่านใหม่ทั้งสองช่องต้องตรงกัน",
    );

    await page.unmount();
  });

  it("requires an OTP before changing the password", async () => {
    const page = await mountAdminPage(<AdminPasswordSecurityCard />);

    await click(findButton(page.container, "เปลี่ยนรหัสผ่าน"));
    await changeInput(
      page.container.querySelector("#adminNewPassword") as HTMLInputElement,
      "New-password-123!",
    );
    await changeInput(
      page.container.querySelector("#adminConfirmPassword") as HTMLInputElement,
      "New-password-123!",
    );
    await click(findButton(page.container, "ยืนยันและเปลี่ยนรหัสผ่าน"));
    await flushEffects();

    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(page.container.textContent).toContain("รหัส OTP ต้องเป็นตัวเลข 6 หลัก");

    await page.unmount();
  });

  it("shows password requirements in the modal", async () => {
    const page = await mountAdminPage(<AdminPasswordSecurityCard />);

    await openPasswordModal(page.container);

    expect(page.container.textContent).toContain(
      "รหัสผ่านต้องมีอย่างน้อย 8 ตัว",
    );
    expect(page.container.textContent).toContain("ห้ามเว้นวรรค");
    expect(page.container.textContent).toContain(
      "ตัวอักษรภาษาอังกฤษพิมพ์เล็ก เช่น a-z",
    );
    expect(page.container.textContent).toContain(
      "ตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ เช่น A-Z",
    );
    expect(page.container.textContent).toContain("ตัวเลข เช่น 0-9");
    expect(page.container.textContent).toContain("สัญลักษณ์พิเศษ เช่น ! @ # $");

    await page.unmount();
  });

  it("blocks invalid password submissions before calling Supabase Auth", async () => {
    const invalidCases = [
      {
        error: "รหัส OTP ต้องเป็นตัวเลข 6 หลัก",
        newPassword: "ValidPass1!",
        otp: "12345",
      },
      {
        error: "รหัส OTP ต้องเป็นตัวเลข 6 หลัก",
        newPassword: "ValidPass1!",
        otp: "12345a",
      },
      {
        error: "กรอกรหัสผ่านใหม่",
        newPassword: "",
      },
      {
        error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร",
        newPassword: "Aa1!",
      },
      {
        error: "รหัสผ่านใหม่ต้องไม่เกิน 128 ตัวอักษร",
        newPassword: `Aa1!${"a".repeat(125)}`,
      },
      {
        error: "รหัสผ่านใหม่ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และสัญลักษณ์ ห้ามเว้นวรรค",
        newPassword: "Aa1!aaaaก",
      },
      {
        error: "รหัสผ่านใหม่ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และสัญลักษณ์ ห้ามเว้นวรรค",
        newPassword: "Valid Pass1!",
      },
      {
        error: "รหัสผ่านใหม่ต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว",
        newPassword: "AA1!AAAA",
      },
      {
        error: "รหัสผ่านใหม่ต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว",
        newPassword: "aa1!aaaa",
      },
      {
        error: "รหัสผ่านใหม่ต้องมีตัวเลขอย่างน้อย 1 ตัว",
        newPassword: "Aa!!aaaa",
      },
      {
        error: "รหัสผ่านใหม่ต้องมีสัญลักษณ์อย่างน้อย 1 ตัว",
        newPassword: "Aa11aaaa",
      },
      {
        confirmPassword: "",
        error: "กรอกยืนยันรหัสผ่านใหม่",
        newPassword: "ValidPass1!",
      },
    ];

    for (const invalidCase of invalidCases) {
      const page = await mountAdminPage(<AdminPasswordSecurityCard />);

      mocks.readAdminAccessToken.mockClear();
      mocks.verifyOtp.mockClear();
      mocks.updateUser.mockClear();

      await openPasswordModal(page.container);
      await submitPasswordChange(page.container, invalidCase);

      expect(page.container.textContent).toContain(invalidCase.error);
      expect(mocks.readAdminAccessToken).not.toHaveBeenCalled();
      expect(mocks.verifyOtp).not.toHaveBeenCalled();
      expect(mocks.updateUser).not.toHaveBeenCalled();

      await page.unmount();
    }
  });

  it("redirects to login when the browser session is missing", async () => {
    mocks.readAdminAccessToken.mockResolvedValue(null);
    const page = await mountAdminPage(<AdminPasswordSecurityCard />);

    await click(findButton(page.container, "เปลี่ยนรหัสผ่าน"));
    await click(findButton(page.container, "ส่งรหัส OTP ไปอีเมล"));
    await flushEffects();

    expect(mocks.replace).toHaveBeenCalledWith("/admin/login");
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();

    await page.unmount();
  });
});
