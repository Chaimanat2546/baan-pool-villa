import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { buildResolvedPublicImageProxyResponse } from "@/lib/public-image-proxy-server";
import { getSiteSettings } from "@/lib/site-settings/server";

const MAX_HERO_SLIDE_INDEX = 9;
const MAX_HERO_SLIDE_VALUE_LENGTH = 2;

function parseHeroSlideIndex(value: string | null): number {
  if (!value || value.length > MAX_HERO_SLIDE_VALUE_LENGTH) {
    return 0;
  }

  for (const character of value) {
    const code = character.charCodeAt(0);

    if (code < 48 || code > 57) {
      return 0;
    }
  }

  const slideIndex = Number.parseInt(value, 10);

  return slideIndex <= MAX_HERO_SLIDE_INDEX ? slideIndex : 0;
}

function getAssetUrl(
  asset: string,
  request: Request,
  settings: Awaited<ReturnType<typeof getSiteSettings>>["settings"],
) {
  if (asset === "logo") {
    return settings.logoImage.url;
  }

  if (asset === "hero") {
    const slideIndex = parseHeroSlideIndex(
      new URL(request.url).searchParams.get("slide"),
    );

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
