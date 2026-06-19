import { publicApiErrorResponse } from "@/lib/api/errors";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { getPublishedGuides } from "@/lib/guides/server";
import { buildResolvedPublicImageProxyResponse } from "@/lib/public-image-proxy-server";

interface GuideImageBlock {
  props?: {
    url?: unknown;
  };
  type?: unknown;
}

function getGuideImageBlockUrl(block: unknown): string | null {
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    return null;
  }

  const imageBlock = block as GuideImageBlock;

  return imageBlock.type === "image" && typeof imageBlock.props?.url === "string"
    ? imageBlock.props.url
    : null;
}

function parseBlockIndex(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const index = Number(value);

  return Number.isSafeInteger(index) ? index : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ index: string; slug: string }> },
) {
  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { index, slug } = await params;
    const blockIndex = parseBlockIndex(index);

    if (blockIndex === null) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    const guides = await getPublishedGuides();
    const guide = guides.find((currentGuide) => currentGuide.slug === slug);

    return await buildResolvedPublicImageProxyResponse(
      request,
      getGuideImageBlockUrl(guide?.contentBlocks[blockIndex]),
    );
  } catch (error) {
    return publicApiErrorResponse("Unable to load image", error);
  }
}
