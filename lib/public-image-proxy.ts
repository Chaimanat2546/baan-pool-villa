export const PUBLIC_IMAGE_PROXY_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

function buildPublicImageProxyUrl(proxyPath: string, sourceUrl: string | null) {
  if (!sourceUrl) {
    return null;
  }

  try {
    const url = new URL(sourceUrl);

    if (url.protocol !== "https:" || url.username || url.password) {
      return sourceUrl;
    }
  } catch {
    return sourceUrl;
  }

  const params = new URLSearchParams();
  params.set("url", sourceUrl);

  return `${proxyPath}?${params.toString()}`;
}

export function buildGuideImageProxyUrl(sourceUrl: string | null) {
  return buildPublicImageProxyUrl("/api/guides/images/proxy", sourceUrl);
}

export function buildSiteAssetProxyUrl(sourceUrl: string | null) {
  return buildPublicImageProxyUrl("/api/site-assets/proxy", sourceUrl);
}

export function buildVillaCoverImageProxyUrl(sourceUrl: string | null) {
  return buildPublicImageProxyUrl("/api/houses/images/proxy", sourceUrl);
}
