import type {
  HomePageLayoutItem,
  HomeSectionDraft,
} from "@/lib/home-sections/types";

export type AdminSectionItemDraft = HomeSectionDraft["items"][number] & {
  position?: number;
};

export type AdminSectionDraft = Omit<HomeSectionDraft, "items"> & {
  draftId: string;
  displayOrder: number;
  isNew: boolean;
  items: AdminSectionItemDraft[];
};

export type AdminHomeSectionRow = Omit<
  AdminSectionDraft,
  "draftId" | "isNew"
>;

export interface AdminHomeSectionsResponse {
  layout: HomePageLayoutItem[];
  sections: AdminHomeSectionRow[];
}

export interface AdminHomeSectionsSaveResponse {
  sections?: unknown[];
  errors?: string[];
  error?: string;
  warnings?: string[];
}

export interface AdminManualPreviewResponse {
  validIds: string[];
  missingIds: string[];
  invalidIds: string[];
  error?: string;
}
