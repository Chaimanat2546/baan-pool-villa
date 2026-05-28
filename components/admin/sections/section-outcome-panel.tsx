import { normalizeHouseId } from "@/lib/home-sections/validation";

import type { AdminManualPreviewResponse, AdminSectionDraft } from "./types";
import {
  getFallbackModeLabel,
  getManualDisplaySummary,
  getManualIdStatus,
} from "./section-helpers";

type StatusTone = "ok" | "warn" | "muted";

type SectionStatusItem = {
  detail: string;
  label: string;
  tone: StatusTone;
};

const SUMMARY_DOT_CLASS: Record<StatusTone, string> = {
  muted: "bg-slate-400",
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
};

type SectionOutcomePanelProps = {
  onActiveChange: (isActive: boolean) => void;
  preview: AdminManualPreviewResponse | null;
  section: AdminSectionDraft;
};

export function SectionOutcomePanel({
  onActiveChange,
  preview,
  section,
}: SectionOutcomePanelProps) {
  const isManual = section.mode === "manual";

  return (
    <div className="rounded-[20px] border border-[#dbe6e1] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#173f36]">
            ตัวอย่างชุดนี้
          </h3>
          <p className="mt-1 text-xs leading-5 text-[#58726a]">
            ดูบ้านที่จะขึ้นหน้าแรกหลังบันทึก
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm font-semibold text-[#173f36]">
          <input
            checked={section.isActive}
            className="size-4 accent-[#075341]"
            onChange={(event) => onActiveChange(event.target.checked)}
            type="checkbox"
          />
          เปิด
        </label>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-[#e4ece8] pt-3 text-xs">
        <div>
          <dt className="text-[#687d76]">ลำดับ</dt>
          <dd className="font-mono font-semibold text-[#123f36]">
            {section.displayOrder + 1}
          </dd>
        </div>
        <div>
          <dt className="text-[#687d76]">จำนวนที่ตั้งไว้</dt>
          <dd className="font-mono font-semibold text-[#123f36]">
            {section.limitCount} หลัง
          </dd>
        </div>
      </dl>

      {isManual ? (
        <>
          <ManualSelectionSummary preview={preview} section={section} />

          {preview ? (
            <div className="border-t border-[#dbe6e1] pt-3 text-sm">
              <h4 className="font-semibold text-[#173f36]">
                บ้านที่หาเจอ
              </h4>
              <p className="mt-1 text-[#506862]">
                พบบ้านพักที่ใช้ได้ {preview.valid.length} หลัง
              </p>

              <PreviewList
                ids={preview.missingIds}
                title="เลขบ้านที่ไม่พบ"
                tone="amber"
              />
              <PreviewList
                ids={preview.invalidIds}
                title="เลขบ้านที่รูปแบบไม่ถูกต้อง"
                tone="red"
              />

              {preview.valid.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-[#e4ece8] pt-3">
                  {preview.valid.slice(0, 8).map((villa) => (
                    <li
                      className="truncate text-xs text-[#31534a]"
                      key={villa.id}
                      title={`บ้านเลขที่ ${villa.id} โซน ${villa.zoneLabel}`}
                    >
                      <span className="font-mono">#{villa.id}</span>{" "}
                      {villa.zoneLabel} / {villa.bedrooms} ห้องนอน / พักได้{" "}
                      {villa.people} คน
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : section.items.length > 0 ? (
            <p className="border-t border-[#dbe6e1] pt-3 text-sm leading-6 text-[#506862]">
              จะเช็กบ้านให้อีกครั้งตอนกดบันทึก
            </p>
          ) : null}

          {section.items.length > 0 ? (
            <div className="border-t border-[#dbe6e1] pt-3">
              <h4 className="text-sm font-semibold text-[#173f36]">
                เลขที่อ่านจากช่องกรอก
              </h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {section.items.map((item, itemIndex) => {
                  const normalizedId = normalizeHouseId(item.houseId);

                  return (
                    <span
                      className={`rounded px-2 py-1 font-mono text-xs ${
                        normalizedId
                          ? "bg-[#eef6f2] text-[#17463c]"
                          : "bg-red-50 text-red-700"
                      }`}
                      key={`${item.houseId}-${itemIndex}`}
                    >
                      {normalizedId ?? item.houseId}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-3 border-t border-[#dbe6e1] pt-3 text-sm leading-6 text-[#506862]">
          เมื่อบันทึก ชุดนี้จะเลือกบ้านตามวิธีที่ตั้งไว้
        </p>
      )}
    </div>
  );
}

function ManualSelectionSummary({
  preview,
  section,
}: {
  preview: AdminManualPreviewResponse | null;
  section: AdminSectionDraft;
}) {
  const manualStatus = getManualIdStatus(section);
  const rows: SectionStatusItem[] = [];

  if (section.items.length === 0) {
    rows.push({
      detail: "ยังไม่ได้ใส่เลขบ้าน",
      label: "เลขบ้าน",
      tone: "warn",
    });
  } else {
    rows.push({
      detail: `อ่านรูปแบบได้ ${manualStatus.normalizedCount} หลัง ยังไม่ใช่การยืนยันว่ามีบ้านจริง`,
      label: "รูปแบบเลข",
      tone: manualStatus.invalidIds.length > 0 ? "warn" : "ok",
    });
  }

  if (manualStatus.invalidIds.length > 0) {
    rows.push({
      detail: `มีเลขที่อ่านไม่ได้ ${manualStatus.invalidIds.join(", ")}`,
      label: "ต้องแก้",
      tone: "warn",
    });
  }

  if (manualStatus.duplicateIds.length > 0) {
    rows.push({
      detail: `มีเลขซ้ำ ${manualStatus.duplicateIds.join(", ")}`,
      label: "เลขซ้ำ",
      tone: "warn",
    });
  }

  rows.push({
    detail: getManualDisplaySummary(
      section,
      preview ? preview.valid.length : manualStatus.normalizedCount,
      preview !== null,
    ),
    label: "หลังบันทึก",
    tone:
      section.items.length === 0 ||
      manualStatus.invalidIds.length > 0 ||
      (preview !== null &&
        (preview.missingIds.length > 0 || preview.invalidIds.length > 0))
        ? "warn"
        : "ok",
  });

  if (section.items.length > 0) {
    rows.push(
      preview
        ? {
            detail: `ตรวจแล้ว ใช้ได้ ${preview.valid.length} หลัง${
              preview.missingIds.length > 0
                ? ` / ไม่พบ ${preview.missingIds.length}`
                : ""
            }${
              preview.invalidIds.length > 0
                ? ` / รูปแบบไม่ถูกต้อง ${preview.invalidIds.length}`
                : ""
            }`,
            label: "ผลตรวจ",
            tone:
              preview.missingIds.length > 0 || preview.invalidIds.length > 0
                ? "warn"
                : "ok",
          }
        : {
            detail: "ยังไม่ได้เช็กกับรายการบ้านจริง",
            label: "ผลตรวจ",
            tone: "warn",
          },
    );
  }

  return (
    <div className="border-t border-[#dbe6e1] pt-3">
      <h4 className="text-sm font-semibold text-[#173f36]">
        บ้านพักที่จะบันทึก
      </h4>
      <ul className="mt-2 grid gap-1.5 text-sm">
        {rows.map((row) => (
          <li
            className="grid grid-cols-[auto_84px_1fr] gap-2 text-[#31534a]"
            key={`${row.label}-${row.detail}`}
          >
            <span
              aria-hidden="true"
              className={`mt-2 size-2 rounded-full ${SUMMARY_DOT_CLASS[row.tone]}`}
            />
            <span className="font-semibold text-[#173f36]">{row.label}</span>
            <span className="leading-6">{row.detail}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-5 text-[#58726a]">
        วิธีเติมบ้านเพิ่มตอนนี้: {getFallbackModeLabel(section.fallbackMode)}
      </p>
    </div>
  );
}

function PreviewList({
  ids,
  title,
  tone,
}: {
  ids: string[];
  title: string;
  tone: "amber" | "red";
}) {
  if (ids.length === 0) {
    return null;
  }

  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div className={`mt-3 rounded-md border px-3 py-2 ${toneClass}`}>
      <p className="text-xs font-semibold">{title}</p>
      <p className="mt-1 break-words font-mono text-xs">{ids.join(", ")}</p>
    </div>
  );
}
