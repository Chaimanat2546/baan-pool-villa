"use client";

import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ScrollRail } from "@/components/ui/scroll-rail";
import type { VillaListing } from "@/lib/villas/types";
import type { SiteVillaCardStyle } from "@/lib/site-web-styles/types";

import { VillaCard } from "../listing/villa-card";
import { SectionHeader } from "./section-header";

interface VillaRailCtaConfig {
  href: string;
  label: string;
}

interface VillaRailProps {
  cardTitleHeadingLevel?: "h2" | "h3";
  autoScrollEnabled?: boolean;
  cta?: boolean | VillaRailCtaConfig;
  description: string;
  continuationRailKey?: string;
  id?: string;
  title: string;
  titleHeadingLevel?: "h1" | "h2";
  villaCardStyle?: SiteVillaCardStyle;
  villas: VillaListing[];
}

const DEFAULT_CTA_CONFIG: VillaRailCtaConfig = {
  href: "/search",
  label: "\u0e14\u0e39\u0e1a\u0e49\u0e32\u0e19\u0e1e\u0e31\u0e01\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14",
};
const MAX_RENDERED_VILLA_RAIL_ITEMS = 12;
const INITIAL_ACTIVE_CARD_COUNT = 4;

function sanitizeCtaHref(href: string): string {
  if (href.startsWith("/") && !href.startsWith("//")) {
    return href;
  }

  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : DEFAULT_CTA_CONFIG.href;
  } catch {
    return DEFAULT_CTA_CONFIG.href;
  }
}

function getVillaRailCtaConfig(
  cta: VillaRailProps["cta"],
): VillaRailCtaConfig | null {
  if (cta === true) {
    return DEFAULT_CTA_CONFIG;
  }

  if (cta === false || typeof cta === "undefined") {
    return null;
  }

  return cta;
}

export function VillaRail({
  cardTitleHeadingLevel = "h2",
  autoScrollEnabled = false,
  cta,
  description,
  continuationRailKey,
  id,
  title,
  titleHeadingLevel = "h1",
  villaCardStyle,
  villas,
}: VillaRailProps) {
  const ctaConfig = getVillaRailCtaConfig(cta);
  const ctaHref = ctaConfig ? sanitizeCtaHref(ctaConfig.href) : null;
  const [renderedVillas, setRenderedVillas] = useState(() =>
    villas.slice(0, MAX_RENDERED_VILLA_RAIL_ITEMS),
  );
  const [hasMoreVillas, setHasMoreVillas] = useState(
    () => Boolean(continuationRailKey),
  );
  const [continuationStatus, setContinuationStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const continuationControllerRef = useRef<AbortController | null>(null);
  const continuationLoadingRef = useRef(false);
  const continuationOffsetRef = useRef(INITIAL_ACTIVE_CARD_COUNT);
  const lastSelectedIndexRef = useRef(0);
  const [activeCardIndexes, setActiveCardIndexes] = useState(
    () => new Set(Array.from({ length: INITIAL_ACTIVE_CARD_COUNT }, (_, index) => index)),
  );
  useEffect(
    () => () => continuationControllerRef.current?.abort(),
    [],
  );

  const loadContinuation = useCallback(async (
    selectedIndex: number,
    force = false,
  ) => {
    if (
      !continuationRailKey ||
      !hasMoreVillas ||
      continuationLoadingRef.current ||
      (!force && selectedIndex < renderedVillas.length - 3) ||
      continuationOffsetRef.current >= MAX_RENDERED_VILLA_RAIL_ITEMS
    ) {
      return;
    }

    continuationLoadingRef.current = true;
    setContinuationStatus("loading");
    const controller = new AbortController();
    continuationControllerRef.current = controller;
    const requestedOffset = continuationOffsetRef.current;
    const requestParams = new URLSearchParams({
      rail: continuationRailKey,
      offset: String(requestedOffset),
    });
    renderedVillas.forEach((villa) => requestParams.append("exclude", villa.id));

    try {
      const response = await fetch(
        `/api/home-rail?${requestParams.toString()}`,
        { cache: "force-cache", signal: controller.signal },
      );

      if (!response.ok) {
        throw new Error(`Critical rail continuation failed: ${response.status}`);
      }

      const payload = (await response.json()) as {
        hasMore: boolean;
        nextOffset?: number;
        villas: VillaListing[];
      };
      const nextOffset =
        payload.nextOffset ??
        Math.min(
          requestedOffset + INITIAL_ACTIVE_CARD_COUNT,
          MAX_RENDERED_VILLA_RAIL_ITEMS,
        );

      if (
        nextOffset !==
        Math.min(
          requestedOffset + INITIAL_ACTIVE_CARD_COUNT,
          MAX_RENDERED_VILLA_RAIL_ITEMS,
        )
      ) {
        throw new Error("Critical rail continuation returned an invalid cursor");
      }

      if (controller.signal.aborted) {
        return;
      }

      const existingIds = new Set(renderedVillas.map((villa) => villa.id));
      const appendedVillas = payload.villas.filter(
        (villa) => !existingIds.has(villa.id),
      );
      const nextVillas = [...renderedVillas, ...appendedVillas].slice(
        0,
        MAX_RENDERED_VILLA_RAIL_ITEMS,
      );

      setRenderedVillas(nextVillas);
      setActiveCardIndexes(
        new Set(Array.from({ length: nextVillas.length }, (_, index) => index)),
      );
      continuationOffsetRef.current = nextOffset;
      setHasMoreVillas(
        payload.hasMore &&
          nextOffset < MAX_RENDERED_VILLA_RAIL_ITEMS &&
          nextVillas.length < MAX_RENDERED_VILLA_RAIL_ITEMS,
      );
      setContinuationStatus("idle");
    } catch (error) {
      if (
        !controller.signal.aborted &&
        (!(error instanceof DOMException) || error.name !== "AbortError")
      ) {
        console.error("Unable to load critical rail continuation", error);
        setContinuationStatus("error");
      }
    } finally {
      if (continuationControllerRef.current === controller) {
        continuationControllerRef.current = null;
        continuationLoadingRef.current = false;
      }
    }
  }, [continuationRailKey, hasMoreVillas, renderedVillas]);

  const activateCardWindow = useCallback((selectedIndex: number) => {
    lastSelectedIndexRef.current = selectedIndex;
    setActiveCardIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes);

      for (
        let index = selectedIndex;
        index < Math.min(selectedIndex + INITIAL_ACTIVE_CARD_COUNT, renderedVillas.length);
        index += 1
      ) {
        nextIndexes.add(index);
      }

      return nextIndexes.size === currentIndexes.size ? currentIndexes : nextIndexes;
    });
    void loadContinuation(selectedIndex);
  }, [loadContinuation, renderedVillas.length]);

  const retryContinuation = useCallback(() => {
    void loadContinuation(lastSelectedIndexRef.current, true);
  }, [loadContinuation]);

  return (
    <section
      id={id}
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14"
      data-home-villa-rail="true"
    >
      <SectionHeader
        title={title}
        titleHeadingLevel={titleHeadingLevel}
        description={description}
      />
      <ScrollRail
        label={title}
        autoScroll={autoScrollEnabled}
        className="-mx-4 mt-4 gap-5 px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:gap-6 lg:px-8 lg:py-8"
        onActiveIndexChange={activateCardWindow}
      >
        {renderedVillas.map((villa, index) => (
          <div key={villa.id} className="w-[290px] shrink-0 snap-start">
            <VillaCard
              coverImageActive={activeCardIndexes.has(index)}
              imageLoading="eager"
              villa={villa}
              villaCardStyle={villaCardStyle}
              titleHeadingLevel={cardTitleHeadingLevel}
            />
          </div>
        ))}
      </ScrollRail>
      {continuationStatus === "loading" ? (
        <p
          className="mt-2 text-center text-sm font-semibold text-slate-600"
          data-home-rail-continuation="loading"
          role="status"
        >
          กำลังโหลดบ้านพักเพิ่มเติม…
        </p>
      ) : null}
      {continuationStatus === "error" ? (
        <div
          className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-700"
          data-home-rail-continuation="error"
          role="alert"
        >
          <span>โหลดบ้านพักเพิ่มไม่สำเร็จ</span>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-bold text-[var(--site-primary)] transition hover:border-[var(--site-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary)]"
            data-home-rail-retry="true"
            onClick={retryContinuation}
          >
            ลองอีกครั้ง
          </button>
        </div>
      ) : null}
      {ctaConfig ? (
        <div className="mt-8 text-center">
          <a
            href={ctaHref ?? DEFAULT_CTA_CONFIG.href}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--site-primary)] px-5 py-3 text-sm font-black text-[var(--site-on-primary)] shadow-[0_14px_30px_rgba(6,77,61,0.22)] transition hover:bg-[var(--site-primary-hover)]"
          >
            {ctaConfig.label} <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      ) : null}
    </section>
  );
}
