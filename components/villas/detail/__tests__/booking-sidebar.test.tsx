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
  amenities: [],
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
      displayPrice: "9,900",
      icons: [],
      kind: "base",
      label: "วันธรรมดา",
      price: 9900,
      promotionMessage: null,
      tone: "default",
    };
  }

  if (month === "2026-06") {
    const promotionMessage = [
      "วันธรรมดา อา-พฤ แบ่งเปิดได้",
      "- 3 ห้องนอน ราคา 5900/12 ท่าน",
      "- 4 ห้องนอน ราคา 6900/15 ท่าน",
      "- 5 ห้องนอน ราคา 7900/17 ท่าน",
      "- 6 ห้องนอน ราคา 8900/20 ท่าน",
      "",
      "วันศุกร์ และ วันเสาร์ เปิดเต็ม 6 ห้องนอนเท่านั้น",
    ].join("\n");

    days["2026-06-17"] = {
      disabled: false,
      displayPrice: "5,900",
      icons: ["promotion"],
      kind: "promotion",
      label: "โปรโมชั่น",
      price: 5900,
      promotionMessage,
      tone: "promotion",
    };
    days["2026-06-18"] = {
      disabled: true,
      displayPrice: "9,900",
      icons: [],
      kind: "booking_waiting",
      label: "ติดจองแต่ยังไม่โอน",
      price: 9900,
      promotionMessage: null,
      tone: "waiting",
    };
    days["2026-06-19"] = {
      disabled: true,
      displayPrice: "13,900",
      icons: [],
      kind: "booking_confirmed",
      label: "ติดจองแล้ว",
      price: 13900,
      promotionMessage: null,
      tone: "booked",
    };
    days["2026-06-20"] = {
      disabled: false,
      displayPrice: "18,900",
      icons: [],
      kind: "holiday",
      label: "วันหยุดนักขัตฤกษ์",
      price: 18900,
      promotionMessage: null,
      tone: "holiday",
    };
    days["2026-06-21"] = {
      disabled: false,
      displayPrice: "12,900",
      icons: ["fire"],
      kind: "hotpro",
      label: "โปรไฟลุก",
      price: 12900,
      promotionMessage: null,
      tone: "hotpro",
    };
    days["2026-06-22"] = {
      disabled: false,
      displayPrice: "15,900",
      icons: ["fire"],
      kind: "hot_holiday",
      label: "โปรไฟลุกในวันหยุด",
      price: 15900,
      promotionMessage: null,
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
    expect(
      page.container.querySelector("[data-slot='calendar']")?.className,
    ).toContain("[&_.rdp-week]:my-4");
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
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("23 มิถุนายน 2569"),
    );

    await act(async () => {
      normalDate?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      page.container.querySelector('[role="presentation"]')?.className,
    ).toContain("backdrop-blur-xs");
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
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("15 มิถุนายน 2569"),
    );

    expect(pastDate?.disabled).toBe(true);
    expect(pastDate?.className).toContain("bg-[var(--site-surface-tint)]");

    await act(async () => {
      pastDate?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(page.container.querySelector('[role="dialog"]')).toBeNull();

    const normalDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("23 มิถุนายน 2569"),
    );

    await act(async () => {
      normalDate?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    let dialog = page.container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("วันธรรมดา");
    expect(dialog?.textContent).toContain("ราคา 9,900 บาท");
    expect(document.body.style.overflow).toBe("hidden");
    expect(
      page.container.querySelector('[role="presentation"]')?.className,
    ).toContain("pb-[calc(10rem+env(safe-area-inset-bottom))]");

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
    const pastDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.getAttribute("aria-label")?.startsWith("15 "));
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
    expect(
      promotionDate?.querySelector("[data-calendar-icon-slot='filled']")
        ?.className,
    ).toContain("top-0.5");
    expect(
      promotionDate?.querySelector("[data-calendar-icon-slot='filled']")
        ?.className,
    ).toContain("z-[20]");
    expect(
      promotionDate
        ?.querySelector("[data-calendar-icon='promotion']")
        ?.getAttribute("class"),
    ).toContain("size-4");
    expect(promotionDate?.className).toContain("!block");
    expect(promotionDate?.className).toContain("!h-12");
    expect(
      promotionDate
        ?.querySelector("[data-calendar-day-number]")
        ?.getAttribute("class"),
    ).toContain("text-[18px]");
    expect(
      promotionDate
        ?.querySelector("[data-calendar-day-price]")
        ?.getAttribute("class"),
    ).toContain("text-[10px]");
    expect(promotionDate?.textContent).toContain("5,900");
    expect(pastDate?.querySelector("[data-calendar-day-price]")).toBeNull();
    expect(baseDate?.dataset.calendarDayKind).toBe("base");
    expect(baseDate?.querySelector("[data-calendar-icon-slot='empty']")).not.toBeNull();
    expect(baseDate?.textContent).toContain("9,900");
    expect(waitingDate?.disabled).toBe(true);
    expect(waitingDate?.getAttribute("aria-disabled")).toBe("true");
    expect(waitingDate?.tabIndex).toBe(-1);
    expect(waitingDate?.dataset.calendarDayKind).toBe("booking_waiting");
    expect(waitingDate?.querySelector("[data-calendar-day-price]")).toBeNull();
    expect(
      waitingDate?.querySelector("[data-calendar-overlay='booked-stripes']"),
    ).toBeNull();
    expect(bookedDate?.disabled).toBe(true);
    expect(bookedDate?.getAttribute("aria-disabled")).toBe("true");
    expect(bookedDate?.tabIndex).toBe(-1);
    expect(bookedDate?.dataset.calendarDayKind).toBe("booking_confirmed");
    expect(bookedDate?.querySelector("[data-calendar-day-price]")).toBeNull();
    expect(
      bookedDate?.querySelector("[data-calendar-overlay='booked-stripes']"),
    ).not.toBeNull();
    expect(holidayDate?.dataset.calendarDayKind).toBe("holiday");
    expect(holidayDate?.className).toContain("bg-yellow-500");
    expect(hotproDate?.dataset.calendarDayKind).toBe("hotpro");
    expect(hotproDate?.className).not.toContain("bg-yellow-500");
    expect(hotproDate?.querySelector("[data-calendar-icon='fire']")).not.toBeNull();
    expect(hotHolidayDate?.dataset.calendarDayKind).toBe("hot_holiday");
    expect(hotHolidayDate?.className).toContain("bg-yellow-500");
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
    expect(dialog?.textContent).toContain("ราคา 5,900 บาท");
    expect(dialog?.textContent).toContain("วันธรรมดา อา-พฤ แบ่งเปิดได้");
    expect(dialog?.textContent).toContain("3 ห้องนอน ราคา 5900/12 ท่าน");

    await page.cleanup();
  });
});
