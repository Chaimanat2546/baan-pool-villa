/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import {
  click,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { ActivityAdvertisementsSection } from "../activity-advertisements-section";
import { DEFAULT_SITE_WEB_STYLES } from "@/lib/site-web-styles/defaults";
import type { VillaListing } from "@/lib/villas/types";
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => (
    <span data-image-src={props.src} aria-label={props.alt} />
  ),
}));
describe("site-owned activity gallery", () => {
  it("opens local image IDs in the gallery with responsive main image and thumbnails", async () => {
    const image =
      "/api/advertisements/images/20000000-0000-4000-8000-000000000001";
    const listing: VillaListing = {
      id: "88",
      amenities: [],
      bathrooms: 2,
      bedrooms: 3,
      coverImage: null,
      distanceToSea: "500m",
      people: 8,
      poolType: "private",
      price: 12000,
      zone: "jomtien",
      zoneLabel: "Jomtien",
    };
    const page = await mountAdminPage(
      <ActivityAdvertisementsSection
        advertisements={[
          { id: "ad-1", title: "กิจกรรม", imageUrl: image, imageUrls: [image] },
        ]}
        galleryStyle={DEFAULT_SITE_WEB_STYLES.gallery}
        listing={listing}
        title="เที่ยวให้ครบ"
      />,
    );
    await click(
      page.container.querySelector("[data-detail-advertisement-card]")!,
    );
    const sources = Array.from(
      document.querySelectorAll("[data-image-src]"),
    ).map((node) => node.getAttribute("data-image-src"));
    expect(sources).toContain(`${image}?w=1920&q=75`);
    expect(sources).toContain(`${image}?w=160&q=60`);
    await page.unmount();
  });
});
