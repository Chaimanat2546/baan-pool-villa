import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} />
  ),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import type { VillaListing } from "../../../../lib/villas/types";
import { SearchPage } from "../page";

const villa: VillaListing = {
  amenities: [],
  bathrooms: 4,
  bedrooms: 5,
  coverImage: "https://devillegroups.com/imgs/profile_imgs_large/701.jpg",
  distanceToSea: "500m",
  id: "701",
  people: 12,
  poolType: "private",
  price: 15000,
  zone: "jomtien",
  zoneLabel: "จอมเทียน",
};

describe("SearchPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders server-provided villas without waiting for a client fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const markup = renderToStaticMarkup(<SearchPage initialVillas={[villa]} />);

    expect(markup).toContain("พบ 1");
    expect(markup).toContain("พูลวิลล่า 701");
    expect(markup).toContain("จอมเทียน");
    expect(markup).not.toContain("animate-pulse");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("applies server-provided search params during the first render", () => {
    const otherVilla: VillaListing = {
      ...villa,
      id: "702",
      price: 20000,
    };

    const markup = renderToStaticMarkup(
      <SearchPage
        initialSearchParams="id=701"
        initialVillas={[villa, otherVilla]}
      />,
    );

    expect(markup).toContain("พบ 1");
    expect(markup).toContain("พูลวิลล่า 701");
    expect(markup).not.toContain("พูลวิลล่า 702");
  });
});
