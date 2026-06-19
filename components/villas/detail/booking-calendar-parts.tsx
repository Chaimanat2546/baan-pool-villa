import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import type { BookingCalendarDay } from "./booking-calendar-ui";

function FireSvgIcon({
  className,
  ...props
}: ComponentProps<"svg">) {
  const gradientId = useId();

  return (
    <svg
      aria-hidden="true"
      viewBox="-33 0 255 255"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1="94.141"
          y1="255"
          x2="94.141"
          y2="0.188"
        >
          <stop offset="0" stopColor="#ff4c0d" />
          <stop offset="1" stopColor="#fc9502" />
        </linearGradient>
      </defs>
      <path
        d="M187.899,164.809 C185.803,214.868 144.574,254.812 94.000,254.812 C42.085,254.812 -0.000,211.312 -0.000,160.812 C-0.000,154.062 -0.121,140.572 10.000,117.812 C16.057,104.191 19.856,95.634 22.000,87.812 C23.178,83.513 25.469,76.683 32.000,87.812 C35.851,94.374 36.000,103.812 36.000,103.812 C36.000,103.812 50.328,92.817 60.000,71.812 C74.179,41.019 62.866,22.612 59.000,9.812 C57.662,5.384 56.822,-2.574 66.000,0.812 C75.352,4.263 100.076,21.570 113.000,39.812 C131.445,65.847 138.000,90.812 138.000,90.812 C138.000,90.812 143.906,83.482 146.000,75.812 C148.365,67.151 148.400,58.573 155.999,67.813 C163.226,76.600 173.959,93.113 180.000,108.812 C190.969,137.321 187.899,164.809 187.899,164.809 Z"
        fill={`url(#${gradientId})`}
        fillRule="evenodd"
      />
      <path
        d="M94.000,254.812 C58.101,254.812 29.000,225.711 29.000,189.812 C29.000,168.151 37.729,155.000 55.896,137.166 C67.528,125.747 78.415,111.722 83.042,102.172 C83.953,100.292 86.026,90.495 94.019,101.966 C98.212,107.982 104.785,118.681 109.000,127.812 C116.266,143.555 118.000,158.812 118.000,158.812 C118.000,158.812 125.121,154.616 130.000,143.812 C131.573,140.330 134.753,127.148 143.643,140.328 C150.166,150.000 159.127,167.390 159.000,189.812 C159.000,225.711 129.898,254.812 94.000,254.812 Z"
        fill="#fc9502"
        fillRule="evenodd"
      />
      <path
        d="M95.000,183.812 C104.250,183.812 104.250,200.941 116.000,223.812 C123.824,239.041 112.121,254.812 95.000,254.812 C77.879,254.812 69.000,240.933 69.000,223.812 C69.000,206.692 85.750,183.812 95.000,183.812 Z"
        fill="#fce202"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function CalendarDayIcons({ icons }: { icons: BookingCalendarDay["icons"] }) {
  const hasFire = icons.includes("fire");
  const isEmpty = !hasFire;

  return (
    <>
      {hasFire ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 z-[1] grid animate-in place-items-center text-[var(--site-primary)] fade-in zoom-in-95 duration-300"
          data-calendar-icon-slot="filled"
        >
          <FireSvgIcon
            className="size-8 drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
            data-calendar-icon="fire"
          />
        </span>
      ) : null}
      {isEmpty ? (
        <span
          aria-hidden="true"
          className="absolute right-1 bottom-1 opacity-0"
          data-calendar-icon-slot="empty"
        />
      ) : null}
    </>
  );
}

export function CalendarDayOverlay({ day }: { day: BookingCalendarDay }) {
  if (day.tone !== "booked") {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden rounded-[inherit] opacity-95"
      data-calendar-overlay="booked-stripes"
      data-calendar-overlay-style="cross"
    >
      <span className="absolute left-1/2 top-1/2 h-[2px] w-[142%] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-white/45 shadow-[0_1px_2px_rgba(70,8,8,0.12)]" />
      <span className="absolute left-1/2 top-1/2 h-[2px] w-[142%] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-white/45 shadow-[0_1px_2px_rgba(70,8,8,0.12)]" />
    </span>
  );
}

export function CalendarFirstAvailablePointer() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -top-8 left-1 z-[35] animate-in drop-shadow-[0_3px_3px_rgba(12,28,24,0.24)] fade-in slide-in-from-bottom-1 zoom-in-95 duration-300"
      data-calendar-first-available-pointer="true"
    >
      <Image
        alt=""
        className="calendar-pointer-bob relative z-10 size-11"
        data-calendar-first-available-icon="true"
        height={44}
        src="/icons/pointing-left-finger-svgrepo-com.svg"
        unoptimized
        width={44}
      />
    </span>
  );
}

export function CalendarFirstAvailableTooltip({
  align,
  onDismiss,
}: {
  align: "center" | "end" | "start";
  onDismiss: () => void;
}) {
  return (
    <article
      aria-label="คำแนะนำการใช้งานปฏิทิน"
      aria-live="polite"
      className={cn(
        "absolute -top-50 z-40 w-64 max-w-[calc(100vw-2rem)] animate-in rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] p-3 text-left shadow-xl shadow-black/15 ring-1 ring-[var(--site-primary)]/10 fade-in duration-200",
        align === "start"
          ? "left-0"
          : align === "end"
            ? "right-0"
            : "left-1/2 -translate-x-1/2",
      )}
      data-calendar-first-available-tip-align={align}
      data-calendar-first-available-tip="true"
      id="tourTooltip"
      role="dialog"
    >
      <div className="text-[10px] font-black tracking-[0.16em] text-[var(--site-primary)] uppercase">
        ทิปการใช้งาน
      </div>
      <h2 className="mt-1 text-sm leading-snug font-black text-[var(--site-text)]">
        กดวันที่เพื่อดูรายละเอียดได้
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--site-muted)]">
        แตะหรือคลิกวันที่ในปฏิทิน เพื่อดูราคา โปรโมชัน และสถานะว่าง/ติดจองของแต่ละวัน
      </p>
      <div className="mt-3 flex justify-end">
        <button
          className="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-bold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] focus-visible:ring-2 focus-visible:ring-[var(--site-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
          data-calendar-first-available-tip-dismiss="true"
          id="dismissTipBtn"
          onClick={onDismiss}
          type="button"
        >
          เข้าใจแล้ว
        </button>
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "absolute bottom-[-7px] size-3 rotate-45 border-r border-b border-[var(--site-border)] bg-[var(--site-surface)]",
          align === "start"
            ? "left-5"
            : align === "end"
              ? "right-5"
              : "left-1/2 -translate-x-1/2",
        )}
      />
    </article>
  );
}

export function CalendarLegendItem({
  children,
  icon,
  overlay,
  swatchClassName,
}: {
  children: string;
  icon?: BookingCalendarDay["icons"][number];
  overlay?: "booked-cross";
  swatchClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-2.5 py-1 text-[11px] text-[var(--site-muted)]">
      <span
        className={cn(
          "relative inline-flex size-4 items-center justify-center overflow-hidden rounded-full border border-[var(--site-border)] bg-[var(--site-surface-soft)] text-[var(--site-text)]",
          swatchClassName,
        )}
      >
        {overlay === "booked-cross" ? (
          <>
            <span className="absolute left-1/2 top-1/2 h-[1.5px] w-[145%] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-white/55" />
            <span className="absolute left-1/2 top-1/2 h-[1.5px] w-[145%] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-white/55" />
          </>
        ) : null}
        {icon === "fire" ? (
          <FireSvgIcon className="relative z-10 size-3" />
        ) : null}
      </span>
      {children}
    </span>
  );
}

export function CalendarLegend() {
  return (
    <div
      className="mt-3 flex flex-wrap justify-center gap-1.5"
      data-calendar-legend="true"
    >
      <CalendarLegendItem swatchClassName="border-emerald-700 bg-emerald-700">
        ติดจองแต่ยังไม่โอน
      </CalendarLegendItem>
      <CalendarLegendItem
        overlay="booked-cross"
        swatchClassName="bg-red-700/60"
      >
        ติดจองแล้ว
      </CalendarLegendItem>
      <CalendarLegendItem swatchClassName="bg-yellow-500/50">
        วันหยุด
      </CalendarLegendItem>
      <CalendarLegendItem icon="fire">โปรไฟลุก</CalendarLegendItem>
    </div>
  );
}
