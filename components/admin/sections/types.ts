import type { HomeSectionDraft } from "@/lib/home-sections/types";
import type { VillaListing } from "@/lib/villas/types";

export type AdminSectionItemDraft = HomeSectionDraft["items"][number] & {
  position?: number;
  isActive?: boolean;
};

export type AdminSectionDraft = Omit<HomeSectionDraft, "items"> & {
  draftId: string;
  displayOrder: number;
  items: AdminSectionItemDraft[];
};

export type AdminHomeSectionRow = Omit<AdminSectionDraft, "draftId">;

export interface AdminHomeSectionsResponse {
  sections: AdminHomeSectionRow[];
}

export interface AdminHomeSectionsSaveResponse {
  sections?: unknown[];
  errors?: string[];
  error?: string;
}

export interface AdminManualPreviewResponse {
  valid: VillaListing[];
  missingIds: string[];
  invalidIds: string[];
  error?: string;
}
