import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} />
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

import { DEFAULT_SITE_SETTINGS } from "../../../../lib/site-settings/defaults";
import type { ResolvedHomeSection } from "../../../../lib/home-sections/types";
import type { VillaListing } from "../../../../lib/villas/types";
import { HomePage } from "../page";

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
  zoneLabel: "จอมเทียน",
};

const homeSection: ResolvedHomeSection = {
  description: "บ้านพักแนะนำสำหรับทริปครอบครัว",
  slug: "featured",
  title: "บ้านพักแนะนำ",
  villas: [villa],
};

describe("HomePage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders server-provided villas without waiting for a client fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const markup = renderToStaticMarkup(
      <HomePage
        initialHomeSections={[homeSection]}
        initialVillas={[villa]}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );

    expect(markup).toContain("บ้านพักแนะนำ");
    expect(markup).toContain("พูลวิลล่า 501");
    expect(markup).toContain("จอมเทียน");
    expect(markup).not.toContain("animate-pulse");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
