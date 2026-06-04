import type { SiteTikTokSettings } from "@/lib/site-settings/types";

export interface AdminTikTokDraft {
  accountUrl: string;
  videoUrls: string[];
  videoRowIds: string[];
}

export interface AdminTikTokResponse {
  code?: string;
  details?: string;
  error?: string;
  errors?: string[];
  hint?: string;
  settings?: SiteTikTokSettings;
  warning?: string;
  warnings?: string[];
}
