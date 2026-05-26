import type { VillaListing } from "@/lib/villas/types";
import { VillaRail } from "../home/villa-rail";

export function RecommendedVillas({ villas }: { villas: VillaListing[] }) {
  if (villas.length === 0) {
    return null;
  }

  return (
    <VillaRail
      cta
      id="recommendations"
      title="บ้านพักแนะนำ"
      description="พูลวิลล่าคัดพิเศษ เหมาะสำหรับครอบครัว กลุ่มเพื่อน และทริปพักผ่อนส่วนตัว"
      villas={villas}
    />
  );
}
