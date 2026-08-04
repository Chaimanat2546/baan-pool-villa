/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  changeInput,
  click,
  flushEffects,
  makeJsonResponse,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const mocks = vi.hoisted(() => ({
  readToken: vi.fn(),
  readState: vi.fn(),
  replace: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readToken,
  readAdminSessionState: mocks.readState,
}));
vi.mock("@/lib/home-sections/supabase", () => ({
  createBrowserHomeConfigClient: () => ({
    auth: { signOut: mocks.signOut },
  }),
}));

import { AdminForcedPasswordChangeForm } from "../admin-forced-password-change-form";

describe("AdminForcedPasswordChangeForm", () => {
  beforeEach(() => {
    mocks.readToken.mockReset();
    mocks.readToken.mockResolvedValue("browser-token");
    mocks.readState.mockReset();
    mocks.readState.mockResolvedValue("forced");
    mocks.replace.mockReset();
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue({ error: null });
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => OPERATION_ID) });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeJsonResponse({
          body: { ok: true, code: "password_changed", clearSession: true },
        }),
      ),
    );
  });

  it("redirects an already-active admin away from the forced page", async () => {
    mocks.readState.mockResolvedValue("active");

    const page = await mountAdminPage(<AdminForcedPasswordChangeForm />);
    await flushEffects();

    expect(mocks.replace).toHaveBeenCalledWith("/admin/sections");
    await page.unmount();
  });

  it("validates password reuse before sending a request", async () => {
    const page = await mountAdminPage(<AdminForcedPasswordChangeForm />);
    const inputs = page.container.querySelectorAll("input");
    await changeInput(inputs[0] as HTMLInputElement, "TempPass1!");
    await changeInput(inputs[1] as HTMLInputElement, "TempPass1!");
    await changeInput(inputs[2] as HTMLInputElement, "TempPass1!");
    await click(page.container.querySelector("button[type='submit']") as HTMLButtonElement);

    expect(page.container.textContent).toContain(
      "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านชั่วคราว",
    );
    expect(fetch).not.toHaveBeenCalled();
    await page.unmount();
  });

  it("retains one browser UUID for an in-flight retry and clears local session on success", async () => {
    const page = await mountAdminPage(<AdminForcedPasswordChangeForm />);
    const inputs = page.container.querySelectorAll("input");
    await changeInput(inputs[0] as HTMLInputElement, "TempPass1!");
    await changeInput(inputs[1] as HTMLInputElement, "NewPass2@");
    await changeInput(inputs[2] as HTMLInputElement, "NewPass2@");
    await click(page.container.querySelector("button[type='submit']") as HTMLButtonElement);
    await flushEffects();

    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/change-password",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer browser-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operationId: OPERATION_ID,
          currentPassword: "TempPass1!",
          newPassword: "NewPass2@",
          confirmPassword: "NewPass2@",
        }),
      }),
    );
    expect(crypto.randomUUID).toHaveBeenCalledOnce();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.replace).toHaveBeenCalledWith("/admin/login?password=changed");
    await page.unmount();
  });

  it("keeps the forced page for a wrong temporary password", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeJsonResponse({
          body: {
            ok: false,
            code: "temporary_password_invalid",
            clearSession: false,
          },
          status: 401,
        }),
      ),
    );
    const page = await mountAdminPage(<AdminForcedPasswordChangeForm />);
    const inputs = page.container.querySelectorAll("input");
    await changeInput(inputs[0] as HTMLInputElement, "WrongPass1!");
    await changeInput(inputs[1] as HTMLInputElement, "NewPass2@");
    await changeInput(inputs[2] as HTMLInputElement, "NewPass2@");
    await click(page.container.querySelector("button[type='submit']") as HTMLButtonElement);

    expect(page.container.textContent).toContain("รหัสผ่านชั่วคราวไม่ถูกต้อง");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    await page.unmount();
  });

  it("uses a new operation UUID after a definitive wrong-password response", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce(OPERATION_ID)
        .mockReturnValueOnce("44444444-4444-4444-8444-444444444444"),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          body: {
            ok: false,
            code: "temporary_password_invalid",
            clearSession: false,
          },
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          body: { ok: true, code: "password_changed", clearSession: true },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const page = await mountAdminPage(<AdminForcedPasswordChangeForm />);
    const inputs = page.container.querySelectorAll("input");
    await changeInput(inputs[0] as HTMLInputElement, "WrongPass1!");
    await changeInput(inputs[1] as HTMLInputElement, "NewPass2@");
    await changeInput(inputs[2] as HTMLInputElement, "NewPass2@");
    const submit = page.container.querySelector(
      "button[type='submit']",
    ) as HTMLButtonElement;

    await click(submit);
    await changeInput(inputs[0] as HTMLInputElement, "TempPass1!");
    await click(submit);

    const bodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String((init as RequestInit).body)),
    );
    expect(bodies.map((body) => body.operationId)).toEqual([
      OPERATION_ID,
      "44444444-4444-4444-8444-444444444444",
    ]);
    await page.unmount();
  });
});
