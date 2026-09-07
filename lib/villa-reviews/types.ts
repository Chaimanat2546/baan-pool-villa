export type ReviewSort = "newest" | "rating_desc" | "rating_asc";

export interface PublicVillaReviewImage {
  id: string;
  url: string;
}

export interface PublicVillaReview {
  id: string;
  villaId: string;
  rating: number;
  comment: string;
  maskedPhone: string;
  images: PublicVillaReviewImage[];
  createdAt: string;
  updatedAt: string;
}

export interface VillaReviewSummary {
  averageRating: number;
  totalCount: number;
  ratingCounts: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface ReviewPage {
  summary: VillaReviewSummary;
  items: PublicVillaReview[];
  nextCursor: string | null;
}

export interface ReviewSubmissionInput {
  villaId: string;
  bookingCode: string;
  phone: string;
  rating: number;
  comment: string;
}

export interface ReviewValidationResult {
  ok: boolean;
  fieldErrors: Record<string, string>;
  detectedWords: string[];
}

export interface ReviewFileValidationResult {
  ok: boolean;
  errors: Record<string, string>;
}
