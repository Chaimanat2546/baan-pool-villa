import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { fetchVillaBookingCalendar } from "@/lib/villas/booking-calendar";
import { isBrowsableBookingCalendarMonth } from "@/lib/villas/booking-calendar-preload";
import { hasActiveVillaListing } from "@/lib/villas/server";

const CALENDAR_CACHE_CONTROL = "private, no-store";

function calendarError(status: number, error: string) {
  return Response.json({ error }, {
    status,
    headers: { "Cache-Control": CALENDAR_CACHE_CONTROL },
  });
}

export async function GET(request: Request, context: RouteContext<"/api/villas/[id]/calendar">) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicCalendarMonth");
  if (rateLimitResponse) {
    rateLimitResponse.headers.set("Cache-Control", CALENDAR_CACHE_CONTROL);
    return rateLimitResponse;
  }

  const { id } = await context.params;
  const entries = [...new URL(request.url).searchParams];
  const [key, month] = entries[0] ?? [];
  if (
    !/^[1-9]\d{0,15}$/.test(id) ||
    !Number.isSafeInteger(Number(id)) ||
    entries.length !== 1 ||
    key !== "month" ||
    !isBrowsableBookingCalendarMonth(month)
  ) {
    return calendarError(400, "Invalid villa or month.");
  }

  const startedAt = Date.now();
  try {
    if (!(await hasActiveVillaListing(id))) {
      return calendarError(404, "Villa not found.");
    }
  } catch {
    console.warn(JSON.stringify({
      event: "booking_calendar_fetch_failed",
      villaId: id,
      month,
      reason: "listing_lookup_error",
      elapsedMs: Date.now() - startedAt,
    }));
    return calendarError(503, "Booking calendar is unavailable.");
  }

  const result = await fetchVillaBookingCalendar(id, month);
  if (!result.calendar) {
    return calendarError(
      result.status === "missing_token" ? 503 : 502,
      "Booking calendar is unavailable.",
    );
  }

  return Response.json(result.calendar, {
    headers: { "Cache-Control": CALENDAR_CACHE_CONTROL },
  });
}
