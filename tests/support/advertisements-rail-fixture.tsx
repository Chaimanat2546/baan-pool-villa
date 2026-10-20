// Browser-only fixture: renders the actual component without writing to any CMS.
import { createRoot } from "react-dom/client";
import { ActivityAdvertisementsSection } from "@/components/villas/detail/activity-advertisements-section";
import { DEFAULT_SITE_WEB_STYLES } from "@/lib/site-web-styles/defaults";
import type { VillaListing } from "@/lib/villas/types";

const listing: VillaListing = { id: "88", amenities: [], bathrooms: 2, bedrooms: 3, coverImage: null, distanceToSea: "500m", people: 8, poolType: "private", price: 12000, zone: "pattaya", zoneLabel: "พัทยา" };
const advertisements = Array.from({ length: 8 }, (_, index) => {
  const id = `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
  const imageUrl = `/api/advertisements/images/20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
  return { id, title: `กิจกรรม ${index + 1} ล่องเรือชมทะเลสำหรับครอบครัว`, imageUrl, imageUrls: [imageUrl] };
});
createRoot(document.getElementById("root")!).render(
  <div style={{ maxWidth: 1120, margin: "32px auto", padding: "0 16px" }}>
    <ActivityAdvertisementsSection advertisements={advertisements} nextCursor={`7:${advertisements[7].id}`} listing={listing} galleryStyle={DEFAULT_SITE_WEB_STYLES.gallery} title="กิจกรรมที่น่าสนใจ" />
  </div>,
);
