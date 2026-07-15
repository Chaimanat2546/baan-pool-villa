import type { CSSProperties } from "react";
import type { GalleryStyleSettings } from "@/lib/site-web-styles/types";

export type GalleryModalCssProperties = CSSProperties & {
  "--gallery-modal-background"?: string;
  "--gallery-modal-text"?: string;
  "--site-on-primary"?: string;
};

export function getGalleryModalStyle(
  style: GalleryStyleSettings,
): GalleryModalCssProperties {
  return {
    ...(style.backgroundColor
      ? { "--gallery-modal-background": style.backgroundColor }
      : {}),
    ...(style.textColor
      ? {
          "--gallery-modal-text": style.textColor,
          "--site-on-primary": style.textColor,
        }
      : {}),
  };
}
