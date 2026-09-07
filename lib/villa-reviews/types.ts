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

export interface AdminVillaReviewImage {
  id: string;
  url: string;
  displayOrder: number;
}

export interface VillaReviewEditLog {
  id: string;
  reviewId: string;
  beforeSnapshot: Record<string, unknown>;
  afterSnapshot: Record<string, unknown>;
  createdAt: string;
}

export interface AdminVillaReviewListItem {
  id: string;
  villaId: string;
  villaTitle: string;
  rating: number;
  commentExcerpt: string;
  maskedPhone: string;
  imageCount: number;
  reviewImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVillaReviewDetail extends AdminVillaReviewListItem {
  comment: string;
  phoneE164: string;
  bookingCode: string;
  images: AdminVillaReviewImage[];
  editLogs: VillaReviewEditLog[];
}

export interface AdminVillaReviewListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  rating?: number;
  villaId?: string;
  dateFrom?: string;
  dateTo?: string;
  hasImages?: boolean;
  sort?: "newest" | "oldest" | "highest" | "lowest";
}

export interface AdminVillaReviewListResult {
  items: AdminVillaReviewListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminReviewUpdateInput {
  rating: unknown;
  comment: unknown;
  retainedImageIds: unknown;
}

export interface AdminReviewUpdateValue {
  rating: number;
  comment: string;
  retainedImageIds: string[];
}

export interface AdminReviewUpdateValidationResult {
  ok: boolean;
  value?: AdminReviewUpdateValue;
  fieldErrors: Record<string, string>;
  detectedWords: string[];
}
