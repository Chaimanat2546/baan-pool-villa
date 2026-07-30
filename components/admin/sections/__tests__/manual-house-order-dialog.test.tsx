/**
 * @vitest-environment jsdom
 */
import { act, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  click,
  flushEffects,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

import { ManualHouseOrderDialog } from "../manual-house-order-dialog";

const houses = [
  { coverImage: null, id: "702", title: "Villa DV-702" },
  { coverImage: null, id: "105", title: "Villa DV-105" },
];

const housesWithCovers = [
  {
    coverImage: "https://images.example.com/custom-cover-702.jpg",
    id: "702",
    title: "Villa DV-702",
  },
  { coverImage: null, id: "105", title: "Villa DV-105" },
];

async function pressKey(key: string, shiftKey = false) {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key,
        shiftKey,
      }),
    );
  });
  await flushEffects();
}

function dragEvent(type: string) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const dataTransfer = {
    dropEffect: "none",
    effectAllowed: "all",
    setData: vi.fn(),
  };

  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  return event;
}

describe("ManualHouseOrderDialog", () => {
  let unmount: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await unmount?.();
    unmount = undefined;
  });

  it("moves a house right and confirms the pending order", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const page = await mountAdminPage(
      <ManualHouseOrderDialog
        houses={houses}
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        open
      />,
    );
    unmount = page.unmount;

    const dialog = page.container.querySelector("[role='dialog']");
    const dialogHeading = dialog?.querySelector("h2");

    expect(dialogHeading?.textContent).toBe("เรียงลำดับบ้าน");
    expect(dialog?.getAttribute("aria-labelledby")).toBe(dialogHeading?.id);
    const firstHouseLeft = page.container.querySelector(
      "button[aria-label='เลื่อนขึ้น Villa DV-702']",
    ) as HTMLButtonElement | null;
    const firstHouseRight = page.container.querySelector(
      "button[aria-label='เลื่อนลง Villa DV-702']",
    ) as HTMLButtonElement | null;

    expect(firstHouseLeft?.disabled).toBe(true);
    expect(firstHouseRight).not.toBeNull();

    await click(firstHouseRight as HTMLButtonElement);

    await click(
      Array.from(page.container.querySelectorAll("button")).find((button) => {
        return button.textContent?.includes("เสร็จสิ้น");
      }) as HTMLButtonElement,
    );

    expect(onConfirm).toHaveBeenCalledWith(["105", "702"]);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("shows a cover image or an accessible placeholder for each house card", async () => {
    const page = await mountAdminPage(
      <ManualHouseOrderDialog
        houses={housesWithCovers}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open
      />,
    );
    unmount = page.unmount;

    const cover = page.container.querySelector(
      "img[alt='รูปปก Villa DV-702']",
    ) as HTMLImageElement | null;
    const placeholder = page.container.querySelector(
      "[role='img'][aria-label='ไม่มีรูปปก Villa DV-105']",
    );

    expect(new URL(cover?.src ?? "", "https://example.com").searchParams.get("url")).toBe(
      "https://images.example.com/custom-cover-702.jpg",
    );
    expect(placeholder).not.toBeNull();
  });

  it("renders each house as a compact sortable row", async () => {
    const page = await mountAdminPage(
      <ManualHouseOrderDialog
        houses={housesWithCovers}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open
      />,
    );
    unmount = page.unmount;

    const row = page.container.querySelector(
      "article[data-house-id='702']",
    );
    const cover = page.container.querySelector(
      "img[alt='รูปปก Villa DV-702']",
    );
    const controls = page.container.querySelector(
      "button[aria-label='เลื่อนขึ้น Villa DV-702']",
    )?.parentElement;

    expect(row?.classList.contains("min-h-[72px]")).toBe(true);
    expect(cover?.classList.contains("size-14")).toBe(true);
    expect(controls?.classList.contains("shrink-0")).toBe(true);
  });

  it("shows a DV house id and vertical move controls", async () => {
    const page = await mountAdminPage(
      <ManualHouseOrderDialog
        houses={houses}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open
      />,
    );
    unmount = page.unmount;

    const firstRow = page.container.querySelector(
      "article[data-house-id='702']",
    );
    const moveUp = page.container.querySelector(
      "button[aria-label='เลื่อนขึ้น Villa DV-702']",
    ) as HTMLButtonElement | null;
    const moveDown = page.container.querySelector(
      "button[aria-label='เลื่อนลง Villa DV-702']",
    ) as HTMLButtonElement | null;

    expect(firstRow?.textContent).toContain("DV-702");
    expect(moveUp?.disabled).toBe(true);
    expect(moveDown).not.toBeNull();
  });

  it("reorders house cards through native drag and drop before confirmation", async () => {
    const onConfirm = vi.fn();
    const page = await mountAdminPage(
      <ManualHouseOrderDialog
        houses={houses}
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
        open
      />,
    );
    unmount = page.unmount;

    const source = page.container.querySelector(
      "article[data-house-id='702']",
    ) as HTMLElement;
    const target = page.container.querySelector(
      "article[data-house-id='105']",
    ) as HTMLElement;

    act(() => {
      source.dispatchEvent(dragEvent("dragstart"));
    });
    await flushEffects();
    act(() => {
      target.dispatchEvent(dragEvent("dragover"));
      target.dispatchEvent(dragEvent("drop"));
    });
    await flushEffects();

    expect(
      Array.from(
        page.container.querySelectorAll("article[data-house-id]"),
      ).map((card) => card.getAttribute("data-house-id")),
    ).toEqual(["105", "702"]);

    await click(
      Array.from(page.container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("เสร็จสิ้น"),
      ) as HTMLButtonElement,
    );

    expect(onConfirm).toHaveBeenCalledWith(["105", "702"]);
  });

  it("keeps confirmation pending when cancellation closes the dialog", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const page = await mountAdminPage(
      <ManualHouseOrderDialog
        houses={houses}
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        open
      />,
    );
    unmount = page.unmount;

    const finalHouseRight = page.container.querySelector(
      "button[aria-label='เลื่อนลง Villa DV-105']",
    ) as HTMLButtonElement | null;

    expect(finalHouseRight?.disabled).toBe(true);

    await click(
      page.container.querySelector(
        "button[aria-label='เลื่อนลง Villa DV-702']",
      ) as HTMLButtonElement,
    );
    await click(
      Array.from(page.container.querySelectorAll("button")).find((button) => {
        return button.textContent?.includes("ยกเลิก");
      }) as HTMLButtonElement,
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("moves focus inside, contains Tab, closes with Escape, and restores the launcher", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button onClick={() => setOpen(true)} type="button">
            Open ordering
          </button>
          <button type="button">Background action</button>
          <ManualHouseOrderDialog
            houses={houses}
            onConfirm={() => setOpen(false)}
            onOpenChange={setOpen}
            open={open}
          />
        </>
      );
    }

    const page = await mountAdminPage(<Harness />);
    unmount = page.unmount;
    const launcher = Array.from(page.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Open ordering",
    ) as HTMLButtonElement;

    launcher.focus();
    await click(launcher);

    const dialog = page.container.querySelector(
      "[role='dialog']",
    ) as HTMLElement;
    const cancelButton = Array.from(dialog.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("ยกเลิก"),
    ) as HTMLButtonElement;
    const confirmButton = Array.from(dialog.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("เสร็จสิ้น"),
    ) as HTMLButtonElement;
    const firstEnabledButton = dialog.querySelector(
      "button:not([disabled])",
    ) as HTMLButtonElement;

    expect(document.activeElement).toBe(cancelButton);
    expect(launcher.closest("[inert]")).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");

    confirmButton.focus();
    await pressKey("Tab");
    expect(document.activeElement).toBe(firstEnabledButton);

    firstEnabledButton.focus();
    await pressKey("Tab", true);
    expect(document.activeElement).toBe(confirmButton);

    await pressKey("Escape");

    expect(page.container.querySelector("[role='dialog']")).toBeNull();
    expect(document.activeElement).toBe(launcher);
    expect(launcher.closest("[inert]")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("discards a changed pending order when cancelled and reopened", async () => {
    const onConfirm = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(true);

      return (
        <>
          <button onClick={() => setOpen(true)} type="button">
            Open ordering
          </button>
          <ManualHouseOrderDialog
            houses={houses}
            onConfirm={onConfirm}
            onOpenChange={setOpen}
            open={open}
          />
        </>
      );
    }

    const page = await mountAdminPage(<Harness />);
    unmount = page.unmount;

    await click(
      page.container.querySelector(
        "button[aria-label='เลื่อนลง Villa DV-702']",
      ) as HTMLButtonElement,
    );
    await click(
      Array.from(page.container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("ยกเลิก"),
      ) as HTMLButtonElement,
    );
    await click(
      Array.from(page.container.querySelectorAll("button")).find(
        (button) => button.textContent === "Open ordering",
      ) as HTMLButtonElement,
    );
    await click(
      Array.from(page.container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("เสร็จสิ้น"),
      ) as HTMLButtonElement,
    );

    expect(onConfirm).toHaveBeenCalledWith(["702", "105"]);
  });

  it("resets the pending order when the source house ids change", async () => {
    const onConfirm = vi.fn();
    let replaceHouses:
      | ((nextHouses: typeof houses) => void)
      | undefined;

    function Harness() {
      const [sourceHouses, setSourceHouses] = useState(houses);
      replaceHouses = setSourceHouses;

      return (
        <ManualHouseOrderDialog
          houses={sourceHouses}
          onConfirm={onConfirm}
          onOpenChange={vi.fn()}
          open
        />
      );
    }

    const page = await mountAdminPage(<Harness />);
    unmount = page.unmount;

    await click(
      page.container.querySelector(
        "button[aria-label='เลื่อนลง Villa DV-702']",
      ) as HTMLButtonElement,
    );
    act(() => {
      replaceHouses?.([
        { coverImage: null, id: "702", title: "Villa DV-702" },
        { coverImage: null, id: "105", title: "Villa DV-105" },
        { coverImage: null, id: "303", title: "Villa DV-303" },
      ]);
    });
    await flushEffects();
    await click(
      Array.from(page.container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("เสร็จสิ้น"),
      ) as HTMLButtonElement,
    );

    expect(onConfirm).toHaveBeenCalledWith(["702", "105", "303"]);
  });
});
