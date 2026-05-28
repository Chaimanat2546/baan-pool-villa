import type { HomeSectionMode } from "@/lib/home-sections/types";

import { MODE_LABELS } from "./section-helpers";

type AutoModeSummaryProps = {
  mode: Exclude<HomeSectionMode, "manual">;
};

export function AutoModeSummary({ mode }: AutoModeSummaryProps) {
  return (
    <div className="grid gap-3 rounded-[20px] border border-[#dbe6e1] bg-[#f8fbf9] p-4">
      <div>
        <h3 className="text-sm font-semibold text-[#173f36]">
          {MODE_LABELS.get(mode) ?? "เลือกบ้านอัตโนมัติ"}
        </h3>
        <p className="mt-0.5 text-xs leading-5 text-[#58726a]">
          ระบบจะจัดบ้านให้ตามรูปแบบนี้ โดยใช้จำนวนบ้านที่ตั้งไว้ด้านบน
        </p>
      </div>
    </div>
  );
}
