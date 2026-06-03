import {
  buildImageDownloadFilename,
  createAttachmentDisposition,
  isAllowedVillaImageUrl,
  normalizeDownloadImageUrl,
} from "@/lib/villas/image-download";
import { fetchVillaImages, parseVillaId } from "@/lib/villas/images";
import { fetchVillaDetail } from "@/lib/villas/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    parseVillaId(id);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid villa id") {
      return Response.json({ error: "Invalid villa id" }, { status: 400 });
    }
    throw error;
  }

  const requestUrl = new URL(request.url);
  const targetUrl = normalizeDownloadImageUrl(requestUrl.searchParams.get("url"));

  if (!targetUrl) {
    return Response.json({ error: "Invalid image URL" }, { status: 400 });
  }

  try {
    const images = await fetchVillaImages(id);
    const matchedImage = images.find((image) => image.imageUrl === targetUrl) ?? null;
    const detailPayload = matchedImage ? null : await fetchVillaDetail(id);

    if (!isAllowedVillaImageUrl(targetUrl, images, detailPayload)) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    const upstreamResponse = await fetch(targetUrl, { cache: "no-store" });
    const contentType = upstreamResponse.headers.get("Content-Type") ?? "";

    if (
      !upstreamResponse.ok ||
      !upstreamResponse.body ||
      !contentType.trim().toLowerCase().startsWith("image/")
    ) {
      return Response.json({ error: "Unable to download image" }, { status: 502 });
    }

    const filename = buildImageDownloadFilename({
      contentType,
      imageName: requestUrl.searchParams.get("name") ?? matchedImage?.imageName,
      sourceUrl: targetUrl,
      villaId: id,
      zoneKey: requestUrl.searchParams.get("zone") ?? matchedImage?.zone,
    });

    return new Response(upstreamResponse.body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": createAttachmentDisposition(filename),
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    console.error("Unable to download villa image", error);

    return Response.json({ error: "Unable to download image" }, { status: 502 });
  }
}
