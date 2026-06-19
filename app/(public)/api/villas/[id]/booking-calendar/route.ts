import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { buildVillaBookingCalendarResponse } from "@/lib/villas/public-booking-calendar-route";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicDetail");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id } = await context.params;

    return await buildVillaBookingCalendarResponse(request, id);
  } catch (error) {
    return publicApiErrorResponse("Unable to load booking calendar", error);
  }
}
