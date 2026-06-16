import { describe, expect, it, vi } from "vitest";
import {
  fetchVillaBookingCalendar,
  normalizeBookingCalendar,
  type RawBookingCalendarResponse,
} from "../booking-calendar";

vi.mock("server-only", () => ({}));

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

  it("marks promotion days with only a promotion icon and promotion weekday price", () => {
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
      icons: ["promotion"],
      kind: "promotion",
      label: "โปรโมชั่น",
      price: 7900,
      tone: "promotion",
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
      kind: "booking_waiting",
      label: "ติดจองแต่ยังไม่โอน",
      tone: "waiting",
    });
    expect(calendar.days["2026-06-11"]).toMatchObject({
      disabled: true,
      kind: "booking_confirmed",
      label: "ติดจองแล้ว",
      tone: "booked",
    });
    expect(calendar.days["2026-06-13"]).toMatchObject({
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
        ],
        hot_holidays: [
          {
            holiday_end: "2026-06-05",
            holiday_price: 15900,
            holiday_start: "2026-06-05",
          },
        ],
      },
      "2026-06",
    );

    expect(calendar.days["2026-06-03"]).toMatchObject({
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
      icons: ["fire"],
      kind: "hot_holiday",
      label: "โปรไฟลุกในวันหยุด",
      price: 15900,
      tone: "hot_holiday",
    });
  });
});

describe("fetchVillaBookingCalendar", () => {
  it("returns missing token without calling the external API", async () => {
    vi.stubEnv("PATTAYA_BOOKINGS_API_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchVillaBookingCalendar("9", "2026-06")).resolves.toEqual({
      calendar: null,
      status: "missing_token",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
