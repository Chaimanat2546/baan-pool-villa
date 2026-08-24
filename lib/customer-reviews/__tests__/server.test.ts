import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import {
  DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
  normalizeCustomerReviewHomepageLayout,
} from "../types";
import { createHomeConfigClient } from "@/lib/home-sections/supabase";
import {
  getHomepageCustomerReviewData,
  getHomepageCustomerReviewImageSource,
} from "../server";
import { unstable_cache } from "next/cache";

vi.mock("server-only", () => ({}));

const { cacheInvocationMock } = vi.hoisted(() => ({
  cacheInvocationMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) => {
      cacheInvocationMock(...args);
      return fn(...args);
    }),
}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createHomeConfigClient: vi.fn(),
}));

const createHomeConfigClientMock = vi.mocked(createHomeConfigClient);
const unstableCacheMock = vi.mocked(unstable_cache);
const originalHomeConfigUrl =
  process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL;
const originalHomeConfigKey =
  process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY;

function mockCustomerReviewQueries({
  images,
  imageError = null,
  settings,
  settingsError = null,
}: {
  images: unknown;
  imageError?: unknown;
  settings: unknown;
  settingsError?: unknown;
}) {
  const imageLimit = vi.fn().mockResolvedValue({ data: images, error: imageError });
  const imageOrder = vi.fn(() => ({ limit: imageLimit }));
  const imageEqHomepage = vi.fn(() => ({ order: imageOrder }));
  const imageEqActive = vi.fn(() => ({ eq: imageEqHomepage }));
  const imageSelect = vi.fn(() => ({ eq: imageEqActive }));
  const settingsMaybeSingle = vi.fn().mockResolvedValue({
    data: settings,
    error: settingsError,
  });
  const settingsEq = vi.fn(() => ({ maybeSingle: settingsMaybeSingle }));
  const settingsSelect = vi.fn(() => ({ eq: settingsEq }));
  const from = vi.fn((table: string) => {
    if (table === "customer_review_images") {
      return { select: imageSelect };
    }

    if (table === "customer_review_homepage_settings") {
      return { select: settingsSelect };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  createHomeConfigClientMock.mockReturnValue({ from } as never);

  return { from, imageEqActive, imageEqHomepage, imageLimit, imageOrder };
}

describe("customer review homepage server helpers", () => {
  beforeEach(() => {
    cacheInvocationMock.mockClear();
    process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL =
      "https://vfqxpujsvgdqtrzpxobh.supabase.co";
    process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY = "test-key";
  });

  afterAll(() => {
    if (originalHomeConfigUrl === undefined) {
      delete process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL = originalHomeConfigUrl;
    }
    if (originalHomeConfigKey === undefined) {
      delete process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY;
    } else {
      process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY =
        originalHomeConfigKey;
    }
  });

  it("normalizes supported layouts and rejects unknown admin values", () => {
    expect(normalizeCustomerReviewHomepageLayout("featured_rail")).toBe(
      "featured_rail",
    );
    expect(normalizeCustomerReviewHomepageLayout(" proof_wall ")).toBe(
      "proof_wall",
    );
    expect(normalizeCustomerReviewHomepageLayout("carousel")).toBe("carousel");
    expect(normalizeCustomerReviewHomepageLayout("grid")).toBeNull();
  });

  it("loads active homepage images in order with the saved layout", async () => {
    const queries = mockCustomerReviewQueries({
      images: [
        {
          alt: "Slip",
          homepage_order: 2,
          id: "image-2",
          public_url: "https://cdn.example.com/2.webp",
        },
        {
          alt: "Chat",
          homepage_order: 1,
          id: "image-1",
          public_url: "https://cdn.example.com/1.webp",
        },
      ],
      settings: { layout: "carousel" },
    });

    await expect(getHomepageCustomerReviewData()).resolves.toEqual({
      images: [
        {
          alt: "Chat",
          id: "image-1",
          order: 1,
          url: "/api/customer-reviews/images/image-1",
        },
        {
          alt: "Slip",
          id: "image-2",
          order: 2,
          url: "/api/customer-reviews/images/image-2",
        },
      ],
      layout: "carousel",
    });
    expect(queries.imageEqActive).toHaveBeenCalledWith("is_active", true);
    expect(queries.imageEqHomepage).toHaveBeenCalledWith("is_homepage", true);
    expect(queries.imageOrder).toHaveBeenCalledWith("homepage_order", {
      ascending: true,
    });
    expect(queries.imageLimit).toHaveBeenCalledWith(20);
    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      [CACHE_TAGS.customerReviews],
      {
        revalidate: CACHE_REVALIDATE_SECONDS.customerReviews,
        tags: [CACHE_TAGS.customerReviews],
      },
    );
    expect(cacheInvocationMock).toHaveBeenCalledWith(
      "home-config:vfqxpujsvgdqtrzpxobh.supabase.co",
    );
    process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL =
      "https://zkxpozvhvmgqfrwnlfrn.supabase.co";
    await expect(getHomepageCustomerReviewImageSource("image-1")).resolves.toBe(
      "https://cdn.example.com/1.webp",
    );
    expect(cacheInvocationMock).toHaveBeenLastCalledWith(
      "home-config:zkxpozvhvmgqfrwnlfrn.supabase.co",
    );
  });

  it("falls back to proof wall and no images when Supabase is unavailable", async () => {
    mockCustomerReviewQueries({
      imageError: { message: "RLS denied" },
      images: null,
      settings: { layout: "grid" },
    });

    await expect(getHomepageCustomerReviewData()).resolves.toEqual({
      images: [],
      layout: DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
    });
  });
});
