import {
  ImageIcon,
  Info,
  MapPin,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import type { PublicAdvertisement } from "@/lib/advertisements/types";
import type {
  DetailLayoutBlock,
  DetailLayoutBlockType,
} from "@/lib/detail-layout/types";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { SiteContactSettings } from "@/lib/site-contact-settings/types";
import type { GalleryStyleSettings } from "@/lib/site-web-styles/types";
import type {
  VillaDetailContent,
  VillaDetailSection,
} from "@/lib/villas/detail";
import type { RecommendedVillaSection, VillaListing } from "@/lib/villas/types";
import { ActivityAdvertisementsSection } from "./activity-advertisements-section";
import { BookingSidebar } from "./booking-sidebar";
import { AmenitiesSection, VideoReviewSection } from "./content-sections";
import {
  DeferredRecommendedVillas,
  LazyDetailBlock,
} from "./deferred-detail-block";
import { findFact, findSection } from "./helpers";
import { LazyCategorizedImages } from "./lazy-categorized-images";
import { NearbySection } from "./nearby-section";
import type { GalleryCategory } from "./types";

interface DetailLayoutBlockContext {
  advertisements: PublicAdvertisement[];
  bookingSidebarId?: string;
  contactSettings: SiteContactSettings;
  content: VillaDetailContent;
  galleryCategories: GalleryCategory[];
  galleryStyle: GalleryStyleSettings;
  listing: VillaListing;
  recommendedSection: RecommendedVillaSection | null;
  settings: SiteSettings;
}

type BlockRenderer = (context: DetailLayoutBlockContext) => ReactNode | null;

const DEFAULT_COMPACT_LINE_LIMIT = 5;
const DEFERRED_DETAIL_BLOCK_TYPES = new Set<DetailLayoutBlockType>([
  "categorized_images",
  "costs_promotions",
  "rules_pet_policy",
  "map_nearby",
  "review_videos",
  "recommended_villas",
]);

const sectionTitles = {
  details: "รายละเอียดเพิ่มเติม",
  bedrooms: "รายละเอียดห้องนอน",
  pool: "สระว่ายน้ำ",
  kitchen: "ครัวและอุปกรณ์",
  parking: "ที่จอดรถ",
  costs: "ค่าใช้จ่ายเพิ่มเติม",
  promotions: "โปรโมชัน / ราคาแยกตามวัน",
  notes: "หมายเหตุ",
  rules: "กฎบ้านพัก",
  petPolicy: "นโยบายสัตว์เลี้ยง",
};

function DetailCard({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-[0_10px_30px_rgba(6,63,53,0.06)]">
      <div className="flex items-center gap-3">
        {icon ? (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
            {icon}
          </span>
        ) : null}
        <h2 className="text-xl font-black text-[var(--site-text)]">{title}</h2>
      </div>
      <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--site-muted)]">
        {children}
      </div>
    </section>
  );
}

function LineList({ lines }: { lines: string[] }) {
  return (
    <>
      <ul className="space-y-2">
        {lines.map((line, index) => (
          <li key={`${index}-${line}`} className="flex gap-2">
            <span>- {line}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function CompactLineList({
  initialCount = DEFAULT_COMPACT_LINE_LIMIT,
  lines,
}: {
  initialCount?: number;
  lines: string[];
}) {
  const visibleLines = lines.slice(0, initialCount);
  const hiddenLines = lines.slice(initialCount);

  if (hiddenLines.length === 0) {
    return <LineList lines={lines} />;
  }

  return (
    <>
      <LineList lines={visibleLines} />
      <details
        className="rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2"
        data-detail-compact-list="true"
      >
        <summary className="cursor-pointer text-sm font-black text-[var(--site-primary)]">
          ดูรายละเอียดเพิ่มอีก {hiddenLines.length.toLocaleString("th-TH")}{" "}
          รายการ
        </summary>
        <div className="mt-3 space-y-2">
          <LineList lines={hiddenLines} />
        </div>
      </details>
    </>
  );
}

function renderSectionBlock(
  content: VillaDetailContent,
  sourceTitle: string,
  publicTitle = sourceTitle,
) {
  const section = findSection(content, sourceTitle);

  if (!section || section.lines.length === 0) {
    return null;
  }

  return (
    <DetailCard icon={<Info className="h-5 w-5" />} title={publicTitle}>
      <CompactLineList lines={section.lines} />
    </DetailCard>
  );
}

function renderDetails({ content }: DetailLayoutBlockContext) {
  return renderSectionBlock(content, sectionTitles.details);
}

function renderBedrooms({ content }: DetailLayoutBlockContext) {
  return renderSectionBlock(content, sectionTitles.bedrooms);
}

function renderPool({ content }: DetailLayoutBlockContext) {
  return renderSectionBlock(content, sectionTitles.pool);
}

function renderKitchen({ content }: DetailLayoutBlockContext) {
  return renderSectionBlock(content, sectionTitles.kitchen);
}

function renderParking({ content }: DetailLayoutBlockContext) {
  return renderSectionBlock(content, sectionTitles.parking);
}

function renderAmenities({ content, listing }: DetailLayoutBlockContext) {
  const amenities =
    content.amenities.length > 0 ? content.amenities : listing.amenities;

  if (amenities.length === 0) {
    return null;
  }

  return <AmenitiesSection amenities={amenities} compact />;
}

function renderCategorizedImages({
  galleryCategories,
}: DetailLayoutBlockContext) {
  const previewCategories = galleryCategories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => !item.isCover),
    }))
    .filter((category) => category.items.length > 0)
    .slice(0, 6);

  if (previewCategories.length === 0) {
    return null;
  }

  return (
    <DetailCard
      icon={<ImageIcon className="h-5 w-5" />}
      title="รูปภาพตามหมวดหมู่"
    >
      <LazyCategorizedImages previewCategories={previewCategories} />
    </DetailCard>
  );
}

function hasSectionLines(
  section: VillaDetailSection | null,
): section is VillaDetailSection {
  return Boolean(section && section.lines.length > 0);
}

function renderCostsPromotions({ content }: DetailLayoutBlockContext) {
  const costs = findSection(content, sectionTitles.costs);
  const promotions = findSection(content, sectionTitles.promotions);
  const notes = findSection(content, sectionTitles.notes);
  const deposit = findFact(content.facts, "ค่าประกัน");
  const extraGuest = findFact(content.facts, "เสริมคน");
  const groups = [costs, promotions, notes].filter(hasSectionLines);

  if (groups.length === 0 && !deposit && !extraGuest) {
    return null;
  }

  return (
    <DetailCard
      icon={<ReceiptText className="h-5 w-5" />}
      title="ค่าใช้จ่ายและโปรโมชัน"
    >
      {deposit ? (
        <p className="rounded-xl bg-[var(--site-primary-soft)] p-3 font-black text-[var(--site-text)]">
          ค่าประกัน {deposit}
        </p>
      ) : null}
      {extraGuest ? (
        <p className="rounded-xl bg-[var(--site-primary-soft)] p-3 font-black text-[var(--site-text)]">
          เสริมคน {extraGuest}
        </p>
      ) : null}
      {groups.map((section) => (
        <div key={section.title}>
          <h3 className="font-black text-[var(--site-text)]">
            {section.title}
          </h3>
          <div className="mt-2 space-y-2">
            <CompactLineList initialCount={2} lines={section.lines} />
          </div>
        </div>
      ))}
    </DetailCard>
  );
}

function renderRulesPetPolicy({ content }: DetailLayoutBlockContext) {
  const rules = findSection(content, sectionTitles.rules);
  const petPolicy = findSection(content, sectionTitles.petPolicy);
  const groups = [rules, petPolicy].filter(hasSectionLines);

  if (groups.length === 0) {
    return null;
  }

  return (
    <DetailCard
      icon={<ShieldCheck className="h-5 w-5" />}
      title="กฎบ้านพักและสัตว์เลี้ยง"
    >
      {groups.map((section) => (
        <div key={section.title}>
          <h3 className="font-black text-[var(--site-text)]">
            {section.title}
          </h3>
          <div className="mt-2 space-y-2">
            <CompactLineList initialCount={4} lines={section.lines} />
          </div>
        </div>
      ))}
    </DetailCard>
  );
}

function renderAdvertisements({
  advertisements,
  galleryStyle,
  listing,
}: DetailLayoutBlockContext) {
  if (advertisements.length === 0) {
    return null;
  }

  return (
    <ActivityAdvertisementsSection
      advertisements={advertisements}
      galleryStyle={galleryStyle}
      listing={listing}
    />
  );
}

function renderMapNearby({ content }: DetailLayoutBlockContext) {
  if (content.nearbyPlaces.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-[0_10px_30px_rgba(6,63,53,0.06)]">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
          <MapPin className="h-5 w-5" />
        </span>
        <h2 className="text-xl font-black text-[var(--site-text)]">
          ทำเลและสถานที่ใกล้เคียง
        </h2>
      </div>
      <NearbySection content={content} />
    </section>
  );
}

function renderReviewVideos({ content }: DetailLayoutBlockContext) {
  if (content.videos.length === 0) {
    return null;
  }

  return <VideoReviewSection videos={content.videos} />;
}

function renderBookingContact({
  bookingSidebarId,
  contactSettings,
  content,
  listing,
}: DetailLayoutBlockContext) {
  return (
    <BookingSidebar
      contactSettings={contactSettings}
      content={content}
      id={bookingSidebarId}
      listing={listing}
    />
  );
}

function renderRecommendedVillas() {
  return <DeferredRecommendedVillas />;
}

const blockRenderers = {
  details: renderDetails,
  bedrooms: renderBedrooms,
  pool: renderPool,
  kitchen: renderKitchen,
  parking: renderParking,
  amenities: renderAmenities,
  categorized_images: renderCategorizedImages,
  costs_promotions: renderCostsPromotions,
  rules_pet_policy: renderRulesPetPolicy,
  advertisements: renderAdvertisements,
  map_nearby: renderMapNearby,
  review_videos: renderReviewVideos,
  booking_contact: renderBookingContact,
  recommended_villas: renderRecommendedVillas,
} satisfies Record<DetailLayoutBlockType, BlockRenderer>;

function isAllowedBlockType(value: string): value is DetailLayoutBlockType {
  return Object.prototype.hasOwnProperty.call(blockRenderers, value);
}

export function renderDetailLayoutBlock(
  block: DetailLayoutBlock,
  context: DetailLayoutBlockContext,
) {
  if (!block.enabled || !isAllowedBlockType(block.type)) {
    return null;
  }

  const node = blockRenderers[block.type](context);

  if (!node) {
    return null;
  }

  return DEFERRED_DETAIL_BLOCK_TYPES.has(block.type) ? (
    <LazyDetailBlock name={block.type}>{node}</LazyDetailBlock>
  ) : (
    node
  );
}
