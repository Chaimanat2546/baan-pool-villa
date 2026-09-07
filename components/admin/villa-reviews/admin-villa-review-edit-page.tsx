"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, CircleCheck, Star, UserRound } from "lucide-react";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { safeReviewImageUrl } from "@/components/villas/detail/villa-review-utils";
import type { AdminVillaReviewDetail } from "@/lib/villa-reviews/types";
import { ReviewEditor } from "./review-editor";
import { formatReviewDate, ReviewHistory } from "./review-history";

function ReviewSummary({ review }: { review: AdminVillaReviewDetail }) {
  const firstImage = [...review.images].sort((left, right) => left.displayOrder - right.displayOrder)[0]?.url;
  const safeImage = firstImage ? safeReviewImageUrl(firstImage) : null;
  return <section className="rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="relative grid h-20 w-full shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--site-surface-soft)] sm:h-[86px] sm:w-[164px]">{safeImage ? <Image alt={`รูปรีวิวแรกของ ${review.villaTitle}`} src={safeImage} fill unoptimized sizes="164px" className="object-cover" /> : <span className="text-sm text-[var(--site-muted)]">ไม่มีรูปรีวิว</span>}</span><div className="min-w-0 flex-1"><a href={`/villas/${encodeURIComponent(review.villaId)}`} className="block truncate text-lg font-semibold text-[var(--site-text)] underline-offset-2 hover:text-[var(--site-primary)] hover:underline">{review.villaTitle}</a><p className="mt-1 text-sm text-[var(--site-muted)]">รหัสบ้าน: DV-{review.villaId}</p><div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--site-muted)]"><span className="inline-flex items-center gap-2"><UserRound aria-hidden="true" size={17} />ลูกค้า: {review.maskedPhone}</span><span className="inline-flex items-center gap-2"><CalendarDays aria-hidden="true" size={17} />สร้างเมื่อ: <time dateTime={review.createdAt}>{formatReviewDate(review.createdAt)}</time></span><span className="inline-flex items-center gap-1.5 border-l border-[var(--site-border)] pl-5 text-[var(--site-text)]">{[1, 2, 3, 4, 5].map((star) => <Star key={star} aria-hidden="true" size={18} className={star <= review.rating ? "fill-amber-400 text-amber-500" : "text-amber-500"} />)} {review.rating}/5</span></div></div><span className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-700 sm:self-center"><CircleCheck aria-hidden="true" size={16} />แสดงแล้ว</span></div></section>;
}

export function AdminVillaReviewEditPage({ id, back }: { id: string; back: string }) {
  const router = useRouter();
  const [review, setReview] = useState<AdminVillaReviewDetail | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const safeBack = back.startsWith("/admin/villa-reviews") ? back : "/admin/villa-reviews";

  useEffect(() => { let live = true; void (async () => { try { const token = await readAdminAccessToken(); const response = await fetch(`/api/admin/villa-reviews/${encodeURIComponent(id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" }); const body = await response.json().catch(() => null); if (!live) return; if (response.ok) setReview(body); else setError(body?.error ?? "ไม่พบรีวิว"); } catch { if (live) setError("ไม่สามารถโหลดรายละเอียดรีวิวได้"); } finally { if (live) setPending(false); } })(); return () => { live = false; }; }, [id]);
  async function mutate(method: "PATCH" | "DELETE", form?: FormData) { try { const token = await readAdminAccessToken(); const response = await fetch(`/api/admin/villa-reviews/${encodeURIComponent(id)}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form }); const body = await response.json().catch(() => null); if (!response.ok) { setError(body?.error ?? (method === "PATCH" ? "ไม่สามารถบันทึกรีวิวได้" : "ไม่สามารถลบรีวิวได้")); setFields(body?.fieldErrors ?? {}); return false; } return true; } catch { setError(method === "PATCH" ? "ไม่สามารถบันทึกรีวิวได้" : "ไม่สามารถลบรีวิวได้"); setFields({}); return false; } }
  async function save(form: FormData) { setSaving(true); setError(""); setFields({}); try { if (await mutate("PATCH", form)) { const token = await readAdminAccessToken(); const response = await fetch(`/api/admin/villa-reviews/${encodeURIComponent(id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); if (response.ok) setReview(await response.json()); else setError("บันทึกแล้ว แต่ไม่สามารถโหลดรายละเอียดรีวิวได้"); } } catch { setError("บันทึกแล้ว แต่ไม่สามารถโหลดรายละเอียดรีวิวได้"); } finally { setSaving(false); } }
  async function remove() { if (!confirm("ลบรีวิวพร้อมรูปและประวัติทั้งหมดถาวร?")) return; setSaving(true); try { if (await mutate("DELETE")) router.replace(safeBack); } finally { setSaving(false); } }

  return <section className="mx-auto max-w-[1400px] space-y-4 sm:space-y-5"><header><p className="text-xs font-semibold text-[var(--site-primary)]">หลังบ้าน / รีวิวบ้านพัก</p><h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">แก้ไขรีวิวบ้านพัก</h1></header><Link href={safeBack} className="inline-flex items-center gap-2 text-sm font-medium text-[var(--site-text)]"><ArrowLeft aria-hidden="true" size={18} className="text-[var(--site-primary)]" />กลับไปยังรีวิว</Link>{pending ? <p className="py-8 text-sm text-[var(--site-muted)]">กำลังโหลดรีวิว…</p> : error && !review ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</p> : review ? <><ReviewSummary review={review} /><ReviewEditor review={review} pending={saving} error={error} fieldErrors={fields} onSave={save} onDelete={() => void remove()} onClose={() => router.push(safeBack)} showSecondary={false} /><details className="rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4"><span><b className="block">ประวัติการแก้ไข</b><span className="text-sm text-[var(--site-muted)]">ดูประวัติการแก้ไขรีวิวนี้</span></span><span className="text-sm text-[var(--site-muted)]">{review.editLogs.length} รายการ</span></summary><div className="border-t border-[var(--site-border)] p-4"><ReviewHistory createdAt={review.createdAt} rating={review.rating} comment={review.comment} images={review.images} logs={review.editLogs} /></div></details></> : null}</section>;
}
