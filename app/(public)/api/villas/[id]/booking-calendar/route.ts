import { CACHE_HEADERS } from "@/lib/cache-policy";
import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import {
  fetchVillaBookingCalendar,
  isValidBookingCalendarMonth,
} from "@/lib/villas/booking-calendar";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const month = new URL(request.url).searchParams.get("month") ?? "";

  if (!isValidBookingCalendarMonth(month)) {
    return Response.json({ error: "Invalid month." }, { status: 400 });
  }

  const rateLimitResponse = limitPublicApiRequest(request, "publicDetail");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { id } = await context.params;

  try {
    const result = await fetchVillaBookingCalendar(id, month);

    if (result.status === "missing_token") {
      return Response.json(
        { error: "Booking calendar is not configured." },
        {
          headers: { "Cache-Control": "no-store" },
          status: 503,
        },
      );
    }

    if (result.status === "unavailable") {
      return Response.json(
        { error: "Booking calendar is unavailable." },
        { status: 502 },
      );
    }

    return Response.json(result.calendar, {
      headers: {
        "Cache-Control": CACHE_HEADERS.villaDetail,
      },
    });
  } catch (error) {
    return publicApiErrorResponse("Unable to load booking calendar", error);
  }
}
