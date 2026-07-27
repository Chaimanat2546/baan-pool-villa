import {
  fetchVillaBookingCalendar,
  isValidBookingCalendarMonth,
} from "@/lib/villas/booking-calendar";

const PRIVATE_CALENDAR_HEADERS = {
  "Cache-Control": "private, no-store",
};

export async function buildVillaBookingCalendarResponse(
  request: Request,
  id: string,
) {
  if (!/^[1-9]\d*$/.test(id)) {
    return Response.json(
      { error: "Invalid villa id." },
      {
        headers: PRIVATE_CALENDAR_HEADERS,
        status: 400,
      },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const monthValues = searchParams.getAll("month");
  const requestedMonthValues = searchParams.getAll("months");
  const month = monthValues[0] ?? "";
  const requestedMonths = requestedMonthValues[0];

  if (
    monthValues.length !== 1 ||
    requestedMonthValues.length > 1 ||
    !isValidBookingCalendarMonth(month) ||
    (requestedMonths !== undefined &&
      !/^(?:[1-9]|1[0-4])$/.test(requestedMonths))
  ) {
    return Response.json(
      { error: "Invalid month." },
      {
        headers: PRIVATE_CALENDAR_HEADERS,
        status: 400,
      },
    );
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const monthCount =
    requestedMonths === undefined ? 1 : Number(requestedMonths);
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
        headers: PRIVATE_CALENDAR_HEADERS,
        status: 503,
      },
    );
  }

  if (results.some((result) => result.status === "unavailable")) {
    return Response.json(
      { error: "Booking calendar is unavailable." },
      {
        headers: PRIVATE_CALENDAR_HEADERS,
        status: 502,
      },
    );
  }

  const calendars = results.flatMap((result) =>
    result.calendar ? [result.calendar] : [],
  );

  return Response.json(monthCount === 1 ? calendars[0] : calendars, {
    headers: PRIVATE_CALENDAR_HEADERS,
  });
}
