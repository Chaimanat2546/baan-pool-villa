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
    <VillaRail
      cardTitleHeadingLevel="h3"
      cta={section.cta}
      description={section.description}
      id="recommendations"
      title={section.title}
      titleHeadingLevel="h2"
      villas={section.villas}
    />
  );
}
