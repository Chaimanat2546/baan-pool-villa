/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SITE_WEB_STYLES } from "@/lib/site-web-styles/defaults";
import type { VillaListing } from "@/lib/villas/types";
import {
  DetailSectionLines,
  getDetailImageUrl,
} from "../detail-section-lines";

const listing: VillaListing = {
  amenities: [],
  bathrooms: 2,
  bedrooms: 3,
  coverImage: null,
  distanceToSea: "500 ม.",
  id: "9",
  people: 8,
  poolType: "private",
  price: 12000,
  title: "บ้านพัก 9",
  zone: "jomtien",
  zoneLabel: "จอมเทียน",
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("detail section inline images", () => {
  it("accepts only standalone HTTPS image tags from Deville Groups", () => {
    expect(
      getDetailImageUrl(
        "<img width='100%' src='https://www.devillegroups.com/imgs/detail.jpg'>",
      ),
    ).toBe("https://www.devillegroups.com/imgs/detail.jpg");
    expect(
      getDetailImageUrl(
        '<IMG SRC="https://devillegroups.com/imgs/detail.jpg" />',
      ),
    ).toBe("https://devillegroups.com/imgs/detail.jpg");
    expect(
      getDetailImageUrl("<img src='javascript:alert(1)' onerror='alert(2)'>"),
    ).toBeNull();
    expect(
      getDetailImageUrl("<img src='https://evil.example/imgs/detail.jpg'>"),
    ).toBeNull();
    expect(
      getDetailImageUrl(
        "ข้อความ <img src='https://www.devillegroups.com/imgs/detail.jpg'>",
      ),
    ).toBeNull();
  });

  it("keeps rejected markup as text and opens accepted images in the lightbox", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DetailSectionLines
          galleryStyle={DEFAULT_SITE_WEB_STYLES.gallery}
          lines={[
            "รายละเอียดปกติ",
            "<img src='https://www.devillegroups.com/imgs/detail.jpg' width='100%'>",
            "<img src='javascript:alert(1)'>",
          ]}
          listing={listing}
        />,
      );
    });

    expect(container.textContent).toContain("รายละเอียดปกติ");
    expect(container.textContent).toContain("<img src='javascript:alert(1)'>");
    expect(container.querySelectorAll("[data-detail-inline-image]")).toHaveLength(
      1,
    );

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-detail-inline-image]")
        ?.click();
    });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain("รูปภาพรายละเอียดบ้าน DV-9");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
