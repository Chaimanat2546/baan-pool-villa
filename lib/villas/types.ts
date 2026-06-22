export type AmenityKey =
  | "wifi"
  | "grill"
  | "pet"
  | "snooker"
  | "discotech"
  | "fancyring"
  | "tabletennis"
  | "slider"
  | "billard"
  | "swimming_kid"
  | "karaoke"
  | "airhockey"
  | "jacuzzi"
  | "bath";

export type Amenity = {
  key: AmenityKey;
  label: string;
};

export type RawHouse = {
  h_id: string | number;
  h_zone: string | null;
  h_bedroom: string | number | null;
  h_toilet: string | number | null;
  h_farsea: string | null;
  price: string | number | null;
  people: string | number | null;
  img_name: string | null;
  swim: string | null;
} & Record<AmenityKey, "y" | "n" | string | null>;

export type VillaListing = {
  id: string;
  title?: string;
  zone: string;
  zoneLabel: string;
  bedrooms: number;
  bathrooms: number;
  distanceToSea: string;
  price: number;
  people: number;
  coverImage: string | null;
  amenities: Amenity[];
  poolType: string;
};

export type VillaFilters = {
  zone: string;
  guests: number;
  bedrooms: number;
  amenities: AmenityKey[];
  maxPrice: number;
  nearSeaOnly: boolean;
};

export type VillaImage = {
  id: number;
  imageUrl: string;
  imageName: string | null;
  caption: string | null;
  isCover: boolean;
  zone: string | null;
};

export type VillaDetailPayload = {
  listing: VillaListing;
  detail: unknown;
  detailStatus: "available" | "missing_token" | "unavailable";
};

export type RecommendedVillaSection = {
  cta?: {
    href: string;
    label: string;
  };
  description: string;
  title: string;
  villas: VillaListing[];
};
