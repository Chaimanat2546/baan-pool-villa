import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { VillaListing } from "@/lib/villas/types";

import { VillaCard } from "../villa-card";

interface MockImageProps {
  alt: string;
  preload?: boolean;
  src: string;
}

vi.mock("next/image", () => ({
  default: ({ alt, preload, src }: MockImageProps) => (
    <span
      aria-label={alt}
      data-preload={preload ? "true" : "false"}
      data-src={src}
    />
  ),
}));

const villa: VillaListing = {
  amenities: [],
  bathrooms: 4,
  bedrooms: 5,
  coverImage: "https://devillegroups.com/imgs/profile_imgs_large/501.jpg",
  distanceToSea: "500m",
  id: "501",
  people: 12,
  poolType: "private",
  price: 12000,
  zone: "jomtien",
  zoneLabel: "Jomtien",
};

describe("VillaCard navigation", () => {
  it("uses a normal document link for villa detail pages", () => {
    const markup = renderToStaticMarkup(<VillaCard villa={villa} />);

    expect(markup).toContain('href="/villas/501"');
    expect(markup).not.toContain("data-next-link");
  });

  it("renders listing cover images through the public cover proxy", () => {
    const markup = renderToStaticMarkup(<VillaCard villa={villa} />);

    expect(markup).toContain(
      'data-src="/api/houses/images/501?w=640&amp;q=60"',
    );
    expect(markup).not.toContain(
      'data-src="https://devillegroups.com/imgs/profile_imgs_large/501.jpg"',
    );
    expect(markup).not.toContain("devillegroups.com");
  });
});
