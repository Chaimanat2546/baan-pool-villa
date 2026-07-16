import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SITE_HEADER_SETTINGS } from "../defaults";
import { getSiteHeaderSettings } from "../server";
import { getSiteWebStyles } from "@/lib/site-web-styles/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/site-web-styles/server", () => ({
  getSiteWebStyles: vi.fn(),
}));

const getSiteWebStylesMock = vi.mocked(getSiteWebStyles);

describe("getSiteHeaderSettings", () => {
  it("reads Header from the Web Styles owner", async () => {
    getSiteWebStylesMock.mockResolvedValueOnce({
      gallery: { variant: "lightbox" },
      header: { variant: "right-booking" },
      houseCard: { variant: "classic" },
    });

    await expect(getSiteHeaderSettings()).resolves.toEqual({
      desktopHeaderVariant: "right-booking",
    });
    expect(getSiteWebStylesMock).toHaveBeenCalledOnce();
  });

  it("uses the safe default when the Web Styles reader rejects", async () => {
    getSiteWebStylesMock.mockRejectedValueOnce(new Error("table missing"));

    await expect(getSiteHeaderSettings()).resolves.toEqual(
      DEFAULT_SITE_HEADER_SETTINGS,
    );
  });
});
