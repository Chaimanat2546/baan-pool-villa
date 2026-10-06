"use client";
import type { ComponentProps } from "react";
import { track } from "@/lib/analytics/client";
import type { ContactChannel } from "@/lib/analytics/types";
export function AnalyticsContactLink({
  channel,
  villaId = null,
  onClick,
  ...props
}: ComponentProps<"a"> & {
  channel: ContactChannel | null;
  villaId?: string | null;
}) {
  return (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && channel)
          track({
            event_name: "contact_click",
            channel,
            villa_id: villaId,
            page_path: window.location.pathname,
          });
      }}
    />
  );
}
