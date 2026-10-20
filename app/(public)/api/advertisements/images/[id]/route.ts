import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { getAdvertisementImageSource } from "@/lib/advertisements/server";
import { isAdvertisementId } from "@/lib/advertisements/validation";
import { buildResolvedPublicImageProxyResponse } from "@/lib/public-image-proxy-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isAdvertisementId(id))
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  const limited = limitPublicApiRequest(request, "publicCatalog");
  if (limited) return limited;
  try {
    return await buildResolvedPublicImageProxyResponse(
      request,
      await getAdvertisementImageSource(id),
    );
  } catch (error) {
    return publicApiErrorResponse("Unable to load advertisement image", error);
  }
}
