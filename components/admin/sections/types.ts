import type { HomeSectionDraft } from "@/lib/home-sections/types";

export type AdminSectionItemDraft = HomeSectionDraft["items"][number] & {
  position?: number;
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
  validIds: string[];
  missingIds: string[];
  invalidIds: string[];
  error?: string;
}
