import {
  ArrowRight,
  Check,
  ImageIcon,
  Info,
  MapPin,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import type {
  DetailLayoutBlock,
  DetailLayoutBlockType,
} from "@/lib/detail-layout/types";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import { BookingSidebar } from "./booking-sidebar";
import { AmenitiesSection, VideoReviewSection } from "./content-sections";
import { findFact, findSection } from "./helpers";
import { NearbySection } from "./nearby-section";
import { RecommendedVillas } from "./recommended-villas";
import type { GalleryCategory } from "./types";

interface DetailLayoutBlockContext {
  content: VillaDetailContent;
  galleryCategories: GalleryCategory[];
  listing: VillaListing;
  recommendedVillas: VillaListing[];
  settings: SiteSettings;
}

type BlockRenderer = (context: DetailLayoutBlockContext) => ReactNode | null;

const sectionTitles = {
  details: "รายละเอียดเพิ่มเติม",
  bedrooms: "รายละเอียดห้องนอน",
  pool: "สระว่ายน้ำ",
  kitchen: "ครัวและอุปกรณ์",
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
    <section className="h-full rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-[0_10px_30px_rgba(6,63,53,0.06)]">
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
      {lines.map((line, index) => (
        <p key={`${index}-${line}`} className="flex gap-2">
          <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--site-primary)]" />
          <span>{line}</span>
        </p>
      ))}
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
      <LineList lines={section.lines} />
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

function renderAmenities({ listing }: DetailLayoutBlockContext) {
  if (listing.amenities.length === 0) {
    return null;
  }

  return <AmenitiesSection listing={listing} />;
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {previewCategories.map((category) => {
          const previewItem = category.items[0];

          if (!previewItem) {
            return null;
          }

          return (
            <div
              key={category.key}
              className="overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface-soft)]"
            >
              <div className="relative aspect-[4/3] bg-[var(--site-surface-tint)]">
                <Image
                  alt={previewItem.caption ?? category.label}
                  className="object-cover"
                  fill
                  sizes="(max-width: 1024px) 50vw, 320px"
                  src={previewItem.url}
                  unoptimized
                />
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate text-sm font-black text-[var(--site-text)]">
                  {category.label}
                </span>
                <span className="shrink-0 text-xs font-bold text-[var(--site-muted)]">
                  {category.items.length.toLocaleString("th-TH")} รูป
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </DetailCard>
  );
}

function renderCostsPromotions({ content }: DetailLayoutBlockContext) {
  const costs = findSection(content, sectionTitles.costs);
  const promotions = findSection(content, sectionTitles.promotions);
  const notes = findSection(content, sectionTitles.notes);
  const deposit = findFact(content.facts, "ค่าประกัน");
  const extraGuest = findFact(content.facts, "เสริมคน");
  const groups = [
    costs,
    promotions,
    notes,
  ].filter((section): section is NonNullable<typeof section> =>
    Boolean(section && section.lines.length > 0),
  );

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
          <h3 className="font-black text-[var(--site-text)]">{section.title}</h3>
          <div className="mt-2 space-y-2">
            <LineList lines={section.lines} />
          </div>
        </div>
      ))}
    </DetailCard>
  );
}

function renderRulesPetPolicy({ content }: DetailLayoutBlockContext) {
  const rules = findSection(content, sectionTitles.rules);
  const petPolicy = findSection(content, sectionTitles.petPolicy);
  const groups = [rules, petPolicy].filter(
    (section): section is NonNullable<typeof section> =>
      Boolean(section && section.lines.length > 0),
  );

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
          <h3 className="font-black text-[var(--site-text)]">{section.title}</h3>
          <div className="mt-2 space-y-2">
            <LineList lines={section.lines} />
          </div>
        </div>
      ))}
    </DetailCard>
  );
}

function renderMapNearby({ content }: DetailLayoutBlockContext) {
  if (!content.location && content.nearbyPlaces.length === 0) {
    return null;
  }

  return (
    <section className="h-full rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-[0_10px_30px_rgba(6,63,53,0.06)]">
      {content.location ? (
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
              <MapPin className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-black text-[var(--site-text)]">
              ทำเลและสถานที่ใกล้เคียง
            </h2>
          </div>
          <div className="mt-4 space-y-2 text-sm leading-7 text-[var(--site-muted)]">
            {content.location.address ? <p>{content.location.address}</p> : null}
            {content.location.seaDistance ? (
              <p>ห่างทะเล {content.location.seaDistance}</p>
            ) : null}
            {content.location.mapUrl ? (
              <a
                className="inline-flex items-center gap-1 font-black text-[var(--site-primary)] underline-offset-4 hover:underline"
                href={content.location.mapUrl}
                rel="noreferrer"
                target="_blank"
              >
                เปิดแผนที่ <ArrowRight className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
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
  content,
  listing,
  settings,
}: DetailLayoutBlockContext) {
  return (
    <BookingSidebar content={content} listing={listing} settings={settings} />
  );
}

function renderRecommendedVillas({
  recommendedVillas,
}: DetailLayoutBlockContext) {
  if (recommendedVillas.length === 0) {
    return null;
  }

  return <RecommendedVillas villas={recommendedVillas} />;
}

const blockRenderers = {
  details: renderDetails,
  bedrooms: renderBedrooms,
  pool: renderPool,
  kitchen: renderKitchen,
  amenities: renderAmenities,
  categorized_images: renderCategorizedImages,
  costs_promotions: renderCostsPromotions,
  rules_pet_policy: renderRulesPetPolicy,
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

  return blockRenderers[block.type](context);
}
