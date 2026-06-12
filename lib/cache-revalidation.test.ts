import { beforeEach, describe, expect, it, vi } from "vitest";

import { CACHE_TAGS } from "./cache-policy";
import {
  revalidateDetailLayoutCache,
  revalidateExternalVillaCache,
  revalidateGuideCache,
  revalidateHomeSectionsCache,
  revalidateSiteSettingsCache,
  revalidateLegalPageCache,
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
    legalPages: "legal-pages",
    siteSettings: "site-settings",
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

  it("expires only shared external villa tags by default", async () => {
    await revalidateExternalVillaCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaListings, {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaDetails, {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaImages, {
      expire: 0,
    });
    expect(bumpHtmlEdgeCacheVersionsMock).not.toHaveBeenCalled();
  });
});
