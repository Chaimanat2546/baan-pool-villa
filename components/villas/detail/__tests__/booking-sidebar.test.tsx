// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function buildCalendarResponse(month: string) {
  const days: Record<string, unknown> = {};
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${month}-${String(day).padStart(2, "0")}`;
    days[dateKey] = {
      disabled: false,
      icons: [],
      kind: "base",
      label: "วันธรรมดา",
      price: 9900,
      tone: "default",
    };
  }

  if (month === "2026-06") {
    days["2026-06-17"] = {
      disabled: false,
      icons: ["promotion"],
      kind: "promotion",
      label: "โปรโมชั่น",
      price: 7900,
      tone: "promotion",
    };
    days["2026-06-18"] = {
      disabled: true,
      icons: [],
      kind: "booking_waiting",
      label: "ติดจองแต่ยังไม่โอน",
      price: 9900,
      tone: "waiting",
    };
    days["2026-06-19"] = {
      disabled: true,
      icons: [],
      kind: "booking_confirmed",
      label: "ติดจองแล้ว",
      price: 13900,
      tone: "booked",
    };
    days["2026-06-20"] = {
      disabled: false,
      icons: [],
      kind: "holiday",
      label: "วันหยุดนักขัตฤกษ์",
      price: 18900,
      tone: "holiday",
    };
    days["2026-06-21"] = {
      disabled: false,
      icons: ["fire"],
      kind: "hotpro",
      label: "โปรไฟลุก",
      price: 12900,
      tone: "hotpro",
    };
    days["2026-06-22"] = {
      disabled: false,
      icons: ["fire"],
      kind: "hot_holiday",
      label: "โปรไฟลุกในวันหยุด",
      price: 15900,
      tone: "hot_holiday",
    };
  }

  return {
    days,
    month,
    status: "available",
  };
}

function mockBookingCalendarFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://example.com");
      const month = url.searchParams.get("month") ?? "2026-06";

      return new Response(JSON.stringify(buildCalendarResponse(month)), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }),
  );
}

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
  beforeEach(() => {
    mockBookingCalendarFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
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
    expect(navButtons?.[0]?.className).toContain("size-11");
    expect(navButtons?.[1]?.className).toContain("h-11");
    expect(navButtons?.[2]?.className).toContain("size-11");

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
    ).find((button) => button.textContent?.trim() === "23");

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
    ).find((button) => button.textContent?.trim() === "23");

    await act(async () => {
      normalDate?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    let dialog = page.container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("วันธรรมดา");
    expect(dialog?.textContent).toContain("ราคา 9,900 บาท");
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
    expect(dialog?.textContent).toContain("วันธรรมดา");
    expect(dialog?.textContent).toContain("ราคา 9,900 บาท");

    await page.cleanup();
  });

  it("renders booking calendar markers, legend, disabled booking days, and event modal details", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T04:00:00.000Z"));
    const page = await renderBookingSidebar();

    await act(async () => {
      await Promise.resolve();
    });

    const promotionDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("17 มิถุนายน 2569"),
    );
    const baseDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("23 มิถุนายน 2569"),
    );
    const waitingDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("18 มิถุนายน 2569"),
    );
    const bookedDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("19 มิถุนายน 2569"),
    );
    const holidayDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("20 มิถุนายน 2569"),
    );
    const hotproDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("21 มิถุนายน 2569"),
    );
    const hotHolidayDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("22 มิถุนายน 2569"),
    );

    expect(promotionDate?.dataset.calendarDayKind).toBe("promotion");
    expect(promotionDate?.querySelector("[data-calendar-icon='promotion']")).not.toBeNull();
    expect(baseDate?.dataset.calendarDayKind).toBe("base");
    expect(baseDate?.querySelector("[data-calendar-icon-slot='empty']")).not.toBeNull();
    expect(waitingDate?.disabled).toBe(true);
    expect(waitingDate?.dataset.calendarDayKind).toBe("booking_waiting");
    expect(bookedDate?.disabled).toBe(true);
    expect(bookedDate?.dataset.calendarDayKind).toBe("booking_confirmed");
    expect(holidayDate?.dataset.calendarDayKind).toBe("holiday");
    expect(holidayDate?.className).toContain("bg-[var(--site-accent-soft)]");
    expect(hotproDate?.dataset.calendarDayKind).toBe("hotpro");
    expect(hotproDate?.className).not.toContain("bg-[var(--site-accent-soft)]");
    expect(hotproDate?.querySelector("[data-calendar-icon='fire']")).not.toBeNull();
    expect(hotHolidayDate?.dataset.calendarDayKind).toBe("hot_holiday");
    expect(hotHolidayDate?.className).toContain("bg-[var(--site-accent-soft)]");
    expect(hotHolidayDate?.querySelector("[data-calendar-icon='fire']")).not.toBeNull();

    expect(page.container.querySelector("[data-calendar-legend]")?.textContent).toContain(
      "โปรโมชั่น",
    );
    expect(page.container.querySelector("[data-calendar-legend]")?.textContent).toContain(
      "ติดจองแล้ว",
    );

    await act(async () => {
      promotionDate?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const dialog = page.container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("โปรโมชั่น");
    expect(dialog?.textContent).toContain("ราคา 7,900 บาท");

    await page.cleanup();
  });
});
