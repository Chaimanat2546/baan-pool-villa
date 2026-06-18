import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { buildPublicHousesResponse } from "@/lib/villas/public-houses-route";

export async function GET(request: Request) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    return await buildPublicHousesResponse(request);
  } catch (error) {
    return publicApiErrorResponse("Unable to load houses", error);
  }
}
