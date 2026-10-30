import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preloadVillaBookingCalendars } from "../booking-calendar-preload";
import {
  fetchVillaBookingCalendar,
  getMinimumGuestCapacity,
  normalizeBookingCalendar,
  type RawBookingCalendarResponse,
} from "../booking-calendar";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const baseResponse: RawBookingCalendarResponse = {
  base_price: {
    people_fri: "18",
    people_mon: "18",
    people_sat: "18",
    people_sun: "18",
    people_thu: "18",
    people_tue: "18",
    people_wed: "18",
    price_fri: 13900,
    price_mon: 9900,
    price_sat: 18900,
    price_sun: 9900,
    price_thu: 9900,
    price_tue: 9900,
    price_wed: 9900,
  },
  bookings: [],
  holidays: [],
  hot_holidays: [],
  protime_promotions: [],
};

describe("normalizeBookingCalendar", () => {
  it("uses base prices for ordinary days", () => {
    const calendar = normalizeBookingCalendar(baseResponse, "2026-06");

    expect(calendar.days["2026-06-16"]).toMatchObject({
      disabled: false,
      guestCapacity: "18",
      holidayAlert: null,
      icons: [],
      kind: "base",
      label: "วันธรรมดา",
      price: 9900,
      tone: "default",
    });
    expect(calendar.days["2026-06-20"]).toMatchObject({
      price: 18900,
    });
  });

  it("finds the minimum guest capacity shown across preloaded calendar months", () => {
    const june = normalizeBookingCalendar(
      {
        ...baseResponse,
        base_price: {
          ...baseResponse.base_price,
          people_mon: "18",
          people_tue: "12",
          people_wed: "18",
        },
      },
      "2026-06",
    );

    expect(getMinimumGuestCapacity({ "2026-06": june })).toBe(12);
    expect(getMinimumGuestCapacity({})).toBeNull();

    const promotion = normalizeBookingCalendar(
      {
        ...baseResponse,
        protime_promotions: [
          {
            protime_start: "2026-06-16",
            protime_end: "2026-06-16",
            protime_people_tue: "12",
          },
        ],
      },
      "2026-06",
    );

    expect(getMinimumGuestCapacity({ "2026-06": promotion })).toBe(12);
  });

  it("marks promotion days without calendar icons and with promotion weekday price", () => {
    const calendar = normalizeBookingCalendar(
      {
        ...baseResponse,
        protime_promotions: [
          {
            protime_end: "2026-06-30",
            protime_msg: "ลดราคาเดือนมิถุนายน",
            protime_people_fri: "18",
            protime_people_mon: "14",
            protime_people_sat: "18",
            protime_people_sun: "14",
            protime_people_thu: "14",
            protime_people_tue: "14",
            protime_people_wed: "14",
            protime_price_fri: 11900,
            protime_price_mon: 7900,
            protime_price_sat: 18900,
            protime_price_sun: 7900,
            protime_price_thu: 7900,
            protime_price_tue: 7900,
            protime_price_wed: 7900,
            protime_start: "2026-06-01",
          },
        ],
      },
      "2026-06",
    );

    expect(calendar.days["2026-06-16"]).toMatchObject({
      disabled: false,
      displayPrice: "7,900",
      guestCapacity: "14",
      holidayAlert: null,
      icons: [],
      kind: "promotion",
      label: "โปรโมชั่น",
      price: 7900,
      promotionMessage: "ลดราคาเดือนมิถุนายน",
      tone: "promotion",
    });
  });

  it("uses the promotion weekday price instead of prices mentioned in the promotion message", () => {
    const promotionMessage = [
      "วันธรรมดา อา-พฤ แบ่งเปิดได้",
      "- 3 ห้องนอน ราคา 5900/12 ท่าน",
      "- 4 ห้องนอน ราคา 6900/15 ท่าน",
      "- 5 ห้องนอน ราคา 7900/17 ท่าน",
      "- 6 ห้องนอน ราคา 8900/20 ท่าน",
      "",
      "วันศุกร์ และ วันเสาร์ เปิดเต็ม 6 ห้องนอนเท่านั้น",
    ].join("\n");
    const calendar = normalizeBookingCalendar(
      {
        ...baseResponse,
        protime_promotions: [
          {
            protime_end: "2026-06-30",
            protime_msg: promotionMessage,
            protime_price_mon: 7900,
            protime_start: "2026-06-01",
          },
        ],
      },
      "2026-06",
    );

    expect(calendar.days["2026-06-15"]).toMatchObject({
      displayPrice: "7,900",
      price: 7900,
      promotionMessage,
    });
  });

  it("uses the holiday guest capacity for hotpro days", () => {
    const calendar = normalizeBookingCalendar(
      {
        ...baseResponse,
        holidays: [
          {
            holiday_end: "2026-08-01",
            holiday_people: "12",
            holiday_price: 9900,
            holiday_start: "2026-08-01",
            holiday_type: "hotpro",
          },
        ],
      },
      "2026-08",
    );

    expect(calendar.days["2026-08-01"]).toMatchObject({
      guestCapacity: "12",
      kind: "hotpro",
      price: 9900,
    });
  });

  it("uses booking priority and excludes checkout dates from booking ranges", () => {
    const calendar = normalizeBookingCalendar(
      {
        ...baseResponse,
        bookings: [
          {
            book_checkin: "2026-06-10",
            book_checkout: "2026-06-12",
            book_type: "waiting",
          },
          {
            book_checkin: "2026-06-11",
            book_checkout: "2026-06-13",
            book_type: "deville",
          },
        ],
      },
      "2026-06",
    );

    expect(calendar.days["2026-06-10"]).toMatchObject({
      disabled: true,
      displayPrice: null,
      kind: "booking_waiting",
      label: "ติดจองแต่ยังไม่โอน",
      tone: "waiting",
    });
    expect(calendar.days["2026-06-11"]).toMatchObject({
      disabled: true,
      displayPrice: null,
      kind: "booking_confirmed",
      label: "ติดจองแล้ว",
      tone: "booked",
    });
    expect(calendar.days["2026-06-13"]).toMatchObject({
      disabled: false,
      kind: "base",
    });
  });

  it("keeps confirmed bookings above overlapping hot holidays", () => {
    const calendar = normalizeBookingCalendar(
      {
        ...baseResponse,
        bookings: [
          {
            book_checkin: "2026-06-05",
            book_checkout: "2026-06-06",
            book_type: "deville",
          },
        ],
        hot_holidays: [
          {
            hot_holiday_end: "2026-06-05",
            hot_holiday_people: "10",
            hot_holiday_price: 15900,
            hot_holiday_start: "2026-06-05",
          },
        ],
      },
      "2026-06",
    );

    expect(calendar.days["2026-06-05"]).toMatchObject({
      disabled: true,
      kind: "booking_confirmed",
      tone: "booked",
    });
  });

  it("ignores calendar-invalid booking date ranges", () => {
    const calendar = normalizeBookingCalendar(
      {
        ...baseResponse,
        bookings: [
          {
            book_checkin: "2026-02-31",
            book_checkout: "2026-03-03",
            book_type: "deville",
          },
        ],
      },
      "2026-03",
    );

    expect(calendar.days["2026-03-01"]).toMatchObject({
      disabled: false,
      kind: "base",
    });
    expect(calendar.days["2026-03-02"]).toMatchObject({
      disabled: false,
      kind: "base",
    });
  });

  it("marks holidays, hotpro holidays, and hot holidays with the requested backgrounds and icons", () => {
    const calendar = normalizeBookingCalendar(
      {
        ...baseResponse,
        holidays: [
          {
            holiday_alert: "วันหยุดยาว เข้าพักขั้นต่ำ 2 คืน",
            holiday_end: "2026-06-03",
            holiday_price: 18900,
            holiday_start: "2026-06-03",
            holiday_type: "holiday",
          },
          {
            holiday_end: "2026-06-04",
            holiday_price: 12900,
            holiday_start: "2026-06-04",
            holiday_type: "hotpro",
          },
          {
            holiday_end: "2026-06-05",
            holiday_price: 18900,
            holiday_start: "2026-06-05",
            holiday_type: "holiday",
          },
        ],
        hot_holidays: [
          {
            hot_holiday_end: "2026-06-05",
            hot_holiday_people: "10",
            hot_holiday_price: 15900,
            hot_holiday_start: "2026-06-05",
          },
        ],
      },
      "2026-06",
    );

    expect(calendar.days["2026-06-03"]).toMatchObject({
      guestCapacity: "18",
      holidayAlert: "วันหยุดยาว เข้าพักขั้นต่ำ 2 คืน",
      icons: [],
      kind: "holiday",
      label: "วันหยุดนักขัตฤกษ์",
      price: 18900,
      tone: "holiday",
    });
    expect(calendar.days["2026-06-04"]).toMatchObject({
      icons: ["fire"],
      kind: "hotpro",
      label: "โปรไฟลุก",
      price: 12900,
      tone: "hotpro",
    });
    expect(calendar.days["2026-06-05"]).toMatchObject({
      guestCapacity: "10",
      icons: ["fire"],
      kind: "hot_holiday",
      label: "โปรไฟลุกในวันหยุด",
      price: 15900,
      tone: "hot_holiday",
    });
  });
});

describe("fetchVillaBookingCalendar", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it.each([
    ["empty object", {}],
    ["error envelope", { error: "private upstream detail" }],
    ["null root", null],
    ["array root", []],
    ["missing base prices", { ...baseResponse, base_price: undefined }],
    ["null base prices", { ...baseResponse, base_price: null }],
    ["empty base prices", { ...baseResponse, base_price: {} }],
    ["all weekday prices missing", { ...baseResponse, base_price: { price_sun: null, price_mon: null, price_tue: null, price_wed: null, price_thu: null, price_fri: null, price_sat: null } }],
    ["missing weekday price", { ...baseResponse, base_price: { ...baseResponse.base_price, price_mon: undefined } }],
    ["string weekday price", { ...baseResponse, base_price: { ...baseResponse.base_price, price_mon: "9900" } }],
    ["negative weekday price", { ...baseResponse, base_price: { ...baseResponse.base_price, price_mon: -1 } }],
    ["numeric guest capacity", { ...baseResponse, base_price: { ...baseResponse.base_price, people_mon: 18 } }],
    ["missing bookings", { ...baseResponse, bookings: undefined }],
    ["null bookings", { ...baseResponse, bookings: null }],
    ["object bookings", { ...baseResponse, bookings: {} }],
    ["null booking row", { ...baseResponse, bookings: [null] }],
    ["invalid booking date", { ...baseResponse, bookings: [{ book_checkin: "2026-02-31", book_checkout: "2026-03-03" }] }],
    ["unsupported booking year", { ...baseResponse, bookings: [{ book_checkin: "0026-06-01", book_checkout: "0026-06-03" }] }],
    ["reversed booking range", { ...baseResponse, bookings: [{ book_checkin: "2026-06-20", book_checkout: "2026-06-19" }] }],
    ["zero-night booking", { ...baseResponse, bookings: [{ book_checkin: "2026-06-20", book_checkout: "2026-06-20" }] }],
    ["missing holidays", { ...baseResponse, holidays: undefined }],
    ["invalid holiday price", { ...baseResponse, holidays: [{ holiday_start: "2026-06-20", holiday_end: "2026-06-20", holiday_price: "9900" }] }],
    ["missing hot holidays", { ...baseResponse, hot_holidays: undefined }],
    ["invalid hot holiday range", { ...baseResponse, hot_holidays: [{ hot_holiday_start: "2026-06-20", hot_holiday_end: "2026-06-19" }] }],
    ["missing promotions", { ...baseResponse, protime_promotions: undefined }],
    ["invalid promotion text", { ...baseResponse, protime_promotions: [{ protime_start: "2026-06-20", protime_end: "2026-06-20", protime_msg: {} }] }],
    ["invalid promotion price", { ...baseResponse, protime_promotions: [{ protime_start: "2026-06-20", protime_end: "2026-06-20", protime_price_sat: "9900" }] }],
  ])("rejects %s without treating the month as available", async (_name, payload) => {
    vi.stubEnv("PATTAYA_BOOKINGS_API_TOKEN", "calendar-token");
    const fetchMock = vi.fn().mockResolvedValue(Response.json(payload));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchVillaBookingCalendar("9", "2026-06")).resolves.toEqual({
      calendar: null,
      status: "unavailable",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith("Booking calendar fetch failed", expect.objectContaining({
      event: "booking_calendar_fetch_failed",
      propertyId: "9",
      month: "2026-06",
      reason: "invalid_payload",
      invalidField: expect.any(String),
      httpStatus: 200,
      durationMs: expect.any(Number),
      loadId: expect.any(String),
    }));
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("private upstream detail");
  });

  it("accepts explicit nullable fields and complete empty event arrays", async () => {
    vi.stubEnv("PATTAYA_BOOKINGS_API_TOKEN", "calendar-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      ...baseResponse,
      base_price: { ...baseResponse.base_price, price_mon: null, people_mon: null },
      holidays: [{ holiday_start: "2026-06-20", holiday_end: "2026-06-20", holiday_price: null, holiday_alert: null }],
    })));

    const result = await fetchVillaBookingCalendar("9", "2026-06");
    expect(result.status).toBe("available");
    expect(result.calendar?.days["2026-06-20"].price).toBe(18900);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("returns missing token without calling the external API", async () => {
    vi.stubEnv("PATTAYA_BOOKINGS_API_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchVillaBookingCalendar("9", "2026-06")).resolves.toEqual({
      calendar: null,
      status: "missing_token",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith("Booking calendar fetch failed", expect.objectContaining({ reason: "missing_token", httpStatus: null }));
  });

  it("returns unavailable when the upstream API returns a non-OK response", async () => {
    vi.stubEnv("PATTAYA_BOOKINGS_API_TOKEN", "calendar-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 503 })),
    );

    await expect(fetchVillaBookingCalendar("9", "2026-06")).resolves.toEqual({
      calendar: null,
      status: "unavailable",
    });
    expect(console.warn).toHaveBeenLastCalledWith("Booking calendar fetch failed", expect.objectContaining({ reason: "http_error", httpStatus: 503 }));
  });

  it("returns unavailable when fetch or JSON parsing throws", async () => {
    vi.stubEnv("PATTAYA_BOOKINGS_API_TOKEN", "calendar-token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(fetchVillaBookingCalendar("9", "2026-06")).resolves.toEqual({
      calendar: null,
      status: "unavailable",
    });
    expect(console.warn).toHaveBeenLastCalledWith("Booking calendar fetch failed", expect.objectContaining({ reason: "network_error", httpStatus: null }));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("not json", {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      ),
    );

    await expect(fetchVillaBookingCalendar("9", "2026-06")).resolves.toEqual({
      calendar: null,
      status: "unavailable",
    });
    expect(console.warn).toHaveBeenLastCalledWith("Booking calendar fetch failed", expect.objectContaining({ reason: "invalid_json", httpStatus: 200 }));
  });

  it("returns unavailable when the upstream request hangs past the timeout", async () => {
    vi.useFakeTimers();
    vi.stubEnv("PATTAYA_BOOKINGS_API_TOKEN", "calendar-token");

    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = fetchVillaBookingCalendar("9", "2026-06");

    await vi.advanceTimersByTimeAsync(8_000);

    await expect(resultPromise).resolves.toEqual({
      calendar: null,
      status: "unavailable",
      timedOut: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(console.warn).toHaveBeenLastCalledWith("Booking calendar fetch failed", expect.objectContaining({ reason: "timeout", durationMs: 8000, attempt: 1 }));
  });

  it("recovers the initial calendar automatically after a real fetch timeout without retrying every month", async () => {
    vi.useFakeTimers();
    vi.stubEnv("PATTAYA_BOOKINGS_API_TOKEN", "calendar-token");
    let currentAttempts = 0;
    const fetchMock = vi.fn((url: URL, init?: RequestInit) => {
      if (url.searchParams.get("month") === "2026-06" && ++currentAttempts === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        });
      }
      return Promise.resolve(Response.json(baseResponse));
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = preloadVillaBookingCalendars("9", new Date("2026-06-16T04:00:00Z"));
    await vi.advanceTimersByTimeAsync(8000);
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(15);
    expect(result.calendars["2026-06"].days["2026-06-16"].price).toBe(9900);
    expect(result.unavailableMonths).toEqual([]);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith("Booking calendar preload completed", expect.objectContaining({
      retryCount: 1, fetchAttemptCount: 15, currentMonthAvailable: true,
    }));
  });

  it("logs only safe context rather than credentials, payloads, or thrown messages", async () => {
    const secret = "test-secret-never-log";
    vi.stubEnv("PATTAYA_BOOKINGS_API_TOKEN", secret);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(`failed with ${secret}`)));

    await fetchVillaBookingCalendar(`9\n${secret}`, secret);

    const logged = vi.mocked(console.warn).mock.calls;
    expect(logged).toHaveLength(1);
    expect(logged[0][1]).toMatchObject({ propertyId: null, month: null, reason: "network_error" });
    expect(JSON.stringify(logged)).not.toContain(secret);
  });

  it("correlates one failed month with the page preload summary without extra requests", async () => {
    vi.stubEnv("PATTAYA_BOOKINGS_API_TOKEN", "calendar-token");
    const fetchMock = vi.fn(async (url: URL) => Response.json(url.searchParams.get("month") === "2026-06" ? {} : baseResponse));
    vi.stubGlobal("fetch", fetchMock);

    const result = await preloadVillaBookingCalendars("9", new Date("2026-06-16T04:00:00Z"));

    expect(fetchMock).toHaveBeenCalledTimes(14);
    expect(result.unavailableMonths).toEqual(["2026-06"]);
    expect(Object.keys(result.calendars)).toHaveLength(13);
    expect(console.warn).toHaveBeenCalledTimes(1);
    const failure = vi.mocked(console.warn).mock.calls[0][1] as { loadId: string };
    expect(console.info).toHaveBeenCalledWith("Booking calendar preload completed", expect.objectContaining({
      event: "booking_calendar_preload",
      loadId: failure.loadId,
      propertyId: "9",
      requestedMonthCount: 14,
      availableMonthCount: 13,
      unavailableMonths: ["2026-06"],
      currentMonthAvailable: false,
      durationMs: expect.any(Number),
    }));
  });

  it("requests fresh calendar data from the upstream API on every page load", async () => {
    vi.stubEnv("PATTAYA_BOOKINGS_API_TOKEN", "calendar-token");
    const fetchMock = vi.fn().mockResolvedValue(Response.json(baseResponse));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchVillaBookingCalendar("9", "2026-06");

    expect(result).toMatchObject({
      calendar: {
        days: {
          "2026-06-16": {
            kind: "base",
            price: 9900,
          },
        },
        month: "2026-06",
        status: "available",
      },
      status: "available",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: expect.any(URLSearchParams),
      }),
      expect.objectContaining({
        headers: { Authorization: "Bearer calendar-token" },
        cache: "no-store",
      }),
    );
  });
});
