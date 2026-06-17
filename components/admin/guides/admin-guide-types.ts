import type { GuideDraft } from "@/lib/guides/types";

export type AdminGuideDraft = GuideDraft & {
  createdAt?: string;
  draftId: string;
  id?: string;
  updatedAt?: string;
};
