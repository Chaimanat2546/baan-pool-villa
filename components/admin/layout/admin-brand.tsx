"use client";

import { useState } from "react";
import { CspSafeImage } from "@/components/ui/csp-safe-image";
import { buildSiteAssetImageProxyPath, normalizePublicImageSourceUrl } from "@/lib/public-image-proxy";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import { SITE_LOGO_BACKGROUND_CLASSES } from "@/lib/site-settings/logo-background";
import type { SiteSettings } from "@/lib/site-settings/types";

export function AdminBrand({ collapsed = false, settings }: { collapsed?: boolean; settings: SiteSettings }) {
  const source = normalizePublicImageSourceUrl(settings.logoImage.url)
    ? buildSiteAssetImageProxyPath("logo")
    : settings.logoImage.url;
  const [failedSource, setFailedSource] = useState<string | null>(null);

  return (
    <span className={`flex h-11 shrink-0 items-center rounded-md ${SITE_LOGO_BACKGROUND_CLASSES[settings.logoBackground]} ${collapsed ? "w-11 justify-center" : "min-w-0 flex-1"}`}>
      <CspSafeImage
        alt={settings.logoImage.alt || settings.siteName}
        className={`h-11 object-contain ${collapsed ? "w-11" : "w-full max-w-40 object-left"}`}
        height={44}
        onError={() => setFailedSource(source)}
        src={failedSource === source ? DEFAULT_SITE_SETTINGS.logoImage.url : source}
        width={160}
      />
    </span>
  );
}
