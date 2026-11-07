import { buildVillaDetailContent } from "@/lib/villas/detail";
import type { PublicVillaImage } from "@/lib/villas/public-dto";
import { BookingCalendarProvider } from "./booking-calendar-provider";
import { BookingSidebar } from "./booking-sidebar";
import { VillaIntro } from "./content-sections";
import { VillaDetailClientShell } from "./detail-client-shell";
import { hasEnabledBookingContact } from "./detail-page-helpers";
import type { VillaDetailPageProps } from "./types";

const EMPTY_INITIAL_GALLERY_IMAGES: PublicVillaImage[] = [];
const EMPTY_ADVERTISEMENTS: NonNullable<VillaDetailPageProps["advertisements"]> = [];

export function VillaDetailPage({
  advertisements = EMPTY_ADVERTISEMENTS,
  advertisementCursor,
  contactSettings,
  currentBookingMonthKey,
  galleryStyle,
  id,
  initialBookingCalendar,
  initialGalleryImages = EMPTY_INITIAL_GALLERY_IMAGES,
  initialGalleryLoadFailed = false,
  initialGalleryPreviewImages = initialGalleryImages,
  payload,
  recommendedSection,
  settings,
  startingGuestCapacity,
  villaCardStyle,
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

      <BookingCalendarProvider
        key={id}
        currentMonthKey={currentBookingMonthKey}
        enabled={showMobileBookingContact}
        initialCalendar={initialBookingCalendar}
        villaId={id}
      >
        <VillaDetailClientShell
          bookingSidebarId={bookingSidebarId}
          advertisements={advertisements}
          advertisementCursor={advertisementCursor}
          contactSettings={contactSettings}
          content={content}
          galleryStyle={galleryStyle}
          id={id}
          initialGalleryImages={initialGalleryImages}
          initialGalleryLoadFailed={initialGalleryLoadFailed}
          initialGalleryPreviewImages={initialGalleryPreviewImages}
          listing={listing}
          recommendedSection={recommendedSection}
          settings={settings}
          villaCardStyle={villaCardStyle}
        >
          <div className="mx-auto w-full max-w-[402px] px-[22.5px] py-8 sm:max-w-7xl sm:px-6 lg:px-8">
            <VillaIntro
              content={content}
              listing={listing}
              startingGuestCapacity={startingGuestCapacity}
            />

            {showMobileBookingContact ? (
              <div className="mt-4 lg:hidden" data-mobile-booking-contact="true">
                <BookingSidebar
                  contactSettings={contactSettings}
                  content={content}
                  id="contact"
                  listing={listing}
                />
              </div>
            ) : null}
          </div>
        </VillaDetailClientShell>
      </BookingCalendarProvider>
    </main>
  );
}
