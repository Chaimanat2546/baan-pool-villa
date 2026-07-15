// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import {
  BookingSidebar,
  clearBookingCalendarClientCacheForTests,
} from "../booking-sidebar";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

  if (month === "2026-05" || month === "2026-06") {
    const promotionMessage = [
      "วันธรรมดา อา-พฤ แบ่งเปิดได้",
      "- 3 ห้องนอน ราคา 5900/12 ท่าน",
      "- 4 ห้องนอน ราคา 6900/15 ท่าน",
      "- 5 ห้องนอน ราคา 7900/17 ท่าน",
      "- 6 ห้องนอน ราคา 8900/20 ท่าน",
      "",
      "วันศุกร์ และ วันเสาร์ เปิดเต็ม 6 ห้องนอนเท่านั้น",
    ].join("\n");

    days[`${month}-17`] = {
      disabled: false,
      displayPrice: "5,900",
      icons: [],
      kind: "promotion",
      label: "โปรโมชั่น",
      price: 5900,
      promotionMessage,
      tone: "promotion",
    };
    days[`${month}-18`] = {
      disabled: true,
      displayPrice: "9,900",
      icons: [],
      kind: "booking_waiting",
      label: "ติดจองแต่ยังไม่โอน",
      price: 9900,
      promotionMessage: null,
      tone: "waiting",
    };
    days[`${month}-19`] = {
      disabled: true,
      displayPrice: "13,900",
      icons: [],
      kind: "booking_confirmed",
      label: "ติดจองแล้ว",
      price: 13900,
      promotionMessage: null,
      tone: "booked",
    };
    days[`${month}-20`] = {
      disabled: false,
      displayPrice: "18,900",
      icons: [],
      kind: "holiday",
      label: "วันหยุดนักขัตฤกษ์",
      price: 18900,
      promotionMessage: null,
      tone: "holiday",
    };
    days[`${month}-21`] = {
      disabled: false,
      displayPrice: "12,900",
      icons: ["fire"],
      kind: "hotpro",
      label: "โปรไฟลุก",
      price: 12900,
      promotionMessage: null,
      tone: "hotpro",
    };
    days[`${month}-22`] = {
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

function getFetchedBookingCalendarMonths() {
  return vi.mocked(fetch).mock.calls.map(([input]) => {
    const url = input instanceof Request ? input.url : String(input);

    return new URL(url, "https://example.com").searchParams.get("month");
  });
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

function getCalendarNavButton(
  container: HTMLElement,
  purpose: "next" | "previous" | "today",
) {
  const buttons = Array.from(
    container.querySelectorAll<HTMLButtonElement>("[data-calendar-nav] button"),
  );

  if (purpose === "today") {
    return buttons.find((button) => button.textContent?.trim() === "วันนี้") ?? null;
  }

  return (
    buttons.find((button) => {
      const label = button.getAttribute("aria-label")?.toLowerCase() ?? "";

      return purpose === "next"
        ? label.includes("next") || label.includes("ถัด")
        : label.includes("previous") || label.includes("ก่อน");
    }) ?? null
  );
}

function clickCalendarNavButton(
  container: HTMLElement,
  purpose: "next" | "previous" | "today",
) {
  const button = getCalendarNavButton(container, purpose);

  expect(button).not.toBeNull();
  button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("BookingSidebar", () => {
  beforeEach(() => {
    mockBookingCalendarFetch();
  });

  afterEach(() => {
    clearBookingCalendarClientCacheForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (window as typeof window & { dataLayer?: unknown[] }).dataLayer;
    document.body.classList.remove("body-scroll-locked");
    document.body.innerHTML = "";
  });

  it("keeps contact actions in the booking sidebar", () => {
    const markup = renderToStaticMarkup(
      <BookingSidebar
        content={content}
        listing={listing}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );

    expect(markup).toContain("แชทเลย");
    expect(markup).toContain("จองผ่าน LINE");
  });

  it("uses the canonical checkout fact instead of the default time", () => {
    const markup = renderToStaticMarkup(
      <BookingSidebar
        content={{
          ...content,
          facts: [
            { label: "เช็คอิน", value: "13:00" },
            { label: "เช็คเอาต์", value: "11:00" },
          ],
        }}
        listing={listing}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );

    expect(markup).toContain("เช็คอิน 13:00 · เช็คเอาท์ 11:00");
  });

  it("pushes booking contact click events to the dataLayer", async () => {
    const page = await renderBookingSidebar();
    const lineLink = Array.from(page.container.querySelectorAll<HTMLAnchorElement>("a")).find(
      (link) => link.href === DEFAULT_SITE_SETTINGS.contact.lineUrl,
    );

    expect(lineLink).not.toBeNull();

    await act(async () => {
      lineLink?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect((window as typeof window & { dataLayer?: unknown[] }).dataLayer).toEqual([
      expect.objectContaining({
        contact_channel: "line",
        contact_location: "booking_sidebar",
        event: "booking_contact_click",
        value: 12000,
        ecommerce: expect.objectContaining({
          items: [
            expect.objectContaining({
              item_id: "66",
              price: 12000,
            }),
          ],
        }),
      }),
    ]);

    await page.cleanup();
  });

  it("dedupes duplicate booking calendar requests across mounted sidebars", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T04:00:00.000Z"));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <>
          <BookingSidebar
            content={content}
            listing={listing}
            settings={DEFAULT_SITE_SETTINGS}
          />
          <BookingSidebar
            content={content}
            listing={listing}
            settings={DEFAULT_SITE_SETTINGS}
          />
        </>,
      );
      await Promise.resolve();
    });

    expect(getFetchedBookingCalendarMonths()).toEqual(["2026-06"]);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("reuses a cached booking calendar after the sidebar remounts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T04:00:00.000Z"));
    const firstPage = await renderBookingSidebar();

    await act(async () => {
      await Promise.resolve();
    });

    expect(getFetchedBookingCalendarMonths()).toEqual(["2026-06"]);
    await firstPage.cleanup();
    vi.mocked(fetch).mockClear();

    const secondPage = await renderBookingSidebar();

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(
      secondPage.container.querySelector("[data-calendar-first-available='true']"),
    ).not.toBeNull();

    await secondPage.cleanup();
  });

  it("clears aborted booking calendar requests so a remount can retry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T04:00:00.000Z"));
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const firstPage = await renderBookingSidebar();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await firstPage.cleanup();

    const secondPage = await renderBookingSidebar();

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    await secondPage.cleanup();
  });

  it("renders calendar navigation inside the caption and can return to the current month", async () => {
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

    const calendarGrid = page.container.querySelector(".rdp-month_grid");
    const calendarNav = page.container.querySelector("[data-calendar-nav]");
    let todayButton = getCalendarNavButton(page.container, "today");
    const previousButton = getCalendarNavButton(page.container, "previous");
    const nextButton = getCalendarNavButton(page.container, "next");

    await act(async () => {
      clickCalendarNavButton(page.container, "next");
    });
    expect(page.container.textContent).toContain("กรกฎาคม");

    expect(page.container.querySelector(".rdp-months_dropdown")).toBeNull();
    expect(page.container.querySelector(".rdp-years_dropdown")).toBeNull();

    todayButton = getCalendarNavButton(page.container, "today");


    expect(todayButton).not.toBeNull();
    expect(page.container.querySelector(".rdp-root")?.contains(todayButton ?? null)).toBe(
      true,
    );
    expect(calendarGrid?.compareDocumentPosition(calendarNav ?? null)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
    expect(todayButton?.className).toContain("rounded-2xl");
    expect(previousButton?.className).toContain("size-10");
    expect(nextButton?.className).toContain("size-10");
    expect(
      nextButton?.querySelector("[data-calendar-next-month-pointer]"),
    ).not.toBeNull();
    expect(
      previousButton?.querySelector("[data-calendar-next-month-pointer]"),
    ).toBeNull();

    await act(async () => {
      clickCalendarNavButton(page.container, "today");
    });

    expect(page.container.textContent).toContain("มิถุนายน");
    await page.cleanup();
  });

  it("limits calendar navigation to one prior month and twelve future months", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T04:00:00.000Z"));
    const page = await renderBookingSidebar();

    await act(async () => {
      clickCalendarNavButton(page.container, "previous");
    });
    expect(getCalendarNavButton(page.container, "previous")?.disabled).toBe(true);

    await act(async () => {
      clickCalendarNavButton(page.container, "today");
      for (let offset = 0; offset < 12; offset += 1) {
        clickCalendarNavButton(page.container, "next");
      }
    });

    expect(page.container.textContent).toContain("มิถุนายน 2570");
    expect(getCalendarNavButton(page.container, "next")?.disabled).toBe(true);

    await page.cleanup();
  });

  it("reuses booking calendar months already fetched in the current page", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T04:00:00.000Z"));
    const page = await renderBookingSidebar();

    await act(async () => {
      await Promise.resolve();
    });
    expect(getFetchedBookingCalendarMonths()).toEqual(["2026-06"]);

    await act(async () => {
      clickCalendarNavButton(page.container, "next");
      await Promise.resolve();
    });
    expect(getFetchedBookingCalendarMonths()).toEqual(["2026-06", "2026-07"]);

    await act(async () => {
      clickCalendarNavButton(page.container, "today");
      await Promise.resolve();
    });
    await act(async () => {
      clickCalendarNavButton(page.container, "next");
      await Promise.resolve();
    });

    expect(getFetchedBookingCalendarMonths()).toEqual(["2026-06", "2026-07"]);
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
    expect(
      page.container.querySelector("[data-date-detail-dialog]")?.className,
    ).toContain(
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

  it("shows past dates and opens a date detail modal for available days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T04:00:00.000Z"));
    const page = await renderBookingSidebar();

    const pastDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("15 มิถุนายน 2569"),
    );

    expect(pastDate?.disabled).toBe(false);
    expect(pastDate?.className).toContain("bg-[var(--site-surface-tint)]");
    expect(pastDate?.className).not.toContain("opacity-60");

    await act(async () => {
      pastDate?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(page.container.querySelector("[data-date-detail-dialog]")).not.toBeNull();

    const normalDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("23 มิถุนายน 2569"),
    );

    await act(async () => {
      normalDate?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    let dialog = page.container.querySelector("[data-date-detail-dialog]");
    expect(dialog?.textContent).toContain("วันธรรมดา");
    expect(dialog?.textContent).toContain("ราคา 9,900 บาท");
    expect(document.body.classList.contains("body-scroll-locked")).toBe(true);
    expect(
      page.container.querySelector('[role="presentation"]')?.className,
    ).toContain("pb-[calc(10rem+env(safe-area-inset-bottom))]");

    await act(async () => {
      page.container
        .querySelector<HTMLButtonElement>('[aria-label="ปิดรายละเอียดวัน"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.body.classList.contains("body-scroll-locked")).toBe(false);

    await act(async () => {
      clickCalendarNavButton(page.container, "next");
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

    dialog = page.container.querySelector("[data-date-detail-dialog]");
    expect(dialog?.textContent).toContain("วันธรรมดา");
    expect(dialog?.textContent).toContain("ราคา 9,900 บาท");

    await page.cleanup();
  });

  it("shows available past days but keeps booked past days unselectable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T04:00:00.000Z"));
    const page = await renderBookingSidebar();

    const findDate = (day: string) =>
      Array.from(page.container.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.getAttribute("aria-label")?.startsWith(`${day} `),
      );
    const availablePastDate = findDate("15");
    const bookedPastDate = findDate("19");

    expect(availablePastDate?.disabled).toBe(false);
    expect(availablePastDate?.textContent).toContain("9,900");

    await act(async () => {
      availablePastDate?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(page.container.querySelector("[data-date-detail-dialog]")).not.toBeNull();

    expect(bookedPastDate?.disabled).toBe(true);
    expect(bookedPastDate?.className).not.toContain("bg-[var(--site-surface-tint)]");
    expect(bookedPastDate?.className).toContain("disabled:!opacity-100");
    expect(bookedPastDate?.parentElement?.className).toContain("opacity-100");

    await page.cleanup();
  });

  it("points at the nearest available booking date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T04:00:00.000Z"));
    const page = await renderBookingSidebar();

    await act(async () => {
      await Promise.resolve();
    });

    const firstAvailableDate =
      page.container.querySelector<HTMLButtonElement>(
        "[data-calendar-first-available='true']",
      );
    const bookedDate = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.getAttribute("aria-label")?.startsWith("19 à¸¡à¸´à¸–à¸¸à¸™à¸²à¸¢à¸™ 2569"),
    );

    expect(firstAvailableDate?.getAttribute("aria-label")).toMatch(
      /^20 มิถุนายน 2569/,
    );
    expect(
      firstAvailableDate?.querySelector(
        "[data-calendar-first-available-pointer]",
      ),
    ).not.toBeNull();
    expect(
      firstAvailableDate
        ?.querySelector("[data-calendar-first-available-icon]")
        ?.getAttribute("src"),
    ).toBe("/icons/pointing-left-finger-svgrepo-com.svg");
    expect(
      page.container.querySelector("[data-calendar-first-available-tip]"),
    ).not.toBeNull();
    expect(
      page.container.querySelector("[data-calendar-first-available-tip]")
        ?.getAttribute("data-calendar-first-available-tip-align"),
    ).toBe("end");

    await act(async () => {
      page.container
        .querySelector<HTMLButtonElement>(
          "[data-calendar-first-available-tip-dismiss]",
        )
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      page.container.querySelector("[data-calendar-first-available-tip]"),
    ).toBeNull();
    expect(
      firstAvailableDate?.querySelector("[data-calendar-first-available-pointer]"),
    ).not.toBeNull();
    expect(bookedDate).not.toBeNull();
    expect(bookedDate?.dataset.calendarFirstAvailable).toBeUndefined();

    await act(async () => {
      clickCalendarNavButton(page.container, "previous");
      await Promise.resolve();
    });

    expect(
      page.container.querySelector("[data-calendar-first-available='true']"),
    ).toBeNull();

    await page.cleanup();
  });

  it("renders prices and status markers when viewing a prior month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T04:00:00.000Z"));
    const page = await renderBookingSidebar();

    await act(async () => {
      await Promise.resolve();
      clickCalendarNavButton(page.container, "previous");
      await Promise.resolve();
    });

    const findPriorDate = (day: string) =>
      Array.from(page.container.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.getAttribute("aria-label")?.startsWith(`${day} `),
      );
    const promotionDate = findPriorDate("17");
    const waitingDate = findPriorDate("18");
    const bookedDate = findPriorDate("19");
    const holidayDate = findPriorDate("20");
    const hotproDate = findPriorDate("21");

    expect(promotionDate?.textContent).toContain("5,900");
    expect(waitingDate?.disabled).toBe(true);
    expect(waitingDate?.className).toContain("bg-emerald-700");
    expect(bookedDate?.disabled).toBe(true);
    expect(bookedDate?.className).toContain("bg-[var(--site-danger,#991b1b)]");
    expect(
      bookedDate?.querySelector("[data-calendar-overlay='booked-stripes']"),
    ).not.toBeNull();
    expect(holidayDate?.className).toContain("bg-yellow-500");
    expect(hotproDate?.querySelector("[data-calendar-icon='fire']")).not.toBeNull();

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
    expect(promotionDate?.querySelector("[data-calendar-icon='promotion']")).toBeNull();
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
    expect(pastDate?.querySelector("[data-calendar-day-price]")).not.toBeNull();
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

    expect(page.container.querySelector("[data-calendar-legend]")?.textContent).not.toContain(
      "โปรโมชั่น",
    );
    expect(page.container.querySelector("[data-calendar-legend]")?.textContent).toContain(
      "ติดจองแล้ว",
    );

    await act(async () => {
      promotionDate?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const dialog = page.container.querySelector("[data-date-detail-dialog]");
    expect(dialog?.textContent).toContain("โปรโมชั่น");
    expect(dialog?.textContent).toContain("ราคา 5,900 บาท");
    expect(dialog?.textContent).toContain("วันธรรมดา อา-พฤ แบ่งเปิดได้");
    expect(dialog?.textContent).toContain("3 ห้องนอน ราคา 5900/12 ท่าน");

    await page.cleanup();
  });
});
