import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GuidePost } from "@/lib/guides/types";
import type { VillaListing } from "@/lib/villas/types";

import { GuideDetailPage } from "../guide-detail-page";
import { GuideListPage } from "../guide-list-page";

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

const guide: GuidePost = {
  contentBlocks: [],
  coverImage: null,
  createdAt: "2026-06-03T00:00:00.000Z",
  excerpt: "Guide excerpt",
  id: "guide-1",
  isPinned: false,
  publishedAt: "2026-06-03T00:00:00.000Z",
  recommendedHouseIds: [],
  slug: "guide-1",
  status: "published",
  tags: ["pattaya"],
  title: "Guide 1",
  updatedAt: "2026-06-03T00:00:00.000Z",
};

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

describe("guide detail request budget", () => {
  it("uses document navigation for guide list cards to avoid click-time RSC requests", () => {
    const markup = renderToStaticMarkup(
      <GuideListPage guides={[{ ...guide, coverImage: { alt: "Guide cover", path: "/guide.jpg", url: "/guide.jpg" } }]} />,
    );

    expect(markup).toContain('href="/guides/guide-1"');
    expect(markup).not.toContain('data-prefetch="false" href="/guides/guide-1"');
  });

  it("does not preload recommended villa card images in duplicate sidebar layouts", () => {
    const markup = renderToStaticMarkup(
      <GuideDetailPage
        guide={guide}
        recommendedVillas={[villa]}
        relatedGuides={[]}
      />,
    );

    const sidebarMarkup = markup.slice(markup.indexOf("data-guide-sidebar"));

    expect(sidebarMarkup).not.toContain('data-preload="true"');
  });
});
