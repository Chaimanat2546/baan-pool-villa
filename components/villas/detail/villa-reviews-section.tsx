"use client";

import { ImageOff, MessageSquare, Star, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { DEFAULT_SITE_WEB_STYLES } from "@/lib/site-web-styles/defaults";
import type { GalleryStyleSettings } from "@/lib/site-web-styles/types";
import type {
  PublicVillaReview,
  ReviewPage,
  ReviewSort,
} from "@/lib/villa-reviews/types";
import { GalleryLightbox } from "./gallery-lightbox";
import { VillaReviewModal } from "./villa-review-modal";
import {
  formatRelativeReviewTime,
  safeReviewImageUrl,
} from "./villa-review-utils";
import type { GalleryItem } from "./types";

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span
      role="img"
      aria-label={`${rating} จาก 5 ดาว`}
      className="inline-flex gap-0.5"
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          size={16}
          aria-hidden="true"
          className={
            value <= Math.round(rating)
              ? "fill-amber-400 text-amber-500"
              : "text-[var(--site-border)]"
          }
        />
      ))}
    </span>
  );
}

function ReviewImage({
  index,
  onOpen,
  url,
}: {
  index: number;
  onOpen: () => void;
  url: string;
}) {
  const [failed, setFailed] = useState(false);
  const safeUrl = safeReviewImageUrl(url);
  if (failed || !safeUrl)
    return (
      <div className="grid h-24 w-28 shrink-0 place-content-center gap-1 rounded-xl bg-[var(--site-surface-soft)] text-center text-xs text-[var(--site-muted)]">
        <ImageOff aria-hidden="true" size={20} className="mx-auto" />
        โหลดรูปไม่ได้
      </div>
    );
  return (
    <button
      type="button"
      aria-label={`ดูรูปจากผู้เข้าพัก รูปที่ ${index + 1}`}
      className="relative block h-24 w-28 shrink-0 overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary)]"
      onClick={onOpen}
    >
      <Image
        src={safeUrl}
        alt={`ภาพการเข้าพักจากผู้รีวิว รูปที่ ${index + 1}`}
        fill
        unoptimized
        loading="lazy"
        sizes="112px"
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </button>
  );
}

function ReviewCard({
  onOpenImage,
  review,
}: {
  onOpenImage: (review: PublicVillaReview, index: number) => void;
  review: PublicVillaReview;
}) {
  return (
    <article className="min-w-0 border-t border-[var(--site-border)] py-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
          <UserRound size={20} aria-hidden="true" />
        </span>
        <h3 className="min-w-0 break-words text-sm font-bold">
          {review.maskedPhone}
        </h3>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ReviewStars rating={review.rating} />
        <span
          suppressHydrationWarning
          className="text-xs text-[var(--site-muted)]"
        >
          {formatRelativeReviewTime(review.createdAt)}
        </span>
      </div>
      {review.comment ? (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">
          {review.comment}
        </p>
      ) : null}
      {review.images.length ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {review.images.map((image, index) => (
            <ReviewImage
              key={image.id}
              url={image.url}
              index={index}
              onOpen={() => onOpenImage(review, index)}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function mergeReviews(
  items: PublicVillaReview[],
  added: PublicVillaReview[],
  sort: ReviewSort,
) {
  return [
    ...new Map(
      [...items, ...added].map((review) => [review.id, review]),
    ).values(),
  ].sort((a, b) => {
    const ratingOrder =
      sort === "rating_desc"
        ? b.rating - a.rating
        : sort === "rating_asc"
          ? a.rating - b.rating
          : 0;
    if (sort === "newest")
      return (
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        b.id.localeCompare(a.id)
      );
    return (
      ratingOrder ||
      (sort === "rating_asc"
        ? a.id.localeCompare(b.id)
        : b.id.localeCompare(a.id))
    );
  });
}

export function VillaReviewsSection({
  galleryStyle = DEFAULT_SITE_WEB_STYLES.gallery,
  initialPage,
  villaId,
}: {
  galleryStyle?: GalleryStyleSettings;
  initialPage?: ReviewPage;
  villaId: string;
}) {
  const [page, setPage] = useState<ReviewPage | null>(initialPage ?? null);
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [pending, setPending] = useState(!initialPage);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [notice, setNotice] = useState("");
  const [reviewLightbox, setReviewLightbox] = useState<{
    activeItem: GalleryItem;
    items: GalleryItem[];
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);
  const retryCursor = useRef<string | null>(null);

  const load = useCallback(
    (nextSort: ReviewSort, cursor: string | null) => {
      controller.current?.abort();
      const request = ++requestNumber.current;
      const abort = new AbortController();
      controller.current = abort;
      retryCursor.current = cursor;
      const query = new URLSearchParams({ sort: nextSort });
      if (cursor) query.set("cursor", cursor);
      return fetch(
        `/api/villas/${encodeURIComponent(villaId)}/reviews?${query}`,
        { signal: abort.signal, cache: "no-store" },
      )
        .then((response) => {
          if (!response.ok) throw new Error("review_read_failed");
          return response.json() as Promise<ReviewPage>;
        })
        .then((next) => {
          if (request !== requestNumber.current || abort.signal.aborted) return;
          setPage((previous) => ({
            ...next,
            items:
              cursor && previous
                ? mergeReviews(previous.items, next.items, nextSort)
                : next.items,
          }));
        })
        .catch(() => {
          if (request === requestNumber.current && !abort.signal.aborted)
            setError("โหลดรีวิวไม่สำเร็จ กรุณาลองอีกครั้ง");
        })
        .finally(() => {
          if (request === requestNumber.current && !abort.signal.aborted)
            setPending(false);
        });
    },
    [villaId],
  );

  function requestPage(nextSort: ReviewSort, cursor: string | null) {
    setPending(true);
    setError("");
    void load(nextSort, cursor);
  }

  useEffect(() => {
    if (!initialPage) void load("newest", null);
    return () => {
      controller.current?.abort();
      requestNumber.current += 1;
    };
  }, [initialPage, load]);

  function submitted(review: PublicVillaReview) {
    controller.current?.abort();
    requestNumber.current += 1;
    setPending(false);
    setError("");
    setPage((previous) => {
      const summary = previous?.summary ?? {
        totalCount: 0,
        averageRating: 0,
        ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
      if (previous?.items.some((item) => item.id === review.id))
        return previous;
      const count = summary.totalCount + 1;
      const rating = review.rating as 1 | 2 | 3 | 4 | 5;
      return {
        items: mergeReviews(previous?.items ?? [], [review], sort),
        nextCursor: previous?.nextCursor ?? null,
        summary: {
          totalCount: count,
          averageRating:
            (([1, 2, 3, 4, 5] as const).reduce(
              (sum, value) => sum + value * summary.ratingCounts[value],
              0,
            ) +
              rating) /
            count,
          ratingCounts: {
            ...summary.ratingCounts,
            [rating]: summary.ratingCounts[rating] + 1,
          },
        },
      };
    });
    setNotice("ขอบคุณสำหรับรีวิวของคุณ รีวิวเผยแพร่แล้ว");
  }

  function openReviewImage(review: PublicVillaReview, index: number) {
    const items = review.images.map((image) => ({
      caption: null,
      imageName: null,
      isCover: false,
      isMock: false,
      key: `${review.id}-${image.id}`,
      url: image.url,
      zone: null,
      zoneKey: "guest-review",
      zoneLabel: "รูปจากผู้เข้าพัก",
    }));
    const activeItem = items[index];

    if (activeItem) setReviewLightbox({ activeItem, items });
  }

  const isCategorizedGallery = galleryStyle.variant === "categorized-grid";

  return (
    <section
      aria-label="รีวิวจากผู้เข้าพัก"
      className="min-w-0 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5 text-[var(--site-text)] shadow-[0_10px_30px_rgba(6,63,53,0.06)] sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-black">
          <MessageSquare
            size={22}
            aria-hidden="true"
            className="shrink-0 text-[var(--site-primary)]"
          />
          รีวิวจากผู้เข้าพัก
        </h2>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-full border border-[var(--site-primary)] px-4 py-2 text-sm font-bold text-[var(--site-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary)]"
        >
          เขียนรีวิว
        </button>
      </div>
      {page && page.summary.totalCount > 0 ? (
        <div className="my-6 flex flex-wrap items-center gap-6">
          <div className="min-w-24 text-center">
            <p className="text-5xl font-semibold">
              {page.summary.averageRating.toFixed(1)}
            </p>
            <div className="mt-2">
              <ReviewStars rating={page.summary.averageRating} />
            </div>
            <p className="mt-1 text-xs text-[var(--site-muted)]">
              {page.summary.totalCount.toLocaleString("th-TH")} รีวิว
            </p>
          </div>
          <div
            className="min-w-36 flex-1 space-y-1.5"
            aria-label="สัดส่วนคะแนนรีวิว"
          >
            {([5, 4, 3, 2, 1] as const).map((rating) => (
              <div key={rating} className="flex items-center gap-2 text-xs">
                <span aria-hidden="true">{rating}</span>
                <progress
                  aria-label={`${rating} ดาว ${page.summary.ratingCounts[rating]} รีวิว`}
                  value={page.summary.ratingCounts[rating]}
                  max={Math.max(page.summary.totalCount, 1)}
                  className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-[var(--site-surface-soft)] [&::-webkit-progress-value]:bg-amber-400 [&::-moz-progress-bar]:bg-amber-400"
                />
                <span
                  className="w-8 text-right text-[var(--site-muted)]"
                  aria-hidden="true"
                >
                  {page.summary.ratingCounts[rating]}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {page && page.summary.totalCount === 0 && !pending ? (
        <div className="py-8 text-center">
          <p className="font-bold">ยังไม่มีรีวิว</p>
          <p className="mt-2 text-sm text-[var(--site-muted)]">
            แบ่งปันประสบการณ์การเข้าพักเป็นคนแรก
          </p>
        </div>
      ) : null}
      {page && page.summary.totalCount > 0 ? (
        <div className="mb-4 mt-5 flex flex-wrap items-center gap-2">
          <label
            htmlFor={`review-sort-${villaId}`}
            className="text-sm text-[var(--site-muted)]"
          >
            เรียงรีวิว
          </label>
          <select
            id={`review-sort-${villaId}`}
            value={sort}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.value as ReviewSort;
              setSort(next);
              requestPage(next, null);
            }}
            className="min-w-0 rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--site-primary)]"
          >
            <option value="newest">ล่าสุด</option>
            <option value="rating_desc">คะแนนสูงสุด</option>
            <option value="rating_asc">คะแนนต่ำสุด</option>
          </select>
        </div>
      ) : null}
      <div
        aria-live="polite"
        role="status"
        className="my-3 text-sm text-[var(--site-muted)]"
      >
        {pending ? "กำลังโหลดรีวิว…" : notice}
      </div>
      {error ? (
        <div role="alert" className="my-4 text-sm">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => requestPage(sort, retryCursor.current)}
            className="mt-2 rounded-lg px-3 py-2 font-bold text-[var(--site-primary)] underline"
          >
            ลองอีกครั้ง
          </button>
        </div>
      ) : null}
      <div aria-busy={pending}>
        {page?.items.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            onOpenImage={openReviewImage}
          />
        ))}
      </div>
      {page?.nextCursor && !error ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => requestPage(sort, page.nextCursor)}
          className="w-full rounded-full border border-[var(--site-border)] px-4 py-3 text-sm font-bold text-[var(--site-primary)] focus-visible:outline-2 focus-visible:outline-[var(--site-primary)] disabled:opacity-50"
        >
          ดูรีวิวเพิ่มเติม
        </button>
      ) : null}
      {showModal ? (
        <VillaReviewModal
          villaId={villaId}
          onClose={() => setShowModal(false)}
          onSubmitted={submitted}
        />
      ) : null}
      {reviewLightbox ? (
        <GalleryLightbox
          activeItem={reviewLightbox.activeItem}
          categories={[
            {
              items: reviewLightbox.items,
              key: "guest-review",
              label: "รูปจากผู้เข้าพัก",
            },
          ]}
          eyebrow="รูปรีวิว"
          getImageSrc={(item) => safeReviewImageUrl(item.url)}
          listing={{ id: villaId }}
          onClose={() => setReviewLightbox(null)}
          onImageError={() => undefined}
          onSelect={(activeItem) =>
            setReviewLightbox((current) =>
              current ? { ...current, activeItem } : current,
            )
          }
          showCategorySelector={false}
          showDownload={false}
          style={galleryStyle}
          thumbnailPlacement={isCategorizedGallery ? "bottom" : "side"}
          title="รูปจากผู้เข้าพัก"
        />
      ) : null}
    </section>
  );
}
