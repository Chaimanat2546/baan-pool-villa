"use client";

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";

import type { HomepageCustomerReviewData } from "@/lib/customer-reviews/types";
import type { PublicGuideSummary } from "@/lib/guides/public-dto";
import type {
  HomePageLayoutItem,
  ResolvedHomeSection,
} from "@/lib/home-sections/types";
import type { SiteVillaCardStyle } from "@/lib/site-web-styles/types";

import { HomePageContent, type HomePageContentSettings } from "./page";
import { VillaRailSkeleton } from "./villa-rail-skeleton";

interface DeferredHomePayload {
  customerReviews: HomepageCustomerReviewData;
  degradedSources: {
    guidePosts: boolean;
    homeSections: boolean;
    villaCatalog: boolean;
  };
  guides: PublicGuideSummary[];
  layout: HomePageLayoutItem[];
  sections: ResolvedHomeSection[];
}

interface DeferredHomeContentProps {
  criticalContent: ReactNode;
  criticalRailKey: string | null;
  homeLayout: HomePageLayoutItem[];
  settings: HomePageContentSettings;
  villaCardStyle?: SiteVillaCardStyle;
}

type DeferredState =
  | { status: "idle" | "loading" }
  | { status: "error" }
  | { payload: DeferredHomePayload; status: "ready" };

const FIXED_PLACEHOLDER_HEIGHTS: Record<
  Extract<HomePageLayoutItem, { kind: "fixed" }>['key'],
  string
> = {
  articles: "min-h-[360px] lg:min-h-[440px]",
  contact: "min-h-[300px] lg:min-h-[360px]",
  customer_reviews: "min-h-[340px] lg:min-h-[400px]",
  faq: "min-h-[320px] lg:min-h-[380px]",
  tiktok: "min-h-[380px] lg:min-h-[460px]",
  why_choose: "min-h-[340px] lg:min-h-[400px]",
};

function DeferredLayoutPlaceholder({
  error = false,
  item,
  triggerRef,
}: {
  error?: boolean;
  item: HomePageLayoutItem;
  triggerRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      aria-busy={error ? undefined : "true"}
      data-home-deferred-placeholder-key={item.key}
      data-home-deferred-placeholder-kind={item.kind}
      data-home-deferred-state={triggerRef ? (error ? "error" : "loading") : undefined}
      data-home-deferred-trigger={triggerRef ? "true" : undefined}
      ref={triggerRef}
    >
      {error ? (
        <p className="sr-only" role="status">
          ไม่สามารถโหลดเนื้อหาส่วนถัดไปได้
        </p>
      ) : null}
      {item.kind === "rail" ? (
        <VillaRailSkeleton cardCount={4} withCta={false} />
      ) : (
        <section
          aria-hidden="true"
          className={`mx-auto w-full max-w-7xl animate-pulse px-4 py-10 sm:px-6 lg:px-8 lg:py-14 ${FIXED_PLACEHOLDER_HEIGHTS[item.key]}`}
        >
          <div className="mx-auto h-7 w-56 rounded-lg bg-slate-200" />
          <div className="mx-auto mt-4 h-4 w-full max-w-lg rounded bg-slate-200" />
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="h-32 rounded-2xl bg-slate-200" />
            <div className="h-32 rounded-2xl bg-slate-200" />
            <div className="h-32 rounded-2xl bg-slate-200" />
          </div>
        </section>
      )}
    </div>
  );
}

function getHydratedDocumentLayout(
  deferredLayout: HomePageLayoutItem[],
  homeLayout: HomePageLayoutItem[],
  criticalRailKey: string | null,
): HomePageLayoutItem[] {
  const deferredItemKeys = new Set(
    deferredLayout
      .filter((item) => item.enabled)
      .map((item) => `${item.kind}:${item.key}`),
  );

  return homeLayout.filter(
    (item) =>
      item.enabled &&
      (item.kind === "rail" && item.key === criticalRailKey
        ? true
        : deferredItemKeys.has(`${item.kind}:${item.key}`)),
  );
}

export function DeferredHomeContent({
  criticalContent,
  criticalRailKey,
  homeLayout,
  settings,
  villaCardStyle,
}: DeferredHomeContentProps) {
  const startedRef = useRef(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<DeferredState>({ status: "idle" });

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger || startedRef.current) {
      return;
    }

    const controller = new AbortController();
    const query = criticalRailKey
      ? `?criticalRail=${encodeURIComponent(criticalRailKey)}`
      : "";
    let observer: IntersectionObserver | undefined;
    let fallbackTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

    const startRequest = () => {
      if (startedRef.current) {
        return;
      }

      startedRef.current = true;
      observer?.disconnect();
      setState({ status: "loading" });
      void fetch(`/api/home-deferred${query}`, {
        cache: "force-cache",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              `Deferred homepage request failed: ${response.status}`,
            );
          }

          return (await response.json()) as DeferredHomePayload;
        })
        .then((payload) => {
          if (!controller.signal.aborted) {
            setState({ payload, status: "ready" });
          }
        })
        .catch((error: unknown) => {
          if (
            !controller.signal.aborted &&
            (!(error instanceof DOMException) || error.name !== "AbortError")
          ) {
            setState({ status: "error" });
          }
        });
    };

    if (typeof IntersectionObserver === "undefined") {
      fallbackTimer = globalThis.setTimeout(startRequest, 0);
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            startRequest();
          }
        },
        { rootMargin: "1000px" },
      );
      observer.observe(trigger);
    }

    return () => {
      observer?.disconnect();
      if (fallbackTimer !== undefined) {
        globalThis.clearTimeout(fallbackTimer);
      }
      controller.abort();
    };
  }, [criticalRailKey]);

  const readyPayload = state.status === "ready" ? state.payload : null;
  const degradedSourceNames = [
    readyPayload?.degradedSources.guidePosts ? "guidePosts" : null,
    readyPayload?.degradedSources.villaCatalog ? "villaCatalog" : null,
    readyPayload?.degradedSources.homeSections ? "homeSections" : null,
  ].filter((source): source is string => source !== null);
  const firstDeferredItem = homeLayout.find(
    (item) =>
      item.enabled &&
      !(item.kind === "rail" && item.key === criticalRailKey),
  );
  const renderLayoutPlaceholder = readyPayload
    ? undefined
    : (item: HomePageLayoutItem) => {
        const isFirstDeferredItem =
          item.kind === firstDeferredItem?.kind &&
          item.key === firstDeferredItem.key;

        return (
          <DeferredLayoutPlaceholder
            error={state.status === "error" && isFirstDeferredItem}
            item={item}
            triggerRef={isFirstDeferredItem ? triggerRef : undefined}
          />
        );
      };

  return (
    <>
      <span
        hidden
        data-home-deferred-degraded={degradedSourceNames.length > 0 ? "true" : undefined}
        data-home-deferred-degraded-sources={
          degradedSourceNames.length > 0 ? degradedSourceNames.join(",") : undefined
        }
      />
      <HomePageContent
        key="home-page-content"
        criticalContent={criticalContent}
        criticalRailKey={criticalRailKey}
        customerReviews={readyPayload?.customerReviews}
        homeLayout={
          readyPayload
            ? getHydratedDocumentLayout(
                readyPayload.layout,
                homeLayout,
                criticalRailKey,
              )
            : homeLayout
        }
        initialGuides={readyPayload?.guides}
        initialHomeSections={readyPayload?.sections}
        renderLayoutPlaceholder={renderLayoutPlaceholder}
        settings={settings}
        villaCardStyle={villaCardStyle}
      />
    </>
  );
}
