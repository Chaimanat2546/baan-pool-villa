import { buildVillaDetailContent } from "@/lib/villas/detail";
import type { PublicVillaImage } from "@/lib/villas/public-dto";
import { BookingSidebar } from "./booking-sidebar";
import { VillaIntro } from "./content-sections";
import { VillaDetailClientShell } from "./detail-client-shell";
import { hasEnabledBookingContact } from "./detail-page-helpers";
import type { VillaDetailPageProps } from "./types";

const EMPTY_INITIAL_GALLERY_IMAGES: PublicVillaImage[] = [];
const EMPTY_ADVERTISEMENTS: NonNullable<VillaDetailPageProps["advertisements"]> = [];

export function VillaDetailPage({
  advertisements = EMPTY_ADVERTISEMENTS,
  bookingCalendars,
  contactSettings,
  currentBookingMonthKey,
  galleryStyle,
  id,
  initialGalleryImages = EMPTY_INITIAL_GALLERY_IMAGES,
  payload,
  recommendedSection,
  settings,
}: VillaDetailPageProps) {
  const { listing } = payload;
  const content = buildVillaDetailContent(payload.detail);
  const showMobileBookingContact = hasEnabledBookingContact(settings.detailLayout);
  const bookingSidebarId = showMobileBookingContact
    ? "desktop-contact"
    : "contact";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--site-surface-soft)] pb-24 text-[var(--site-text)] md:pb-0">
      <div className="mx-auto hidden w-full max-w-7xl items-center gap-2 px-4 py-4 text-xs font-semibold text-[var(--site-muted)] sm:px-6 lg:flex lg:px-8">
        <a href="/" className="hover:text-[var(--site-primary)]">
          Home
        </a>
        <span>{">"}</span>
        <a href="/" className="hover:text-[var(--site-primary)]">
          Pattaya Villas
        </a>
        <span>{">"}</span>
        <span className="text-[var(--site-primary)]">{listing.zoneLabel}</span>
      </div>

      <VillaDetailClientShell
        bookingSidebarId={bookingSidebarId}
        advertisements={advertisements}
        bookingCalendars={bookingCalendars}
        contactSettings={contactSettings}
        content={content}
        currentBookingMonthKey={currentBookingMonthKey}
        galleryStyle={galleryStyle}
        id={id}
        initialGalleryImages={initialGalleryImages}
        listing={listing}
        recommendedSection={recommendedSection}
        settings={settings}
      >
        <div className="mx-auto w-full max-w-[402px] px-[22.5px] py-8 sm:max-w-7xl sm:px-6 lg:px-8">
          <VillaIntro content={content} listing={listing} />

          {showMobileBookingContact ? (
            <div className="mt-4 lg:hidden" data-mobile-booking-contact="true">
              <BookingSidebar
                bookingCalendars={bookingCalendars}
                contactSettings={contactSettings}
                content={content}
                currentBookingMonthKey={currentBookingMonthKey}
                id="contact"
                listing={listing}
              />
            </div>
          ) : null}
        </div>
      </VillaDetailClientShell>
    </main>
  );
}
