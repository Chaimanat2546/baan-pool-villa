/**
 * @vitest-environment jsdom
 */
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flushEffects, makeJsonResponse } from "@/components/admin/__tests__/admin-page-dom-test-utils";

const mocks = vi.hoisted(() => ({
  readAdminAccessToken: vi.fn(),
  replace: vi.fn(),
  router: { replace: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

import {
  SettingsDirtyStateProvider,
  useSettingsDirtyState,
} from "../settings-dirty-state";
import {
  useAdminSettingsSection,
  type AdminSettingsSectionState,
} from "../use-admin-settings-section";

interface ThemeDraft {
  primaryColor: string;
}

const options = {
  buildRequest: (draft: ThemeDraft) => ({
    body: JSON.stringify(draft),
    headers: { "Content-Type": "application/json" },
  }),
  makeSnapshot: (draft: ThemeDraft) => JSON.stringify(draft),
  mapResponse: (value: unknown): ThemeDraft =>
    (value as { settings: ThemeDraft }).settings,
  section: "theme" as const,
  validate: () => [],
};

async function mountHook() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let current: AdminSettingsSectionState<ThemeDraft> | null = null;
  let registeredDirty = false;

  function Probe() {
    current = useAdminSettingsSection(options);
    registeredDirty = useSettingsDirtyState().isDirty;
    return null;
  }

  act(() => {
    root.render(
      <SettingsDirtyStateProvider>
        <Probe />
      </SettingsDirtyStateProvider>,
    );
  });
  await flushEffects();

  return {
    get current() {
      return current as AdminSettingsSectionState<ThemeDraft>;
    },
    get registeredDirty() {
      return registeredDirty;
    },
    async unmount() {
      act(() => root.unmount());
      await flushEffects();
      container.remove();
    },
  };
}

describe("useAdminSettingsSection", () => {
  beforeEach(() => {
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.replace.mockReset();
    mocks.router.replace = mocks.replace;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads once, tracks the draft snapshot, saves once, and registers dirty state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({ body: { settings: { primaryColor: "#000000" } } }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          body: {
            settings: { primaryColor: "#112233" },
            verified: true,
            warnings: [],
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const hook = await mountHook();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/site-settings/theme",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
    expect(hook.current.hasUnsavedChanges).toBe(false);

    act(() => hook.current.updateDraft({ primaryColor: "#112233" }));
    expect(hook.current.hasUnsavedChanges).toBe(true);
    expect(hook.registeredDirty).toBe(true);

    await act(async () => hook.current.save());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/site-settings/theme",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(hook.current.draft).toEqual({ primaryColor: "#112233" });
    expect(hook.current.hasUnsavedChanges).toBe(false);
    expect(hook.registeredDirty).toBe(false);
    expect(hook.current.errors).toEqual([]);

    await hook.unmount();
  });

  it("keeps a committed unverified save successful and exposes its warnings", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          makeJsonResponse({ body: { settings: { primaryColor: "#000000" } } }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse({
            body: {
              settings: { primaryColor: "#445566" },
              verified: false,
              warnings: ["Settings were saved but could not be reloaded."],
            },
          }),
        ),
    );

    const hook = await mountHook();
    act(() => hook.current.updateDraft({ primaryColor: "#445566" }));
    await act(async () => hook.current.save());

    expect(hook.current.hasUnsavedChanges).toBe(false);
    expect(hook.current.errors).toEqual([]);
    expect(hook.current.warnings).toEqual([
      "Settings were saved but could not be reloaded.",
    ]);
    expect(hook.current.notice).not.toBeNull();

    await hook.unmount();
  });

  it("redirects only auth failures and keeps other API failures inline", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          makeJsonResponse({ body: { error: "Unauthorized" }, status: 401 }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse({ body: { error: "Storage unavailable" }, status: 403 }),
        ),
    );

    const authHook = await mountHook();
    expect(mocks.replace).toHaveBeenCalledWith("/admin/login");
    await authHook.unmount();

    mocks.replace.mockClear();
    const inlineHook = await mountHook();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(inlineHook.current.errors).toEqual(["Storage unavailable"]);
    await inlineHook.unmount();
  });

  it("clears dirty registration when its editor unmounts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeJsonResponse({ body: { settings: { primaryColor: "#000000" } } }),
      ),
    );
    const container = document.createElement("div");
    const root = createRoot(container);
    let dirty = false;
    let state: AdminSettingsSectionState<ThemeDraft> | null = null;

    function Observer() {
      dirty = useSettingsDirtyState().isDirty;
      return null;
    }

    function Editor() {
      state = useAdminSettingsSection(options);
      return null;
    }

    function App({ showEditor }: { showEditor: boolean }) {
      return (
        <SettingsDirtyStateProvider>
          <Observer />
          {showEditor ? <Editor /> : null}
        </SettingsDirtyStateProvider>
      );
    }

    act(() => root.render(<App showEditor />));
    await flushEffects();
    act(() => state?.updateDraft({ primaryColor: "#abcdef" }));
    expect(dirty).toBe(true);

    act(() => root.render(<App showEditor={false} />));
    expect(dirty).toBe(false);

    act(() => root.unmount());
  });
});
