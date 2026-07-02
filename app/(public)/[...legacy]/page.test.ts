import { beforeEach, describe, expect, it, vi } from "vitest";

import { getListingById } from "@/lib/villas/server";
import { notFound, permanentRedirect } from "next/navigation";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  permanentRedirect: vi.fn(),
}));

vi.mock("@/lib/villas/server", () => ({
  getListingById: vi.fn(),
}));

const getListingByIdMock = vi.mocked(getListingById);
const notFoundMock = vi.mocked(notFound);
const permanentRedirectMock = vi.mocked(permanentRedirect);

describe("legacy villa redirect route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notFoundMock.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    permanentRedirectMock.mockImplementation((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    });
  });

  it("redirects unknown legacy paths whose last segment is an existing villa id", async () => {
    getListingByIdMock.mockResolvedValue({
      amenities: [],
      bathrooms: 4,
      bedrooms: 5,
      coverImage: null,
      distanceToSea: "500m",
      id: "2870",
      people: 12,
      poolType: "private",
      price: 15000,
      zone: "jomtien",
      zoneLabel: "Jomtien",
    });
    const { default: Page } = await import("./page");

    await expect(
      Page({ params: Promise.resolve({ legacy: ["something", "else", "2870"] }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/villas/2870");

    expect(getListingByIdMock).toHaveBeenCalledWith("2870");
    expect(permanentRedirectMock).toHaveBeenCalledWith("/villas/2870");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("uses the canonical listing id for redirects", async () => {
    getListingByIdMock.mockResolvedValue({
      amenities: [],
      bathrooms: 4,
      bedrooms: 5,
      coverImage: null,
      distanceToSea: "500m",
      id: "2870",
      people: 12,
      poolType: "private",
      price: 15000,
      zone: "jomtien",
      zoneLabel: "Jomtien",
    });
    const { default: Page } = await import("./page");

    await expect(
      Page({ params: Promise.resolve({ legacy: ["v", "0002870"] }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/villas/2870");
  });

  it("returns notFound without data lookup when the last segment is not numeric", async () => {
    const { default: Page } = await import("./page");

    await expect(
      Page({ params: Promise.resolve({ legacy: ["something", "villa-2870"] }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(getListingByIdMock).not.toHaveBeenCalled();
    expect(permanentRedirectMock).not.toHaveBeenCalled();
  });

  it("returns notFound when the numeric villa id does not exist", async () => {
    getListingByIdMock.mockResolvedValue(null);
    const { default: Page } = await import("./page");

    await expect(
      Page({ params: Promise.resolve({ legacy: ["random", "999999"] }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(getListingByIdMock).toHaveBeenCalledWith("999999");
    expect(permanentRedirectMock).not.toHaveBeenCalled();
  });
});
