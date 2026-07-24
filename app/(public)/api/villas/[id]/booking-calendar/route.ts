import { requireCalendarInternalBearer } from "@/lib/api/calendar-internal-auth";
import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { buildVillaBookingCalendarResponse } from "@/lib/villas/public-booking-calendar-route";

function markCalendarResponsePrivate(response: Response) {
  response.headers.set("Cache-Control", "private, no-store");

  return response;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const authorizationResponse =
      await requireCalendarInternalBearer(request);

    if (authorizationResponse) {
      return authorizationResponse;
    }

    const rateLimitResponse = limitPublicApiRequest(request, "publicCalendar");

    if (rateLimitResponse) {
      return markCalendarResponsePrivate(rateLimitResponse);
    }

    const { id } = await context.params;

    return await buildVillaBookingCalendarResponse(request, id);
  } catch (error) {
    return markCalendarResponsePrivate(
      publicApiErrorResponse("Unable to load booking calendar", error),
    );
  }
}
