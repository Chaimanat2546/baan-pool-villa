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
      <DestinationsSection villas={[{ coverImage: "/images/hero.jpg", id: "501" }]} />,
    );

    expect(markup).not.toContain("Mock FE");
    expect(markup).toContain("สำรวจจุดหมายปลายทางของเรา");
  });
  it("passes remote destination cover images to the AWS image loader", () => {
    const markup = renderToStaticMarkup(
      <DestinationsSection
        villas={[
          {
            coverImage:
              "https://devillegroups.com/imgs/profile_imgs_large/501-destination.jpg",
            id: "501",
          },
        ]}
      />,
    );

    expect(markup).toContain(
      'data-src="https://devillegroups.com/imgs/profile_imgs_large/501-destination.jpg"',
    );
    expect(markup).not.toContain("/api/houses/images");
  });
});
