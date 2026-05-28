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

export type AdminHomeSectionsResponse = {
  sections: AdminHomeSectionRow[];
};

export type AdminHomeSectionsSaveResponse = {
  sections?: unknown[];
  errors?: string[];
  error?: string;
};

export type AdminManualPreviewResponse = {
  valid: VillaListing[];
  missingIds: string[];
  invalidIds: string[];
  error?: string;
};
