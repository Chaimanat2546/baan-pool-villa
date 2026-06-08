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
});
