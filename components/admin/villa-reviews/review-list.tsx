"use client";

import { useState } from "react";
import { Star, ImageIcon } from "lucide-react";
import { formatRelativeReviewTime } from "@/components/villas/detail/villa-review-utils";
import type { AdminVillaReviewListItem } from "@/lib/villa-reviews/types";

interface Props {
  items: AdminVillaReviewListItem[];
  selectedId: string | null;
  pending: boolean;
  disabled: boolean;
  error: string;
  nextCursor: string | null;
  onSearch: (search: string, rating: string) => void;
  onSelect: (id: string) => void;
  onNext: () => void;
  onRetry: () => void;
}

export function ReviewList(props: Props) {
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState("");
  return <aside aria-label="รายการรีวิว" className="min-w-0 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)]">
    <div className="border-b border-[var(--site-border)] p-4">
      <h2 className="font-semibold">รายการรีวิว</h2>
      <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); props.onSearch(search.trim(), rating); }}>
        <label className="grid gap-1.5 text-xs font-medium">ค้นหารีวิว
          <input type="search" maxLength={100} value={search} disabled={props.disabled} onChange={(event) => setSearch(event.target.value)}
            placeholder="บ้านพัก รหัสจอง หรือเบอร์โทร" className="min-w-0 w-full rounded-lg border border-[var(--site-border)] bg-transparent px-3 py-2 text-sm" />
        </label>
        <div className="flex gap-2">
          <select aria-label="กรองคะแนน" value={rating} disabled={props.disabled} onChange={(event) => setRating(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-2 py-2 text-sm">
            <option value="">ทุกคะแนน</option>
            {[5, 4, 3, 2, 1].map((value) => <option value={value} key={value}>{value} ดาว</option>)}
          </select>
          <button type="submit" disabled={props.disabled || props.pending} className="rounded-lg bg-[var(--site-primary)] px-3 py-2 text-sm font-semibold text-[var(--site-on-primary)] disabled:opacity-50">ค้นหา</button>
        </div>
      </form>
    </div>
    <div aria-busy={props.pending} className="max-h-[32rem] overflow-y-auto xl:max-h-[65dvh]">
      {props.items.map((review) => <button type="button" key={review.id} disabled={props.disabled}
        aria-label={`แก้ไขรีวิว ${review.villaTitle} DV-${review.villaId}`} aria-current={props.selectedId === review.id ? "true" : undefined}
        onClick={() => props.onSelect(review.id)}
        className={`block w-full min-w-0 border-b border-[var(--site-border)] p-4 text-left transition-colors hover:bg-[var(--site-surface-soft)] disabled:opacity-60 ${props.selectedId === review.id ? "bg-[var(--site-primary-soft)] shadow-[inset_3px_0_0_var(--site-primary)]" : ""}`}>
        <span className="block truncate text-sm font-semibold">{review.villaTitle || `DV-${review.villaId}`}</span>
        <span className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[var(--site-muted)]">DV-{review.villaId}</span>
          <span className="inline-flex items-center gap-1"><Star size={13} aria-hidden="true" className="fill-amber-400 text-amber-500" />{review.rating}/5</span>
        </span>
        <span className="mt-2 block text-xs text-[var(--site-muted)]">{review.maskedPhone} · {formatRelativeReviewTime(review.createdAt)}</span>
        <span className="mt-2 line-clamp-2 break-words text-sm leading-6 [overflow-wrap:anywhere]">{review.commentExcerpt || "ไม่มีข้อความ"}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--site-muted)]"><ImageIcon size={13} aria-hidden="true" />{review.imageCount} รูป</span>
      </button>)}
      {props.pending ? <div aria-label="กำลังโหลดรายการรีวิว" role="status" className="space-y-3 p-4">
        <span className="sr-only">กำลังโหลดรายการรีวิว</span>
        {[1, 2, 3].map((key) => <div aria-hidden="true" key={key} className="h-24 animate-pulse rounded-lg bg-[var(--site-surface-soft)]" />)}
      </div> : null}
      {!props.pending && !props.error && !props.items.length ? <p className="p-6 text-center text-sm text-[var(--site-muted)]">ไม่พบรีวิว ลองเปลี่ยนคำค้นหาหรือคะแนน</p> : null}
    </div>
    {props.error ? <div role="alert" className="space-y-2 p-4 text-sm"><p className="break-words text-red-700">{props.error}</p><button type="button" disabled={props.disabled || props.pending} onClick={props.onRetry} className="rounded-lg border px-3 py-2">ลองโหลดรายการอีกครั้ง</button></div> : null}
    {props.nextCursor && !props.error ? <div className="p-3"><button type="button" onClick={props.onNext} disabled={props.disabled || props.pending} className="w-full rounded-lg border border-[var(--site-border)] px-3 py-2 text-sm disabled:opacity-50">โหลดรีวิวเพิ่มเติม</button></div> : null}
  </aside>;
}
