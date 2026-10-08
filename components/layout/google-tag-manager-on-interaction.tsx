"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const ACTIVATION_EVENTS = ["pointerdown", "keydown", "scroll"] as const;

export function GoogleTagManagerOnInteraction({ gtmId }: { gtmId: string }) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (isActive) {
      return;
    }

    const activate = () => {
      setIsActive(true);
    };

    for (const eventName of ACTIVATION_EVENTS) {
      window.addEventListener(eventName, activate, { once: true, passive: true });
    }

    return () => {
      for (const eventName of ACTIVATION_EVENTS) {
        window.removeEventListener(eventName, activate);
      }
    };
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  return (
    <>
      <Script id="google-tag-manager-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });`}
      </Script>
      <Script
        id="google-tag-manager"
        src={`https://www.googletagmanager.com/gtm.js?id=${gtmId}`}
        strategy="afterInteractive"
      />
    </>
  );
}
