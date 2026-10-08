import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { buildTikTokOEmbedResponse } from "@/lib/tiktok/oembed";

export async function GET(request: Request) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");
  return rateLimitResponse ?? buildTikTokOEmbedResponse(request);
}
