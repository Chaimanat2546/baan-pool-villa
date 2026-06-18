import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { getPublishedGuides } from "@/lib/guides/server";
import type { GuidePost } from "@/lib/guides/types";
import {
  buildAllowedPublicImageProxyResponse,
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

  try {
    return await buildAllowedPublicImageProxyResponse(
      request,
      async (targetUrl) => {
        const guides = await getPublishedGuides();

        return isAllowedGuideImageUrl(targetUrl, guides);
      },
    );
  } catch (error) {
    return publicApiErrorResponse("Unable to load image", error);
  }
}
