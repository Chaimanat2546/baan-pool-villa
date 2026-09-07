"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, CalendarDays, ChevronRight, ImageIcon, ImageOff, Search, Star } from "lucide-react";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { formatRelativeReviewTime, safeReviewImageUrl } from "@/components/villas/detail/villa-review-utils";
import type { AdminVillaReviewListResult } from "@/lib/villa-reviews/types";

export function AdminVillaReviewsPage({ initialQuery = {} }: { initialQuery?: Record<string, string | undefined> }) {
  const [data, setData] = useState<AdminVillaReviewListResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(initialQuery).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params.toString();
  }, [initialQuery]);
  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true); setError("");
      try {
        const token = await readAdminAccessToken();
        const response = await fetch(`/api/admin/villa-reviews${query ? `?${query}` : ""}`, { cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const body = await response.json().catch(() => null);
        if (!live) return;
        if (response.ok) setData(body as AdminVillaReviewListResult);
        else setError(body?.error ?? "ไม่สามารถโหลดรีวิวได้");
      } catch { if (live) setError("ไม่สามารถโหลดรีวิวได้"); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [query]);
  const page = data?.page ?? Number(initialQuery.page ?? 1);
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 6;
  const listPath = `/admin/villa-reviews${query ? `?${query}` : ""}`;
  const pageHref = (value: number) => `/admin/villa-reviews?${new URLSearchParams({ ...initialQuery, page: String(value) } as Record<string, string>).toString()}`;
  const canGoPrevious = page > 1;
  const canGoNext = page * pageSize < total;

  return <section className="space-y-4 text-[var(--site-text)] sm:space-y-5">
    <header><p className="text-xs font-semibold text-[var(--site-primary)]">หลังบ้าน / รีวิวบ้านพัก</p><h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">จัดการรีวิวบ้านพัก</h1><p className="mt-2 text-sm text-[var(--site-muted)]">{data ? `${total.toLocaleString()} รีวิว` : "ค้นหาและเลือกรายการรีวิวเพื่อจัดการ"}</p></header>
    <form action="/admin/villa-reviews" className="space-y-4">
      <div className="flex gap-3"><label className="relative min-w-0 flex-1"><Search aria-hidden="true" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--site-text)]"/><input name="q" defaultValue={initialQuery.q} maxLength={100} placeholder="ค้นหารหัสบ้าน ชื่อบ้านพัก เบอร์โทร หรือข้อความ" className="h-11 w-full rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] py-2 pl-11 pr-4 text-sm shadow-sm outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary-soft)] sm:h-12"/></label><button type="submit" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-primary)] focus-visible:ring-offset-2 sm:h-12 sm:px-5"><Search aria-hidden="true" size={18}/><span>ค้นหา</span></button></div>
      <div className="flex flex-wrap items-center gap-3"><select name="rating" defaultValue={initialQuery.rating ?? ""} className="h-11 min-w-48 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm shadow-sm outline-none focus:border-[var(--site-primary)]"><option value="">คะแนนทั้งหมด</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} ดาว</option>)}</select><div aria-label="ช่วงวันที่ทั้งหมด" className="flex h-11 min-w-[min(100%,330px)] items-center gap-2 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm shadow-sm"><CalendarDays aria-hidden="true" size={18} className="shrink-0"/><span className="shrink-0 text-[var(--site-muted)]">ช่วงวันที่ทั้งหมด</span><input aria-label="ตั้งแต่วันที่" name="dateFrom" type="date" defaultValue={initialQuery.dateFrom} className="min-w-0 flex-1 bg-transparent text-xs outline-none"/><span aria-hidden="true" className="text-[var(--site-muted)]">–</span><input aria-label="ถึงวันที่" name="dateTo" type="date" defaultValue={initialQuery.dateTo} className="min-w-0 flex-1 bg-transparent text-xs outline-none"/></div><label className="relative ml-auto"><ArrowDownUp aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"/><select aria-label="เรียงลำดับ" name="sort" defaultValue={initialQuery.sort ?? "newest"} className="h-11 min-w-36 appearance-none rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] py-2 pl-9 pr-7 text-sm shadow-sm outline-none focus:border-[var(--site-primary)]"><option value="newest">ล่าสุด</option><option value="oldest">เก่าที่สุด</option><option value="highest">คะแนนสูงสุด</option><option value="lowest">คะแนนต่ำสุด</option></select></label></div>
    </form>
    {error ? <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p> : null}
    <div className="overflow-hidden rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm">
      {loading ? <p className="p-8 text-sm text-[var(--site-muted)]">กำลังโหลดรีวิว…</p> : data?.items.map((review) => {
        const imageUrl = review.reviewImageUrl ? safeReviewImageUrl(review.reviewImageUrl) : null;
        return <Link data-review-list-row key={review.id} href={`/admin/villa-reviews/${review.id}?back=${encodeURIComponent(listPath)}`} className="group flex min-w-0 items-center gap-3 border-b border-[var(--site-border)] px-3 py-2.5 transition last:border-b-0 hover:bg-[var(--site-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--site-primary)] sm:gap-6 sm:px-4">
          <span className="relative grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--site-surface-soft)] sm:h-[72px] sm:w-[140px]">{imageUrl ? <Image alt={`รูปรีวิว ${review.villaTitle}`} src={imageUrl} fill unoptimized sizes="(min-width: 640px) 140px, 96px" className="object-cover"/> : <ImageOff aria-label="ไม่มีรูปรีวิว" size={20} className="text-[var(--site-muted)]"/>}</span>
          <span className="min-w-0 flex-1 py-0.5"><b className="block truncate text-sm text-[var(--site-primary)] sm:text-base">{review.villaTitle}</b><span className="mt-0.5 block truncate text-xs text-[var(--site-muted)]">DV-{review.villaId} · {review.maskedPhone} · {formatRelativeReviewTime(review.createdAt)}</span><span className="mt-1 flex min-w-0 items-center gap-3"><span className="min-w-0 truncate text-sm text-[var(--site-muted)]">{review.commentExcerpt || "ไม่มีข้อความ"}</span><span className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--site-muted)]"><ImageIcon size={14}/>{review.imageCount} รูป</span></span></span>
          <span className="hidden shrink-0 items-center gap-2 text-sm sm:flex">{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={17} className={star <= review.rating ? "fill-amber-400 text-amber-500" : "text-amber-500"}/>)}<span>{review.rating}/5</span></span><ChevronRight aria-hidden="true" className="shrink-0 text-[var(--site-muted)] transition group-hover:translate-x-0.5"/>
        </Link>;
      })}
    </div>
    {!loading && !data?.items.length ? <p className="text-center text-sm text-[var(--site-muted)]">ไม่พบรีวิว</p> : null}
    {data ? <nav className="flex items-center justify-between"><p className="text-sm">แสดง {total ? ((page - 1) * pageSize + 1).toLocaleString() : 0}–{Math.min(page * pageSize, total).toLocaleString()} จาก {total.toLocaleString()} รีวิว</p><div className="flex gap-2">{canGoPrevious ? <Link className="rounded-lg border border-[var(--site-border)] px-3 py-2 transition hover:bg-[var(--site-surface-soft)]" href={pageHref(page - 1)}>ก่อนหน้า</Link> : <span aria-disabled="true" className="cursor-not-allowed rounded-lg border border-[var(--site-border)] px-3 py-2 text-[var(--site-muted)] opacity-50">ก่อนหน้า</span>}{canGoNext ? <Link className="rounded-lg border border-[var(--site-border)] px-3 py-2 transition hover:bg-[var(--site-surface-soft)]" href={pageHref(page + 1)}>ถัดไป</Link> : <span aria-disabled="true" className="cursor-not-allowed rounded-lg border border-[var(--site-border)] px-3 py-2 text-[var(--site-muted)] opacity-50">ถัดไป</span>}</div></nav> : null}
  </section>;
}
