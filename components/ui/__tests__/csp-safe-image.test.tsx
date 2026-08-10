import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CspSafeImage } from "../csp-safe-image";

describe("CspSafeImage", () => {
  it("marks preloaded Next images as eager for above-the-fold LCP images", () => {
    const markup = renderToStaticMarkup(
      <CspSafeImage
        alt="Hero image"
        height={1043}
        preload
        src="/images/BPV-66_Cover-Web.jpg"
        width={1565}
      />,
    );

    expect(markup).toContain('loading="eager"');
  });

  it("renders TikTok CDN thumbnails without the Next image loader", () => {
    const markup = renderToStaticMarkup(
      <CspSafeImage
        alt=""
        height={160}
        src="https://p16-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/no-extension"
        width={90}
      />,
    );

    expect(markup).toContain("<img");
    expect(markup).toContain("p16-sign.tiktokcdn-us.com");
  });

  it("renders Poolvilla R2 worker images without the Next image loader", () => {
    const imageUrl =
      "https://webook-media.poolvilla.workers.dev/houses/999/cover.webp";
    const markup = renderToStaticMarkup(
      <CspSafeImage alt="Cover" height={480} src={imageUrl} width={640} />,
    );

    expect(markup).toContain("<img");
    expect(markup).toContain(`src="${imageUrl}"`);
    expect(markup).not.toContain("?w=");
  });

  it("keeps public image proxy requests on an allowlisted quality", () => {
    const markup = renderToStaticMarkup(
      <CspSafeImage
        alt="Customer review"
        fill
        quality={75}
        sizes="(min-width: 1280px) 25vw, 50vw"
        src="/api/customer-reviews/images/review-1"
      />,
    );

    expect(markup).toContain("%2Fapi%2Fcustomer-reviews%2Fimages%2Freview-1");
    expect(markup).toContain("&amp;q=75");
    expect(markup).not.toContain("q=70");
  });
});
