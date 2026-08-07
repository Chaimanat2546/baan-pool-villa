/**
 * @vitest-environment jsdom
 */
import { act } from "react";
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

const options: Parameters<typeof useAdminSettingsSection<ThemeDraft>>[0] = {
  buildRequest: (draft: ThemeDraft) => ({
    body: JSON.stringify(draft),
    headers: { "Content-Type": "application/json" },
  }),
  makeSnapshot: (draft: ThemeDraft) => JSON.stringify(draft),
  mapResponse: (value: unknown): ThemeDraft =>
    (value as { settings: ThemeDraft }).settings,
  section: "theme" as const,
  validate: (): string[] => [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function mountHook(initialOptions = options) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let currentOptions = initialOptions;
  let current: AdminSettingsSectionState<ThemeDraft> | null = null;
  let registeredDirty = false;

  function Probe() {
    current = useAdminSettingsSection(currentOptions);
    registeredDirty = useSettingsDirtyState().isDirty;
    return null;
  }

  function renderProbe() {
    root.render(
      <SettingsDirtyStateProvider>
        <Probe />
      </SettingsDirtyStateProvider>,
    );
  }

  act(renderProbe);
  await flushEffects();

  return {
    get current() {
      return current as AdminSettingsSectionState<ThemeDraft>;
    },
    get registeredDirty() {
      return registeredDirty;
    },
    async rerender(nextOptions: typeof options) {
      currentOptions = nextOptions;
      act(renderProbe);
      await flushEffects();
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

  it("blocks PATCH when client validation fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeJsonResponse({ body: { settings: { primaryColor: "#000000" } } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const hook = await mountHook({
      ...options,
      validate: () => ["Invalid color"],
    });

    act(() => hook.current.updateDraft({ primaryColor: "invalid" }));
    await act(async () => hook.current.save());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hook.current.errors).toEqual(["Invalid color"]);
    await hook.unmount();
  });

  it("does not reload when inline callback identities change", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeJsonResponse({ body: { settings: { primaryColor: "#000000" } } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const hook = await mountHook();

    await hook.rerender({
      buildRequest: (draft) => ({ body: JSON.stringify(draft) }),
      makeSnapshot: (draft) => JSON.stringify(draft),
      mapResponse: (value) => (value as { settings: ThemeDraft }).settings,
      section: "theme",
      validate: () => [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await hook.unmount();
  });

  it("ignores an older GET that resolves after a newer section load", async () => {
    const oldLoad = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(oldLoad.promise)
      .mockResolvedValueOnce(
        makeJsonResponse({ body: { settings: { primaryColor: "#222222" } } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const hook = await mountHook();

    await hook.rerender({ ...options, section: "brand" });
    expect(hook.current.draft).toEqual({ primaryColor: "#222222" });

    oldLoad.resolve(
      makeJsonResponse({ body: { settings: { primaryColor: "#111111" } } }),
    );
    await flushEffects();

    expect(hook.current.draft).toEqual({ primaryColor: "#222222" });
    await hook.unmount();
  });

  it("allows only one PATCH when save is called twice rapidly", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({ body: { settings: { primaryColor: "#000000" } } }),
      )
      .mockResolvedValue(
        makeJsonResponse({ body: { settings: { primaryColor: "#333333" } } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const hook = await mountHook();
    act(() => hook.current.updateDraft({ primaryColor: "#333333" }));

    await act(async () => {
      await Promise.all([hook.current.save(), hook.current.save()]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH"),
    ).toHaveLength(1);
    await hook.unmount();
  });

  it("preserves edits made while a save is in flight", async () => {
    const pendingSave = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({ body: { settings: { primaryColor: "#000000" } } }),
      )
      .mockReturnValueOnce(pendingSave.promise);
    vi.stubGlobal("fetch", fetchMock);
    const hook = await mountHook();
    act(() => hook.current.updateDraft({ primaryColor: "#444444" }));

    let savePromise!: Promise<void>;
    act(() => {
      savePromise = hook.current.save();
    });
    await flushEffects();
    act(() => hook.current.updateDraft({ primaryColor: "#555555" }));
    pendingSave.resolve(
      makeJsonResponse({ body: { settings: { primaryColor: "#444444" } } }),
    );
    await act(async () => savePromise);

    expect(hook.current.draft).toEqual({ primaryColor: "#555555" });
    expect(hook.current.hasUnsavedChanges).toBe(true);
    await hook.unmount();
  });

  it("ignores an async GET completion after unmount", async () => {
    const pendingLoad = deferred<Response>();
    const mapResponse = vi.fn(options.mapResponse);
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pendingLoad.promise));
    const hook = await mountHook({ ...options, mapResponse });

    await hook.unmount();
    pendingLoad.resolve(
      makeJsonResponse({ body: { settings: { primaryColor: "#999999" } } }),
    );
    await flushEffects();

    expect(mapResponse).not.toHaveBeenCalled();
  });

  it("clears the previous draft while the next section loads and blocks save", async () => {
    const nextLoad = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({ body: { settings: { primaryColor: "#101010" } } }),
      )
      .mockReturnValueOnce(nextLoad.promise);
    vi.stubGlobal("fetch", fetchMock);
    const hook = await mountHook();

    await hook.rerender({ ...options, section: "brand" });

    expect(hook.current.draft).toBeNull();
    expect(hook.current.hasUnsavedChanges).toBe(false);
    expect(hook.current.isLoading).toBe(true);
    await act(async () => hook.current.save());
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH"),
    ).toHaveLength(0);

    await hook.unmount();
  });

  it("allows the new section to save while the previous PATCH is pending", async () => {
    const oldSave = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({ body: { settings: { primaryColor: "#111111" } } }),
      )
      .mockReturnValueOnce(oldSave.promise)
      .mockResolvedValueOnce(
        makeJsonResponse({ body: { settings: { primaryColor: "#222222" } } }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ body: { settings: { primaryColor: "#232323" } } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const hook = await mountHook();
    act(() => hook.current.updateDraft({ primaryColor: "#121212" }));
    const oldSavePromise = hook.current.save();
    await flushEffects();

    await hook.rerender({ ...options, section: "brand" });
    act(() => hook.current.updateDraft({ primaryColor: "#232323" }));
    await act(async () => hook.current.save());

    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH"),
    ).toHaveLength(2);
    expect(hook.current.draft).toEqual({ primaryColor: "#232323" });
    expect(hook.current.hasUnsavedChanges).toBe(false);

    oldSave.resolve(
      makeJsonResponse({ body: { settings: { primaryColor: "#121212" } } }),
    );
    await act(async () => oldSavePromise);
    await hook.unmount();
  });

  it("ignores a pending PATCH after navigating from A to B and back to A", async () => {
    const oldSave = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({ body: { settings: { primaryColor: "#111111" } } }),
      )
      .mockReturnValueOnce(oldSave.promise)
      .mockResolvedValueOnce(
        makeJsonResponse({ body: { settings: { primaryColor: "#222222" } } }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ body: { settings: { primaryColor: "#333333" } } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const hook = await mountHook();
    act(() => hook.current.updateDraft({ primaryColor: "#121212" }));
    const oldSavePromise = hook.current.save();
    await flushEffects();

    await hook.rerender({ ...options, section: "brand" });
    await hook.rerender(options);
    expect(hook.current.draft).toEqual({ primaryColor: "#333333" });

    oldSave.resolve(
      makeJsonResponse({
        body: {
          settings: { primaryColor: "#121212" },
          warnings: ["Old save warning"],
        },
      }),
    );
    await act(async () => oldSavePromise);

    expect(hook.current.draft).toEqual({ primaryColor: "#333333" });
    expect(hook.current.hasUnsavedChanges).toBe(false);
    expect(hook.current.warnings).toEqual([]);
    expect(hook.current.notice).toBeNull();
    await hook.unmount();
  });

  it("ignores a PATCH completion after unmount", async () => {
    const pendingSave = deferred<Response>();
    const mapResponse = vi.fn(options.mapResponse);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          makeJsonResponse({ body: { settings: { primaryColor: "#111111" } } }),
        )
        .mockReturnValueOnce(pendingSave.promise),
    );
    const hook = await mountHook({ ...options, mapResponse });
    act(() => hook.current.updateDraft({ primaryColor: "#121212" }));
    const savePromise = hook.current.save();
    await flushEffects();
    mapResponse.mockClear();

    await hook.unmount();
    pendingSave.resolve(
      makeJsonResponse({ body: { settings: { primaryColor: "#121212" } } }),
    );
    await savePromise;

    expect(mapResponse).not.toHaveBeenCalled();
  });
});
