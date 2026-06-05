import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GuidePost } from "@/lib/guides/types";
import type { VillaListing } from "@/lib/villas/types";

import { ArticlesSection } from "../articles-section";
import { VillaRail } from "../villa-rail";

interface MockImageProps {
  alt: string;
  preload?: boolean;
  priority?: boolean;
  src: string;
}

interface MockLinkProps {
  children: ReactNode;
  href: string;
  prefetch?: boolean;
}

vi.mock("next/image", () => ({
  default: ({ alt, preload, priority, src }: MockImageProps) => (
    <span
      aria-label={alt}
      data-preload={preload ? "true" : "false"}
      data-priority={priority ? "true" : "false"}
      data-src={src}
    />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, prefetch, ...props }: MockLinkProps) => (
    <a data-prefetch={prefetch === false ? "false" : "auto"} href={href} {...props}>
      {children}
    </a>
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

const guide: GuidePost = {
  contentBlocks: [],
  coverImage: {
    alt: "Guide cover",
    path: "/guide.jpg",
    url: "/guide.jpg",
  },
  createdAt: "2026-06-03T00:00:00.000Z",
  excerpt: "Guide excerpt",
  id: "guide-1",
  isPinned: true,
  publishedAt: "2026-06-03T00:00:00.000Z",
  recommendedHouseIds: [],
  slug: "guide-1",
  status: "published",
  tags: ["pattaya"],
  title: "Guide 1",
  updatedAt: "2026-06-03T00:00:00.000Z",
};

describe("homepage request budget", () => {
  it("does not preload non-LCP villa rail card images", () => {
    const markup = renderToStaticMarkup(
      <VillaRail
        cta
        description="Recommended villas"
        title="Recommended"
        villas={[villa]}
      />,
    );

    expect(markup).not.toContain('data-preload="true"');
    expect(markup).toContain('data-prefetch="false" href="/search"');
  });

  it("does not priority-preload article rail images or prefetch guide routes", () => {
    const markup = renderToStaticMarkup(<ArticlesSection guides={[guide]} />);

    expect(markup).not.toContain('data-priority="true"');
    expect(markup).toContain('data-prefetch="false" href="/guides/guide-1"');
  });
});
