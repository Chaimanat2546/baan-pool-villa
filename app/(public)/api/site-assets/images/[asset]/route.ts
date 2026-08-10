import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { buildResolvedPublicImageProxyResponse } from "@/lib/public-image-proxy-server";
import { getSiteSettings } from "@/lib/site-settings/server";

function getAssetUrl(
  asset: string,
  request: Request,
  settings: Awaited<ReturnType<typeof getSiteSettings>>["settings"],
) {
  if (asset === "logo") {
    return settings.logoImage.url;
  }

  if (asset === "hero") {
    const slide = new URL(request.url).searchParams.get("slide");
    const slideIndex = slide && /^\d+$/.test(slide) ? Number.parseInt(slide, 10) : 0;

    return settings.heroSlides[slideIndex]?.url ??
      (slideIndex === 0 ? settings.heroImage.url : null);
  }

  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ asset: string }> },
) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { asset } = await params;
    const { settings } = await getSiteSettings();

    return await buildResolvedPublicImageProxyResponse(
      request,
      getAssetUrl(asset, request, settings),
    );
  } catch (error) {
    return publicApiErrorResponse("Unable to load image", error);
  }
}
