import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CspSafeImage } from "../csp-safe-image";

describe("CspSafeImage", () => {
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
});
