// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import { BookingSidebar } from "../booking-sidebar";

const listing: VillaListing = {
  id: "66",
  zone: "jomtien",
  zoneLabel: "Jomtien",
  bedrooms: 4,
  bathrooms: 3,
  distanceToSea: "500m",
  price: 12000,
  people: 12,
  coverImage: null,
  amenities: [],
  poolType: "private",
};

const content: VillaDetailContent = {
  facts: [
    { label: "เวลาเช็คอิน", value: "14:00" },
    { label: "เวลาเช็คเอาต์", value: "12:00" },
  ],
  location: null,
  nearbyPlaces: [],
  sections: [],
  videos: [],
};

async function renderBookingSidebar() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <BookingSidebar
        content={content}
        listing={listing}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );
  });

  return {
    container,
    root,
    async cleanup() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("BookingSidebar", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
    document.body.innerHTML = "";
  });

  it("hides prototype-like calendar mock UI and keeps contact actions", () => {
    const markup = renderToStaticMarkup(
      <BookingSidebar
        content={content}
        listing={listing}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );

    expect(markup).not.toContain("October 2024");
    expect(markup).not.toContain("Mock FE");
    expect(markup).toContain("แชทเลย");
    expect(markup).toContain("จองผ่าน LINE");
  });

  it("uses the basic shadcn calendar caption and can return to the current month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T04:00:00.000Z"));
    const page = await renderBookingSidebar();

    expect(page.container.textContent).toContain("มิถุนายน");
    const currentDay = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("16 มิถุนายน 2569"),
    );

    expect(currentDay?.className).not.toContain("bg-[var(--site-primary)]");
    expect(currentDay?.className).not.toContain("linear-gradient");
    expect(currentDay?.className).toContain("border-[var(--site-primary)]");
    expect(currentDay?.className).toContain("ring-[var(--site-primary)]/20");

    await act(async () => {
      page.container
        .querySelector<HTMLButtonElement>('[aria-label="ดูเดือนถัดไป"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(page.container.textContent).toContain("กรกฎาคม");

    expect(page.container.querySelector(".rdp-months_dropdown")).toBeNull();
    expect(page.container.querySelector(".rdp-years_dropdown")).toBeNull();

    const todayButton = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.trim() === "วันนี้");

    expect(todayButton).not.toBeNull();
    expect(page.container.querySelector(".rdp-root")?.contains(todayButton ?? null)).toBe(
      true,
    );
    const calendarGrid = page.container.querySelector(".rdp-month_grid");
    const calendarNav = page.container.querySelector("[data-calendar-nav]");
    const navButtons = calendarNav?.querySelectorAll("button");

    expect(calendarGrid?.compareDocumentPosition(calendarNav ?? null)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(navButtons?.[0]?.className).toContain("size-10");
    expect(navButtons?.[1]?.className).toContain("h-10");
    expect(navButtons?.[2]?.className).toContain("size-10");

    await act(async () => {
      todayButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(page.container.textContent).toContain("มิถุนายน");
    await page.cleanup();
  });

  it("dims days that belong to adjacent months", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T04:00:00.000Z"));
    const page = await renderBookingSidebar();

    const outsideMonthDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("31 พฤษภาคม 2569"),
    );

    expect(outsideMonthDate?.className).toContain("text-[var(--site-muted)]");
    expect(outsideMonthDate?.className).toContain(
      "bg-[var(--site-surface-soft)]",
    );
    expect(outsideMonthDate?.className).not.toContain(
      "bg-[var(--site-accent-soft)]",
    );
    expect(outsideMonthDate?.parentElement?.className).not.toContain(
      "bg-[var(--site-accent-soft)]",
    );

    await page.cleanup();
  });

  it("uses a modern luxury visual treatment for the calendar and date modal", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T04:00:00.000Z"));
    const page = await renderBookingSidebar();

    expect(
      page.container.querySelector("[data-booking-card-shell]")?.className,
    ).toContain("bg-[linear-gradient(145deg,var(--site-surface),var(--site-surface-soft))]");
    expect(page.container.querySelector(".rdp-root")?.className).toContain(
      "rounded-[1.35rem]",
    );
    expect(page.container.querySelector(".rdp-root")?.className).toContain(
      "ring-[var(--site-primary)]/10",
    );

    const normalDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.trim() === "17");

    await act(async () => {
      normalDate?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      page.container.querySelector('[role="presentation"]')?.className,
    ).toContain("backdrop-blur-[1px]");
    expect(
      page.container.querySelector('[role="presentation"]')?.className,
    ).not.toContain("backdrop-blur-sm");
    expect(page.container.querySelector('[role="dialog"]')?.className).toContain(
      "bg-[linear-gradient(145deg,var(--site-surface),var(--site-surface-soft))]",
    );
    expect(
      page.container.querySelector("[data-date-detail-panel]")?.className,
    ).toContain("bg-[var(--site-primary-soft)]");
    expect(
      page.container.querySelector("[data-date-detail-panel]")?.className,
    ).not.toContain(
      "bg-[linear-gradient(135deg,var(--site-accent-soft),var(--site-primary-soft))]",
    );

    await page.cleanup();
  });

  it("disables past dates and opens a date detail modal for selectable days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T04:00:00.000Z"));
    const page = await renderBookingSidebar();

    const pastDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.trim() === "15");

    expect(pastDate?.disabled).toBe(true);
    expect(pastDate?.className).toContain("bg-[var(--site-surface-tint)]");

    await act(async () => {
      pastDate?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(page.container.querySelector('[role="dialog"]')).toBeNull();

    const normalDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.trim() === "17");

    await act(async () => {
      normalDate?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    let dialog = page.container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("วันนี้เป็นวันธรรมดา");
    expect(dialog?.textContent).toContain("ราคา - บาท");
    expect(document.body.style.overflow).toBe("hidden");
    expect(
      page.container.querySelector('[role="presentation"]')?.className,
    ).toContain("pb-[calc(7.5rem+env(safe-area-inset-bottom))]");

    await act(async () => {
      page.container
        .querySelector<HTMLButtonElement>('[aria-label="ปิดรายละเอียดวัน"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.body.style.overflow).toBe("");

    await act(async () => {
      page.container
        .querySelector<HTMLButtonElement>('[aria-label="ดูเดือนถัดไป"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const ordinaryFutureDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("28 กรกฎาคม 2569"),
    );

    await act(async () => {
      ordinaryFutureDate?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    dialog = page.container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("วันนี้เป็นวันธรรมดา");
    expect(dialog?.textContent).toContain("ราคา - บาท");

    await page.cleanup();
  });
});
