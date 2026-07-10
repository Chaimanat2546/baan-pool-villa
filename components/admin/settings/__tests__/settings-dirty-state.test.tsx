/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SettingsDirtyStateProvider,
  useSettingsDirtyState,
} from "../settings-dirty-state";
import { SettingsSectionHeader } from "../settings-section-header";

describe("SettingsDirtyStateProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers beforeunload only while dirty and removes it on cleanup", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const container = document.createElement("div");
    const root = createRoot(container);
    let setIsDirty: ((value: boolean) => void) | null = null;

    function Probe() {
      setIsDirty = useSettingsDirtyState().setIsDirty;
      return null;
    }

    act(() => root.render(<SettingsDirtyStateProvider><Probe /></SettingsDirtyStateProvider>));
    expect(add).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));

    act(() => setIsDirty?.(true));
    expect(add).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    act(() => setIsDirty?.(false));
    expect(remove).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    act(() => root.unmount());
  });

  it("renders the shared public-site link and section save button", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SettingsSectionHeader
          description="รายละเอียด"
          hasUnsavedChanges
          isSaving={false}
          onSave={vi.fn()}
          title="สีและธีม"
        />,
      );
    });

    expect(container.querySelector('a[href="/"]')?.getAttribute("target")).toBe("_blank");
    expect(container.textContent).not.toContain("รีเฟรช");
    expect(container.querySelector("button")?.textContent).toContain("บันทึกส่วนนี้");

    act(() => root.unmount());
  });
});
