import type {
  SiteTikTokSettings,
  SiteTikTokVideoSettings,
} from "@/lib/site-settings/types";

export interface AdminTikTokVideoSettings extends SiteTikTokVideoSettings {
  villaTitle?: string | null;
}

export interface AdminTikTokSettings extends Omit<SiteTikTokSettings, "videos"> {
  videos: AdminTikTokVideoSettings[];
}

export interface AdminTikTokVideoDraft {
  houseId: string | null;
  id: string;
  url: string;
  villaTitle: string | null;
}

export interface TikTokVillaOption {
  id: string;
  title: string;
}

export interface AdminTikTokDraft {
  accountUrl: string;
  videos: AdminTikTokVideoDraft[];
}

export interface AdminTikTokResponse {
  code?: string;
  details?: string;
  error?: string;
  errors?: string[];
  hint?: string;
  settings?: AdminTikTokSettings;
  warning?: string;
  warnings?: string[];
}
