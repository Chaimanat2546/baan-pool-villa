import { beforeEach, describe, expect, it, vi } from "vitest";

import { CACHE_TAGS } from "./cache-policy";
import {
  revalidateDetailLayoutCache,
  revalidateExternalVillaCache,
  revalidateGuideCache,
  revalidateHomeSectionsCache,
  revalidateSiteSettingsCache,
} from "./cache-revalidation";
import { revalidateTag } from "next/cache";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

const revalidateTagMock = vi.mocked(revalidateTag);

describe("cache revalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expires only the CMS site settings tag", () => {
    revalidateSiteSettingsCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.siteSettings, {
      expire: 0,
    });
  });

  it("expires only the CMS home section tag", () => {
    revalidateHomeSectionsCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.homeSections, {
      expire: 0,
    });
  });

  it("expires only CMS guide tags", () => {
    revalidateGuideCache("family-pool-villa");

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.guides, {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(
      CACHE_TAGS.guide("family-pool-villa"),
      { expire: 0 },
    );
  });

  it("expires only the CMS detail layout settings tag", () => {
    revalidateDetailLayoutCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.siteSettings, {
      expire: 0,
    });
  });

  it("expires only shared external villa tags by default", () => {
    revalidateExternalVillaCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaListings, {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaDetails, {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaImages, {
      expire: 0,
    });
  });
});
