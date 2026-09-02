import type {
  PublicRecommendedVillaSection,
  PublicVillaDetailPayload,
  PublicVillaImage,
} from "@/lib/villas/public-dto";
import type { PublicAdvertisement } from "@/lib/advertisements/types";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { SiteContactSettings } from "@/lib/site-contact-settings/types";
import type {
  GalleryStyleSettings,
  SiteVillaCardStyle,
} from "@/lib/site-web-styles/types";
import type { BookingCalendarMonth } from "@/lib/villas/booking-calendar";

export interface VillaDetailPageProps {
  advertisements?: PublicAdvertisement[];
  bookingCalendars: Record<string, BookingCalendarMonth>;
  contactSettings: SiteContactSettings;
  currentBookingMonthKey: string;
  galleryStyle: GalleryStyleSettings;
  id: string;
  initialGalleryImages?: PublicVillaImage[];
  initialGalleryLoadFailed?: boolean;
  initialGalleryPreviewImages?: PublicVillaImage[];
  payload: PublicVillaDetailPayload;
  recommendedSection: PublicRecommendedVillaSection | null;
  settings: SiteSettings;
  villaCardStyle?: SiteVillaCardStyle;
}

export interface GalleryItem {
  key: string;
  url: string;
  caption: string | null;
  isCover: boolean;
  imageName: string | null;
  isMock: boolean;
  zone: string | null;
  zoneLabel: string;
  zoneKey: string;
}

export interface GalleryCategory {
  key: string;
  label: string;
  items: GalleryItem[];
}
