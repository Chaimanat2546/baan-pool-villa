import { describe, expect, it, vi } from "vitest";

import { CACHE_TAGS } from "./cache-policy";
import {
  revalidateDetailLayoutCache,
  revalidateExternalVillaCache,
  revalidateHomeSectionsCache,
  revalidateSiteSettingsCache,
} from "./cache-revalidation";
import { revalidatePath, revalidateTag } from "next/cache";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const revalidatePathMock = vi.mocked(revalidatePath);
const revalidateTagMock = vi.mocked(revalidateTag);

describe("cache revalidation", () => {
  it("expires site settings tags and public settings-driven paths", () => {
    revalidateSiteSettingsCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.siteSettings, {
      expire: 0,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/search");
  });

  it("expires home section tags and the home path", () => {
    revalidateHomeSectionsCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.homeSections, {
      expire: 0,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("expires detail layout settings and detail pages", () => {
    revalidateDetailLayoutCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.siteSettings, {
      expire: 0,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/villas/[id]", "page");
  });

  it("expires shared external villa tags and public villa paths", () => {
    revalidateExternalVillaCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaListings, {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(CACHE_TAGS.villaDetails, {
      expire: 0,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/search");
    expect(revalidatePathMock).toHaveBeenCalledWith("/sitemap.xml");
    expect(revalidatePathMock).toHaveBeenCalledWith("/villas/[id]", "page");
  });
});
