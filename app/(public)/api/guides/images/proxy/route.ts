import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { getPublishedGuides } from "@/lib/guides/server";
import type { GuidePost } from "@/lib/guides/types";
import {
  fetchPublicImageProxyResponse,
  normalizePublicImageProxyUrl,
} from "@/lib/public-image-proxy-server";

interface GuideImageBlock {
  props?: {
    url?: unknown;
  };
  type?: unknown;
}

function getGuideBlockImageUrl(block: unknown): string | null {
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    return null;
  }

  const imageBlock = block as GuideImageBlock;

  if (imageBlock.type !== "image" || typeof imageBlock.props?.url !== "string") {
    return null;
  }

  return imageBlock.props.url;
}

function isAllowedGuideImageUrl(targetUrl: string, guides: GuidePost[]) {
  return guides.some((guide) => {
    if (normalizePublicImageProxyUrl(guide.coverImage?.url ?? null) === targetUrl) {
      return true;
    }

    return guide.contentBlocks.some(
      (block) => normalizePublicImageProxyUrl(getGuideBlockImageUrl(block)) === targetUrl,
    );
  });
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
    const guides = await getPublishedGuides();

    if (!isAllowedGuideImageUrl(targetUrl, guides)) {
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
