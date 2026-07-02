/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

import {
  changeInput,
  click,
  flushEffects,
  makeJsonResponse,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  replace: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithPassword: vi.fn(),
}));

type TurnstileRenderOptions = {
  "error-callback": (errorCode?: string) => boolean;
  "expired-callback": () => void;
  action?: string;
  callback: (token: string) => void;
  size?: string;
  sitekey: string;
  theme?: string;
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createBrowserHomeConfigClient: () => ({
    auth: {
      getSession: mocks.getSession,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      signInWithPassword: mocks.signInWithPassword,
    },
  }),
}));

import {
  AdminLoginForm,
  getAdminResetPasswordRedirectUrl,
} from "../admin-login-form";

const originalNodeEnv = process.env.NODE_ENV;

describe("AdminLoginForm", () => {
  beforeEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    window.history.replaceState(null, "", "/admin/login");
    mocks.getSession.mockReset();
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mocks.replace.mockReset();
    mocks.resetPasswordForEmail.mockReset();
    mocks.signInWithPassword.mockReset();
    mocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeJsonResponse({
          body: { bypassed: true, verified: true },
        }),
      ),
    );
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function installTurnstileMock() {
    let renderOptions: TurnstileRenderOptions | null = null;
    const turnstile = {
      remove: vi.fn(),
      render: vi.fn(
        (_container: HTMLElement, options: TurnstileRenderOptions) => {
          renderOptions = options;

          return "widget-id";
        },
      ),
      reset: vi.fn(),
    };

    vi.stubGlobal("turnstile", turnstile);

    return {
      getRenderOptions() {
        if (!renderOptions) {
          throw new Error("Turnstile widget was not rendered.");
        }

        return renderOptions;
      },
      turnstile,
    };
  }

  function findButton(container: HTMLElement, label: string): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll("button")).find((item) =>
      item.textContent?.includes(label),
    );

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Button not found: ${label}`);
    }

    return button;
  }

  it("falls back to the current origin when the configured site URL is not https", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://www.baanpartypattaya.com");

    expect(getAdminResetPasswordRedirectUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/admin/reset-password",
    );
  });

  it("redirects authenticated admins away from the login page", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "admin-token" } },
      error: null,
    });

    const page = await mountAdminPage(<AdminLoginForm />);
    await flushEffects();

    expect(mocks.replace).toHaveBeenCalledWith("/admin/sections");
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();

    await page.unmount();
  });

  it("shows the admin access error passed from an auth redirect", async () => {
    window.history.replaceState(
      null,
      "",
      "/admin/login?error=admin-access",
    );

    const page = await mountAdminPage(<AdminLoginForm />);
    await flushEffects();

    expect(page.container.textContent).toContain(
      "เซสชันหมดอายุหรือบัญชีนี้ยังไม่มีสิทธิ์แอดมิน กรุณาเข้าสู่ระบบอีกครั้ง",
    );
    expect(mocks.replace).not.toHaveBeenCalled();

    await page.unmount();
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

  it("sends an admin password reset email from the forgot password form", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.baanpartypattaya.com");
    const page = await mountAdminPage(<AdminLoginForm />);

    await click(findButton(page.container, "ลืมรหัสผ่าน"));
    await changeInput(
      page.container.querySelector("input[name='email']") as HTMLInputElement,
      " admin@example.com ",
    );
    await click(findButton(page.container, "ส่งลิงก์รีเซ็ตรหัสผ่าน"));
    await flushEffects();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/admin/login/turnstile",
      expect.objectContaining({
        body: JSON.stringify({ token: "" }),
        method: "POST",
      }),
    );
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "admin@example.com",
      { redirectTo: "https://www.baanpartypattaya.com/admin/reset-password" },
    );
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(page.container.textContent).toContain(
      "ถ้าอีเมลนี้อยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้",
    );

    await page.unmount();
  });

  it("shows an error when Supabase rejects the password reset email", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: "User not found" },
    });
    const page = await mountAdminPage(<AdminLoginForm />);

    await click(findButton(page.container, "ลืมรหัสผ่าน"));
    await changeInput(
      page.container.querySelector("input[name='email']") as HTMLInputElement,
      "missing@example.com",
    );
    await click(findButton(page.container, "ส่งลิงก์รีเซ็ตรหัสผ่าน"));
    await flushEffects();

    expect(page.container.textContent).toContain("ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้");
    expect(page.container.textContent).not.toContain("ถ้าอีเมลนี้อยู่ในระบบ");
    expect(page.container.textContent).not.toContain("User not found");

    await page.unmount();
  });

  it("does not call Supabase when Turnstile is configured but unsolved", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    installTurnstileMock();

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
    await changeInput(passwordInput, "correct-password");
    await click(submitButton);
    await flushEffects();

    expect(page.container.textContent).toContain(
      "กรุณายืนยันตัวตนก่อนเข้าสู่ระบบ",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();

    await page.unmount();
  });

  it("calls Supabase only after Turnstile verification succeeds", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    const fetchMock = vi.fn().mockResolvedValue(
      makeJsonResponse({
        body: { bypassed: false, verified: true },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    const { getRenderOptions } = installTurnstileMock();

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
    await changeInput(passwordInput, "correct-password");
    await act(async () => {
      getRenderOptions().callback("challenge-token");
    });
    await click(submitButton);
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/login/turnstile",
      expect.objectContaining({
        body: JSON.stringify({ token: "challenge-token" }),
        method: "POST",
      }),
    );
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "correct-password",
    });
    expect(mocks.replace).toHaveBeenCalledWith("/admin/sections");

    await page.unmount();
  });

  it("renders Turnstile with the admin login widget configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    const { getRenderOptions } = installTurnstileMock();

    const page = await mountAdminPage(<AdminLoginForm />);

    expect(getRenderOptions()).toMatchObject({
      action: "admin_login",
      size: "flexible",
      sitekey: "site-key",
      theme: "auto",
    });
    expect(page.container.textContent).toContain(
      "ยืนยันว่าเป็นผู้ใช้งานจริงก่อนเข้าสู่ระบบ",
    );

    await page.unmount();
  });

  it("shows a Thai Turnstile error instead of raw provider details", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeJsonResponse({
          body: { error: "invalid-input-response" },
          status: 403,
        }),
      ),
    );
    const { getRenderOptions, turnstile } = installTurnstileMock();

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
    await changeInput(passwordInput, "correct-password");
    await act(async () => {
      getRenderOptions().callback("challenge-token");
    });
    await click(submitButton);
    await flushEffects();

    expect(page.container.textContent).toContain(
      "ยืนยันตัวตนไม่สำเร็จ กรุณาลองอีกครั้ง",
    );
    expect(page.container.textContent).not.toContain("invalid-input-response");
    expect(turnstile.reset).toHaveBeenCalledWith("widget-id");
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();

    await page.unmount();
  });

  it("uses the development server bypass without rendering a Turnstile widget", async () => {
    process.env.NODE_ENV = "development";
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    const fetchMock = vi.fn().mockResolvedValue(
      makeJsonResponse({
        body: { bypassed: true, verified: true },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    const { turnstile } = installTurnstileMock();

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
    await changeInput(passwordInput, "correct-password");
    await click(submitButton);
    await flushEffects();

    expect(turnstile.render).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/login/turnstile",
      expect.objectContaining({
        body: JSON.stringify({ token: "" }),
        method: "POST",
      }),
    );
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "correct-password",
    });

    await page.unmount();
  });

  it("handles Turnstile widget errors so Cloudflare does not throw an extra console error", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    const { getRenderOptions } = installTurnstileMock();

    const page = await mountAdminPage(<AdminLoginForm />);

    let handled = false;
    await act(async () => {
      handled = getRenderOptions()["error-callback"]("300030");
    });

    expect(handled).toBe(true);
    expect(page.container.textContent).toContain(
      "ยืนยันตัวตนไม่สำเร็จ กรุณาลองอีกครั้ง",
    );

    await page.unmount();
  });
});
