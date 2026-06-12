/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminFeedback } from "../admin-feedback";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("AdminFeedback", () => {
  const originalScrollIntoView = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "scrollIntoView",
  );
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
  });

  afterEach(() => {
    if (originalScrollIntoView) {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollIntoView",
        originalScrollIntoView,
      );
    } else {
      delete (HTMLElement.prototype as { scrollIntoView?: unknown })
        .scrollIntoView;
    }

    vi.restoreAllMocks();
  });

  it("moves the viewport to newly rendered error messages", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AdminFeedback
          errors={[]}
          errorTitle="แก้รายการเหล่านี้ก่อนบันทึก:"
          notice={null}
        />,
      );
    });
    await flushEffects();

    expect(scrollIntoView).not.toHaveBeenCalled();

    act(() => {
      root.render(
        <AdminFeedback
          errors={["ชื่อเว็บต้องไม่ว่าง"]}
          errorTitle="แก้รายการเหล่านี้ก่อนบันทึก:"
          notice={null}
        />,
      );
    });
    await flushEffects();

    const alert = container.querySelector("[role='alert']");

    expect(alert).not.toBeNull();
    expect(alert?.className).toContain("scroll-mt-52");
    expect(alert?.className).toContain("lg:scroll-mt-48");
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(document.activeElement).toBe(alert);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("moves the viewport to newly rendered success messages", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AdminFeedback
          errors={[]}
          errorTitle="แก้รายการเหล่านี้ก่อนบันทึก:"
          notice="บันทึกสำเร็จ"
        />,
      );
    });
    await flushEffects();

    const status = container.querySelector("[role='status']");

    expect(status).not.toBeNull();
    expect(status?.className).toContain("scroll-mt-52");
    expect(status?.className).toContain("lg:scroll-mt-48");
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(document.activeElement).toBe(status);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
