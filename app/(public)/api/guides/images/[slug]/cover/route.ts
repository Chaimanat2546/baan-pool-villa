import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { getPublishedGuides } from "@/lib/guides/server";
import { buildResolvedPublicImageProxyResponse } from "@/lib/public-image-proxy-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { slug } = await params;
    const guides = await getPublishedGuides();
    const guide = guides.find((currentGuide) => currentGuide.slug === slug);

    return await buildResolvedPublicImageProxyResponse(
      request,
      guide?.coverImage?.url ?? null,
      { preserveSourceFidelity: true },
    );
  } catch (error) {
    return publicApiErrorResponse("Unable to load image", error);
  }
}
