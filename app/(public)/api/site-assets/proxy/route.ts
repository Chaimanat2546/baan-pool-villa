import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import {
  fetchPublicImageProxyResponse,
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

  const requestUrl = new URL(request.url);
  const targetUrl = normalizePublicImageProxyUrl(requestUrl.searchParams.get("url"));

  if (!targetUrl) {
    return Response.json({ error: "Invalid image URL" }, { status: 400 });
  }

  try {
    const { settings } = await getSiteSettings();
    const allowedUrls = getAllowedSiteAssetUrls(settings);

    if (!allowedUrls.has(targetUrl)) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    const imageResponse = await fetchPublicImageProxyResponse(targetUrl);

    if (!imageResponse) {
      return Response.json({ error: "Unable to load image" }, { status: 502 });
    }

    return imageResponse;
  } catch (error) {
    return publicApiErrorResponse("Unable to load image", error);
  }
}
