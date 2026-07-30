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
  { id: "702", title: "Villa DV-702" },
  { id: "105", title: "Villa DV-105" },
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
      "button[aria-label='เลื่อนไปซ้าย Villa DV-702']",
    ) as HTMLButtonElement | null;
    const firstHouseRight = page.container.querySelector(
      "button[aria-label='เลื่อนไปขวา Villa DV-702']",
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
      "button[aria-label='เลื่อนไปขวา Villa DV-105']",
    ) as HTMLButtonElement | null;

    expect(finalHouseRight?.disabled).toBe(true);

    await click(
      page.container.querySelector(
        "button[aria-label='เลื่อนไปขวา Villa DV-702']",
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
        "button[aria-label='เลื่อนไปขวา Villa DV-702']",
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
        "button[aria-label='เลื่อนไปขวา Villa DV-702']",
      ) as HTMLButtonElement,
    );
    act(() => {
      replaceHouses?.([
        { id: "702", title: "Villa DV-702" },
        { id: "105", title: "Villa DV-105" },
        { id: "303", title: "Villa DV-303" },
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
