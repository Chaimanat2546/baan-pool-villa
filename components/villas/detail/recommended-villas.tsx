import type { RecommendedVillaSection } from "@/lib/villas/types";
import { VillaRail } from "../home/villa-rail";

export function RecommendedVillas({
  section,
}: {
  section: RecommendedVillaSection;
}) {
  if (section.villas.length === 0) {
    return null;
  }

  return (
    <div
      className="relative left-1/2 w-screen -translate-x-1/2"
      data-detail-recommended-villas="home-rail"
    >
      <VillaRail
        cardTitleHeadingLevel="h3"
        cta={section.cta}
        description={section.description}
        id="recommendations"
        title={section.title}
        titleHeadingLevel="h2"
        villas={section.villas}
      />
    </div>
  );
}
