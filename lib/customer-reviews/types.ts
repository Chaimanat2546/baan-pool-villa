export const CUSTOMER_REVIEW_HOMEPAGE_LAYOUTS = [
  "featured_rail",
  "proof_wall",
  "carousel",
] as const;

export type CustomerReviewHomepageLayout =
  (typeof CUSTOMER_REVIEW_HOMEPAGE_LAYOUTS)[number];

export const DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT: CustomerReviewHomepageLayout =
  "proof_wall";

const CUSTOMER_REVIEW_HOMEPAGE_LAYOUT_SET = new Set<string>(
  CUSTOMER_REVIEW_HOMEPAGE_LAYOUTS,
);

export interface HomepageCustomerReviewImage {
  alt: string;
  id: string;
  order: number;
  url: string;
}

export interface HomepageCustomerReviewData {
  images: HomepageCustomerReviewImage[];
  layout: CustomerReviewHomepageLayout;
}

export interface AdminCustomerReviewImage {
  alt: string;
  createdAt: string;
  homepageOrder: number | null;
  id: string;
  isActive: boolean;
  isHomepage: boolean;
  path: string;
  updatedAt: string;
  url: string;
}

export function normalizeCustomerReviewHomepageLayout(
  value: unknown,
): CustomerReviewHomepageLayout | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return CUSTOMER_REVIEW_HOMEPAGE_LAYOUT_SET.has(normalized)
    ? (normalized as CustomerReviewHomepageLayout)
    : null;
}

export function toPublicCustomerReviewHomepageLayout(
  value: unknown,
): CustomerReviewHomepageLayout {
  return (
    normalizeCustomerReviewHomepageLayout(value) ??
    DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT
  );
}
