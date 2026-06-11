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
  replace: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createBrowserHomeConfigClient: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
    },
  }),
}));

import { AdminLoginForm } from "../admin-login-form";

describe("AdminLoginForm", () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.signInWithPassword.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a Thai message for invalid login credentials", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const page = await mountAdminPage(<AdminLoginForm />);
    const emailInput = page.container.querySelector(
      "input[name='email']",
    ) as HTMLInputElement;
    const passwordInput = page.container.querySelector(
      "input[name='password']",
    ) as HTMLInputElement;
    const submitButton = page.container.querySelector(
      "button[type='submit']",
    ) as HTMLButtonElement;

    await changeInput(emailInput, "admin@example.com");
    await changeInput(passwordInput, "wrong-password");
    await click(submitButton);
    await flushEffects();

    expect(page.container.textContent).toContain(
      "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง",
    );
    expect(page.container.textContent).not.toContain("Invalid login credentials");
    expect(mocks.replace).not.toHaveBeenCalled();

    await page.unmount();
  });
});
