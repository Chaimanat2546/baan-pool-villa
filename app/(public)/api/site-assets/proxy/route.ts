import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import {
  buildAllowedPublicImageProxyResponse,
  normalizePublicImageProxyUrl,
} from "@/lib/public-image-proxy-server";
import { getSiteSettings } from "@/lib/site-settings/server";
import type { SiteImageSettings, SiteSettings } from "@/lib/site-settings/types";

function addImageUrl(urls: Set<string>, image: SiteImageSettings) {
  const normalizedUrl = normalizePublicImageProxyUrl(image.url);

  if (normalizedUrl) {
    urls.add(normalizedUrl);
  }
}

function getAllowedSiteAssetUrls(settings: SiteSettings) {
  const urls = new Set<string>();

  addImageUrl(urls, settings.heroImage);
  addImageUrl(urls, settings.logoImage);
  addImageUrl(urls, settings.seo.ogImage);
  addImageUrl(urls, settings.pageSeo.guides.ogImage);
  addImageUrl(urls, settings.pageSeo.search.ogImage);

  return urls;
}

export async function GET(request: Request) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    return await buildAllowedPublicImageProxyResponse(
      request,
      async (targetUrl) => {
        const { settings } = await getSiteSettings();

        return getAllowedSiteAssetUrls(settings).has(targetUrl);
      },
    );
  } catch (error) {
    return publicApiErrorResponse("Unable to load image", error);
  }
}
