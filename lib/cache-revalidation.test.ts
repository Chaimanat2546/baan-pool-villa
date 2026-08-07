import { beforeEach, describe, expect, it, vi } from "vitest";

import { CACHE_TAGS } from "./cache-policy";
import {
  revalidateDetailLayoutCache,
  revalidateExternalVillaCache,
  revalidateGuideCache,
  revalidateHomeSectionsCache,
  revalidateCustomerReviewsCache,
  revalidateLegalPageCache,
  revalidateSiteSeoSettingsCache,
  revalidateSiteContactSettingsCache,
  revalidateSiteSettingsCache,
  revalidateSiteWebStylesCache,
  revalidateVillaCardImagesCache,
} from "./cache-revalidation";
import {
  HTML_CACHE_VERSION_GROUPS,
  bumpHtmlEdgeCacheVersions,
} from "./html-edge-cache-version";
import { revalidateTag } from "next/cache";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("./html-edge-cache-version", () => ({
  HTML_CACHE_VERSION_GROUPS: {
    detailLayout: "detail-layout",
    guides: "guides",
    homeSections: "home-sections",
    customerReviews: "customer-reviews",
    legalPages: "legal-pages",
    siteSettings: "site-settings",
    villaDetails: "villa-details",
    villaImages: "villa-images",
    villaListings: "villa-listings",
  },
  bumpHtmlEdgeCacheVersions: vi.fn(),
}));

const revalidateTagMock = vi.mocked(revalidateTag);
const bumpHtmlEdgeCacheVersionsMock = vi.mocked(bumpHtmlEdgeCacheVersions);

describe("cache revalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expires only the CMS site settings tag", async () => {
    await revalidateSiteSettingsCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.siteSettings, {
      expire: 0,
    });
    expect(bumpHtmlEdgeCacheVersionsMock).toHaveBeenCalledWith([
      HTML_CACHE_VERSION_GROUPS.siteSettings,
    ]);
  });

  it("expires only the CMS home section tag", async () => {
    await revalidateHomeSectionsCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.homeSections, {
      expire: 0,
    });
    expect(bumpHtmlEdgeCacheVersionsMock).toHaveBeenCalledWith([
      HTML_CACHE_VERSION_GROUPS.homeSections,
    ]);
  });

  it("expires only CMS guide tags", async () => {
    await revalidateGuideCache("family-pool-villa");

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.guides, {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(
      CACHE_TAGS.guide("family-pool-villa"),
      { expire: 0 },
    );
    expect(bumpHtmlEdgeCacheVersionsMock).toHaveBeenCalledWith([
      HTML_CACHE_VERSION_GROUPS.guides,
    ]);
  });

  it("expires only CMS legal page tags", async () => {
    await revalidateLegalPageCache("privacy");

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.legalPages, {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(
      CACHE_TAGS.legalPage("privacy"),
      { expire: 0 },
    );
    expect(revalidateTagMock).not.toHaveBeenCalledWith(
      CACHE_TAGS.siteSettings,
      expect.anything(),
    );
    expect(bumpHtmlEdgeCacheVersionsMock).toHaveBeenCalledWith([
      HTML_CACHE_VERSION_GROUPS.legalPages,
    ]);
  });

  it("expires only the CMS detail layout settings tag", async () => {
    await revalidateDetailLayoutCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.siteSettings, {
      expire: 0,
    });
    expect(bumpHtmlEdgeCacheVersionsMock).toHaveBeenCalledWith([
      HTML_CACHE_VERSION_GROUPS.detailLayout,
    ]);
  });

  it("expires the contact settings tag and shared settings HTML", async () => {
    await revalidateSiteContactSettingsCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(
      CACHE_TAGS.siteContactSettings,
      { expire: 0 },
    );
    expect(bumpHtmlEdgeCacheVersionsMock).toHaveBeenCalledWith([
      HTML_CACHE_VERSION_GROUPS.siteSettings,
    ]);
  });

  it("expires the SEO settings tag and shared settings HTML", async () => {
    await revalidateSiteSeoSettingsCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.siteSeoSettings, {
      expire: 0,
    });
    expect(bumpHtmlEdgeCacheVersionsMock).toHaveBeenCalledWith([
      HTML_CACHE_VERSION_GROUPS.siteSettings,
    ]);
  });

  it("expires the web styles tag and shared style-dependent HTML", async () => {
    await revalidateSiteWebStylesCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.siteWebStyles, {
      expire: 0,
    });
    expect(bumpHtmlEdgeCacheVersionsMock).toHaveBeenCalledWith([
      HTML_CACHE_VERSION_GROUPS.siteSettings,
    ]);
  });

  it("expires villa card image, gallery, and listing tags", async () => {
    await revalidateVillaCardImagesCache("9");

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaCardImages, {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaImages, {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaListings, {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(
      CACHE_TAGS.villaCardImage("default", "9"),
      { expire: 0 },
    );
    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaImage("9"), {
      expire: 0,
    });
    expect(bumpHtmlEdgeCacheVersionsMock).toHaveBeenCalledWith([
      HTML_CACHE_VERSION_GROUPS.villaImages,
      HTML_CACHE_VERSION_GROUPS.villaListings,
    ]);
  });

  it("expires only customer review tags and homepage HTML", async () => {
    await revalidateCustomerReviewsCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.customerReviews, {
      expire: 0,
    });
    expect(bumpHtmlEdgeCacheVersionsMock).toHaveBeenCalledWith([
      HTML_CACHE_VERSION_GROUPS.customerReviews,
    ]);
    expect(revalidateTagMock).not.toHaveBeenCalledWith(
      CACHE_TAGS.homeSections,
      expect.anything(),
    );
    expect(revalidateTagMock).not.toHaveBeenCalledWith(
      CACHE_TAGS.guides,
      expect.anything(),
    );
  });

  it("expires only shared external villa tags by default", async () => {
    let resolveBump: (() => void) | null = null;
    const bumpPromise = new Promise<void>((resolve) => {
      resolveBump = resolve;
    });
    bumpHtmlEdgeCacheVersionsMock.mockReturnValueOnce(bumpPromise);

    let completed = false;
    const revalidationPromise = revalidateExternalVillaCache().then(() => {
      completed = true;
    });

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaListings, {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaDetails, {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaCardImages, {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaImages, {
      expire: 0,
    });
    expect(bumpHtmlEdgeCacheVersionsMock).toHaveBeenCalledWith([
      HTML_CACHE_VERSION_GROUPS.villaListings,
      HTML_CACHE_VERSION_GROUPS.villaDetails,
      HTML_CACHE_VERSION_GROUPS.villaImages,
    ]);
    expect(completed).toBe(false);

    resolveBump!();
    await revalidationPromise;

    expect(completed).toBe(true);
  });
});
