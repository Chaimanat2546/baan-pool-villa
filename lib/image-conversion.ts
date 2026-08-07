const WEBP_MIME_TYPE = "image/webp";

type CloudflareImagesBinding = {
  input: (image: ReadableStream<Uint8Array>) => {
    output: (options: { format: "image/webp"; quality: number }) => Promise<{
      response: () => Response;
    }>;
  };
};

function getWebpFileName(file: File): string {
  const baseName = file.name.replace(/\.[^.]+$/, "").trim() || "image";

  return `${baseName}.webp`;
}

async function getCloudflareImagesBinding(): Promise<CloudflareImagesBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const images = env.IMAGES;

    return images && typeof images.input === "function"
      ? (images as CloudflareImagesBinding)
      : null;
  } catch {
    return null;
  }
}

async function convertWithCloudflareImages(file: File): Promise<File | null> {
  const images = await getCloudflareImagesBinding();

  if (!images) {
    return null;
  }

  const response = (await images
    .input(file.stream() as ReadableStream<Uint8Array>)
    .output({ format: "image/webp", quality: 85 }))
    .response();
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();

  if (!response.ok || contentType !== WEBP_MIME_TYPE) {
    throw new Error("Cloudflare Images did not return WebP.");
  }

  return new File(
    [new Uint8Array(await response.arrayBuffer())],
    getWebpFileName(file),
    { type: WEBP_MIME_TYPE },
  );
}

export async function convertImageToWebp(file: File): Promise<File> {
  if (file.type === WEBP_MIME_TYPE) {
    return file;
  }

  try {
    const cloudflareImage = await convertWithCloudflareImages(file);

    if (cloudflareImage) {
      return cloudflareImage;
    }
  } catch {
    // Local development and failed binding conversions fall back to Sharp.
  }

  const { default: sharp } = await import("sharp");
  const webpBuffer = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .webp({ quality: 85 })
    .toBuffer();

  return new File([new Uint8Array(webpBuffer)], getWebpFileName(file), {
    type: WEBP_MIME_TYPE,
  });
}
