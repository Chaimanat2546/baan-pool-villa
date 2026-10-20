"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { AdvertisementListFilters } from "@/lib/advertisements/types";
import { ADVERTISEMENT_ZONES } from "@/lib/advertisements/validation";

const controlClass = "h-9 w-full min-w-0 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-base focus-visible:outline-2 focus-visible:outline-[var(--site-primary)] sm:text-sm";

export function AdvertisementFilters({ initial, disabled, onApply }: {
  initial: AdvertisementListFilters;
  disabled: boolean;
  onApply: (filters: AdvertisementListFilters) => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <form aria-label="ค้นหาและกรองโฆษณา" onSubmit={event => { event.preventDefault(); onApply({ ...draft, search: draft.search.trim() }); }}>
      <fieldset disabled={disabled} className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_160px_140px_auto] sm:items-end">
        <label className="grid min-w-0 gap-1 text-xs">ค้นหาชื่อโฆษณา<input type="search" maxLength={160} value={draft.search} onChange={event => setDraft({ ...draft, search: event.target.value })} className={controlClass} /></label>
        <label className="grid min-w-0 gap-1 text-xs">โซน<select value={draft.zone} onChange={event => setDraft({ ...draft, zone: event.target.value })} className={controlClass}>
          <option value="">ไม่จำกัดโซน</option>
          {ADVERTISEMENT_ZONES.map(zone => <option key={zone.value} value={zone.value}>{zone.value === "all" ? "แสดงในทุกโซน" : zone.label}</option>)}
        </select></label>
        <label className="grid min-w-0 gap-1 text-xs">สถานะ<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as AdvertisementListFilters["status"] })} className={controlClass}>
          <option value="all">ทุกสถานะ</option><option value="active">เปิดแสดง</option><option value="inactive">ปิดแสดง</option>
        </select></label>
        <div className="flex items-center gap-2">
          <button type="submit" className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-xs hover:bg-[var(--site-surface-tint)] focus-visible:outline-2 focus-visible:outline-[var(--site-primary)] disabled:opacity-40"><Search aria-hidden="true" className="size-3.5" />ค้นหา</button>
          <button type="button" onClick={() => { const empty: AdvertisementListFilters = { search: "", zone: "", status: "all" }; setDraft(empty); onApply(empty); }} className="min-h-9 rounded px-2 text-xs text-[var(--site-muted)] focus-visible:outline-2 focus-visible:outline-[var(--site-primary)]">ล้าง</button>
        </div>
      </fieldset>
    </form>
  );
}
