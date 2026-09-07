import type { AdminVillaReviewImage, VillaReviewEditLog } from "@/lib/villa-reviews/types";
import { formatRelativeReviewTime } from "@/components/villas/detail/villa-review-utils";
interface Props { createdAt: string; rating: number; comment: string; images: AdminVillaReviewImage[]; logs: VillaReviewEditLog[]; }

export function formatReviewDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.valueOf()) ? "ไม่ทราบวันที่" : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(date);
}

function snapshotImages(snapshot: Record<string, unknown>) {
  if (!Array.isArray(snapshot.images)) return [];
  return snapshot.images.flatMap((value: unknown) => typeof value === "object" && value !== null && "id" in value && typeof value.id === "string" ? [value.id] : []);
}
function snapshotComment(snapshot: Record<string, unknown>) { return typeof snapshot.comment === "string" && snapshot.comment ? snapshot.comment : "ไม่มีข้อความ"; }
function snapshotRating(snapshot: Record<string, unknown>) { return typeof snapshot.rating === "number" ? snapshot.rating : "—"; }

export function ReviewHistory({ createdAt, rating, comment, images, logs }: Props) {
  const ordered = [...logs].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  const original = ordered[0]?.beforeSnapshot ?? { rating, comment, images };
  return <section aria-label="ประวัติการแก้ไข" className="min-w-0 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4">
    <h2 className="font-semibold">ประวัติการแก้ไข</h2>
    <ol className="mt-4 space-y-4 border-l border-[var(--site-border)] pl-4 text-xs">
      <li className="min-w-0 space-y-2">
        <h3 className="font-semibold">รีวิวต้นฉบับ</h3>
        <time dateTime={createdAt} title={formatReviewDate(createdAt)} className="block text-[var(--site-muted)]">{formatRelativeReviewTime(createdAt)} · {formatReviewDate(createdAt)}</time>
        <p>{snapshotRating(original)} ดาว · {snapshotImages(original).length} รูป</p>
        <p className="whitespace-pre-wrap break-words leading-6 [overflow-wrap:anywhere]">{snapshotComment(original)}</p>
      </li>
      {ordered.map((log, index) => {
        const before = snapshotImages(log.beforeSnapshot), after = snapshotImages(log.afterSnapshot);
        const added = after.filter((id) => !before.includes(id)).length;
        const removed = before.filter((id) => !after.includes(id)).length;
        const reordered = !added && !removed && before.join(",") !== after.join(",");
        return <li className="min-w-0 space-y-2 border-t border-[var(--site-border)] pt-4" key={log.id}>
          <h3 className="font-semibold">แก้ไขครั้งที่ {index + 1}</h3>
          <time dateTime={log.createdAt} title={formatReviewDate(log.createdAt)} className="block text-[var(--site-muted)]">{formatRelativeReviewTime(log.createdAt)} · {formatReviewDate(log.createdAt)}</time>
          <p>{snapshotRating(log.beforeSnapshot)} → {snapshotRating(log.afterSnapshot)} ดาว</p>
          <div className="space-y-1 rounded-lg bg-[var(--site-surface-soft)] p-2">
            <p className="text-[var(--site-muted)]">ก่อนแก้ไข</p><p className="whitespace-pre-wrap break-words leading-6 [overflow-wrap:anywhere]">{snapshotComment(log.beforeSnapshot)}</p>
            <p className="pt-1 text-[var(--site-muted)]">หลังแก้ไข</p><p className="whitespace-pre-wrap break-words leading-6 [overflow-wrap:anywhere]">{snapshotComment(log.afterSnapshot)}</p>
          </div>
          <p>รูปภาพ {before.length} → {after.length} รูป · เพิ่ม {added} รูป · นำออก {removed} รูป{reordered ? " · เปลี่ยนลำดับรูป" : ""}</p>
        </li>;
      })}
    </ol>
    {!ordered.length ? <p className="mt-4 text-xs text-[var(--site-muted)]">ยังไม่มีการแก้ไข</p> : null}
  </section>;
}
