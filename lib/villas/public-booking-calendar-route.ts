import { CACHE_HEADERS } from "@/lib/cache-policy";
import {
  fetchVillaBookingCalendar,
  isValidBookingCalendarMonth,
} from "@/lib/villas/booking-calendar";

export async function buildVillaBookingCalendarResponse(
  request: Request,
  id: string,
) {
  const searchParams = new URL(request.url).searchParams;
  const month = searchParams.get("month") ?? "";
  const requestedMonths = searchParams.get("months");

  if (
    !isValidBookingCalendarMonth(month) ||
    (requestedMonths !== null && requestedMonths !== "6")
  ) {
    return Response.json({ error: "Invalid month." }, { status: 400 });
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const monthCount = requestedMonths === "6" ? 6 : 1;
  const monthKeys = Array.from({ length: monthCount }, (_, offset) => {
    const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));

    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
    ].join("-");
  });
  const results = await Promise.all(
    monthKeys.map((monthKey) => fetchVillaBookingCalendar(id, monthKey)),
  );

  if (results.some((result) => result.status === "missing_token")) {
    return Response.json(
      { error: "Booking calendar is not configured." },
      {
        headers: { "Cache-Control": "no-store" },
        status: 503,
      },
    );
  }

  if (results.some((result) => result.status === "unavailable")) {
    return Response.json(
      { error: "Booking calendar is unavailable." },
      {
        headers: { "Cache-Control": "no-store" },
        status: 502,
      },
    );
  }

  const calendars = results.flatMap((result) =>
    result.calendar ? [result.calendar] : [],
  );

  return Response.json(monthCount === 1 ? calendars[0] : calendars, {
    headers: {
      "Cache-Control": CACHE_HEADERS.bookingCalendar,
    },
  });
}
