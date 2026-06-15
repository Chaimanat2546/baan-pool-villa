import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DestinationsSection } from "../destinations-section";

interface MockImageProps {
  alt: string;
  src: string;
}

vi.mock("next/image", () => ({
  default: ({ alt, src }: MockImageProps) => (
    <span data-dest-image={alt} data-src={src} />
  ),
}));

describe("DestinationsSection", () => {
  it("renders without mock badge artifacts", () => {
    const markup = renderToStaticMarkup(
      <DestinationsSection villas={[{ coverImage: "/images/hero.jpg" }]} />,
    );

    expect(markup).not.toContain("Mock FE");
    expect(markup).toContain("สำรวจจุดหมายปลายทางของเรา");
  });
  it("renders remote destination cover images through the public cover proxy", () => {
    const markup = renderToStaticMarkup(
      <DestinationsSection
        villas={[
          {
            coverImage:
              "https://devillegroups.com/imgs/profile_imgs_large/501-destination.jpg",
          },
        ]}
      />,
    );

    expect(markup).toContain(
      'data-src="/api/houses/images/proxy?url=https%3A%2F%2Fdevillegroups.com%2Fimgs%2Fprofile_imgs_large%2F501-destination.jpg&amp;w=1200&amp;q=60"',
    );
  });
});
