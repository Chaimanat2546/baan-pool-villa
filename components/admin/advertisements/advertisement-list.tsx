"use client";

import { CspSafeImage } from "@/components/ui/csp-safe-image";
import type { AdminAdvertisement } from "@/lib/advertisements/types";
import { ADVERTISEMENT_ZONES } from "@/lib/advertisements/validation";

export function AdvertisementList({ items, page, total, loading, onEdit, onPage }: {
  items: AdminAdvertisement[];
  page: number;
  total: number;
  loading: boolean;
  onEdit: (ad: AdminAdvertisement) => void;
  onPage: (page: number) => void;
}) {
  return (
    <section aria-label="รายการโฆษณา" aria-busy={loading} className="min-w-0 overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)]">
      {loading && <p role="status" className="border-b border-[var(--site-border)] px-4 py-3 text-xs text-[var(--site-muted)]">กำลังโหลดโฆษณา…</p>}
      <table className="w-full table-fixed text-left text-sm">
        <caption className="sr-only">รายการโฆษณา</caption>
        <thead className="bg-[var(--site-surface-soft)] text-xs text-[var(--site-muted)]">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">ชื่อโฆษณา</th>
            <th scope="col" className="hidden w-28 px-3 py-3 font-medium md:table-cell">โซน</th>
            <th scope="col" className="w-24 px-2 py-3 font-medium">สถานะ</th>
            <th scope="col" className="hidden w-20 px-3 py-3 font-medium md:table-cell">ลำดับ</th>
            <th scope="col" className="hidden w-20 px-3 py-3 font-medium md:table-cell">รูป</th>
            <th scope="col" className="w-20 px-3 py-3"><span className="sr-only">จัดการ</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--site-border)]">
          {items.map((ad) => {
            const zone = ADVERTISEMENT_ZONES.find((item) => item.value === ad.zone)?.label ?? ad.zone;
            return (
              <tr key={ad.id} className="hover:bg-[var(--site-surface-soft)]">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  <div className="flex min-w-0 items-center gap-3">
                    {ad.images[0] && <CspSafeImage src={ad.images[0].url} alt="" width={48} height={36} unoptimized className="hidden h-9 w-12 shrink-0 rounded object-cover sm:block" />}
                    <div className="min-w-0">
                      <span className="line-clamp-2 break-words" title={ad.title}>{ad.title}</span>
                      <span className="mt-1 block text-xs font-normal text-[var(--site-muted)] md:hidden">{zone} · ลำดับ {ad.sortOrder} · {ad.images.length} รูป</span>
                    </div>
                  </div>
                </th>
                <td className="hidden px-3 py-3 text-xs md:table-cell">{zone}</td>
                <td className="px-2 py-3"><span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs"><span aria-hidden="true" className={`size-1.5 rounded-full ${ad.isActive ? "bg-emerald-600" : "bg-[var(--site-muted)]"}`} />{ad.isActive ? "เปิดแสดง" : "ปิดแสดง"}</span></td>
                <td className="hidden px-3 py-3 tabular-nums md:table-cell">{ad.sortOrder}</td>
                <td className="hidden px-3 py-3 tabular-nums md:table-cell">{ad.images.length}</td>
                <td className="px-3 py-3"><button type="button" aria-label={`แก้ไขโฆษณา ${ad.title}`} disabled={loading} onClick={() => onEdit(ad)} className="min-h-9 rounded-md px-2 text-xs text-[var(--site-muted)] hover:bg-[var(--site-surface-tint)] focus-visible:outline-2 focus-visible:outline-[var(--site-primary)] disabled:opacity-40 pointer-coarse:min-h-11">แก้ไข</button></td>
              </tr>
            );
          })}
          {!loading && items.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[var(--site-muted)]">ยังไม่มีโฆษณา</td></tr>}
        </tbody>
      </table>
      {total > 20 && <div className="flex items-center justify-between border-t border-[var(--site-border)] px-4 py-3 text-xs">
        <button type="button" disabled={loading || page === 1} onClick={() => onPage(page - 1)} className="min-h-9 rounded-lg border border-[var(--site-border)] px-3 disabled:opacity-40">ก่อนหน้า</button>
        <span>หน้า {page} / {Math.ceil(total / 20)}</span>
        <button type="button" disabled={loading || page * 20 >= total} onClick={() => onPage(page + 1)} className="min-h-9 rounded-lg border border-[var(--site-border)] px-3 disabled:opacity-40">ถัดไป</button>
      </div>}
    </section>
  );
}
