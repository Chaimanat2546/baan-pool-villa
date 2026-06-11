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
  replace: vi.fn(),
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
      signInWithPassword: mocks.signInWithPassword,
    },
  }),
}));

import { AdminLoginForm } from "../admin-login-form";

const originalNodeEnv = process.env.NODE_ENV;

describe("AdminLoginForm", () => {
  beforeEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    mocks.replace.mockReset();
    mocks.signInWithPassword.mockReset();
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
