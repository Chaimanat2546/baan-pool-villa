/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  changeInput,
  click,
  flushEffects,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  replace: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createBrowserHomeConfigClient: () => ({
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: mocks.signOut,
      updateUser: mocks.updateUser,
    },
  }),
}));

import { AdminResetPasswordForm } from "../admin-reset-password-form";

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((item) =>
    item.textContent?.includes(label),
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

describe("AdminResetPasswordForm", () => {
  beforeEach(() => {
    window.history.replaceState(
      null,
      "",
      "/admin/reset-password#type=recovery&access_token=recovery-token",
    );
    mocks.getSession.mockReset();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "recovery-token" } },
      error: null,
    });
    mocks.replace.mockReset();
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.updateUser.mockReset();
    mocks.updateUser.mockResolvedValue({ data: { user: { id: "admin-user" } }, error: null });
  });

  it("shows an invalid link message when the recovery marker is missing", async () => {
    window.history.replaceState(null, "", "/admin/reset-password");

    const page = await mountAdminPage(<AdminResetPasswordForm />);
    await flushEffects();

    expect(page.container.textContent).toContain(
      "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ",
    );
    await click(findButton(page.container, "กลับไปหน้าเข้าสู่ระบบ"));

    expect(mocks.replace).toHaveBeenCalledWith("/admin/login");
    expect(mocks.updateUser).not.toHaveBeenCalled();

    await page.unmount();
  });

  it("keeps the form locked when the recovery token does not match the session", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "current-session-token" } },
      error: null,
    });

    const page = await mountAdminPage(<AdminResetPasswordForm />);
    await flushEffects();

    expect(page.container.textContent).toContain(
      "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ",
    );
    expect(findButton(page.container, "ตั้งรหัสผ่านใหม่").disabled).toBe(true);
    expect(mocks.updateUser).not.toHaveBeenCalled();

    await page.unmount();
  });

  it("blocks invalid passwords before updating Supabase Auth", async () => {
    const page = await mountAdminPage(<AdminResetPasswordForm />);
    await flushEffects();

    expect(page.container.textContent).toContain(
      "รหัสผ่านต้องมีอย่างน้อย 8 ตัว",
    );
    expect(page.container.textContent).toContain("ห้ามเว้นวรรค");
    expect(page.container.textContent).toContain(
      "ตัวอักษรภาษาอังกฤษพิมพ์เล็ก เช่น a-z",
    );
    expect(page.container.textContent).toContain("สัญลักษณ์พิเศษ เช่น ! @ # $");

    await changeInput(
      page.container.querySelector("#adminResetNewPassword") as HTMLInputElement,
      "Valid Pass1!",
    );
    await changeInput(
      page.container.querySelector("#adminResetConfirmPassword") as HTMLInputElement,
      "Valid Pass1!",
    );
    await click(findButton(page.container, "ตั้งรหัสผ่านใหม่"));
    await flushEffects();
    await flushEffects();

    expect(page.container.textContent).toContain("ห้ามเว้นวรรค");
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();

    await page.unmount();
  });

  it("updates the password, signs out, and redirects to login", async () => {
    const page = await mountAdminPage(<AdminResetPasswordForm />);
    await flushEffects();

    await changeInput(
      page.container.querySelector("#adminResetNewPassword") as HTMLInputElement,
      "Newpassword123\\",
    );
    await changeInput(
      page.container.querySelector("#adminResetConfirmPassword") as HTMLInputElement,
      "Newpassword123\\",
    );
    await click(findButton(page.container, "ตั้งรหัสผ่านใหม่"));
    await flushEffects();

    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: "Newpassword123\\",
    });
    expect(mocks.signOut).toHaveBeenCalledWith();
    expect(mocks.replace).toHaveBeenCalledWith("/admin/login");

    await page.unmount();
  });

  it("clears the local session and does not redirect when sign out fails after reset", async () => {
    mocks.signOut
      .mockResolvedValueOnce({ error: { message: "Sign out failed" } })
      .mockResolvedValueOnce({ error: null });
    const page = await mountAdminPage(<AdminResetPasswordForm />);
    await flushEffects();

    await changeInput(
      page.container.querySelector("#adminResetNewPassword") as HTMLInputElement,
      "New-password-123!",
    );
    await changeInput(
      page.container.querySelector("#adminResetConfirmPassword") as HTMLInputElement,
      "New-password-123!",
    );
    await click(findButton(page.container, "ตั้งรหัสผ่านใหม่"));
    await flushEffects();

    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: "New-password-123!",
    });
    expect(mocks.signOut).toHaveBeenNthCalledWith(1);
    expect(mocks.signOut).toHaveBeenNthCalledWith(2, { scope: "local" });
    expect(page.container.textContent).toContain("Sign out failed");
    expect(mocks.replace).not.toHaveBeenCalledWith("/admin/login");

    await page.unmount();
  });

  it("does not sign out when Supabase rejects the new password", async () => {
    mocks.updateUser.mockResolvedValue({
      data: { user: null },
      error: { code: "same_password", message: "New password should be different from the old password." },
    });
    const page = await mountAdminPage(<AdminResetPasswordForm />);
    await flushEffects();

    await changeInput(
      page.container.querySelector("#adminResetNewPassword") as HTMLInputElement,
      "New-password-123!",
    );
    await changeInput(
      page.container.querySelector("#adminResetConfirmPassword") as HTMLInputElement,
      "New-password-123!",
    );
    await click(findButton(page.container, "ตั้งรหัสผ่านใหม่"));
    await flushEffects();

    expect(page.container.textContent).toContain("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalledWith("/admin/login");

    await page.unmount();
  });
});
