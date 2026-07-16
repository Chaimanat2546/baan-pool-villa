import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BookingCalendarDay } from "../booking-calendar-ui";
import {
  CalendarDayIcons,
  CalendarDayOverlay,
  CalendarFirstAvailablePointer,
  CalendarFirstAvailableTooltip,
  CalendarLegend,
  CalendarLegendItem,
  CalendarNextMonthPointer,
} from "../booking-calendar-parts";
import { BookingCalendarMonthCaption } from "../booking-calendar-month-caption";

const baseDay: BookingCalendarDay = {
  disabled: false,
  displayPrice: "9,900",
  icons: [],
  kind: "base",
  label: "วันธรรมดา",
  price: 9900,
  promotionMessage: null,
  tone: "default",
};

describe("booking calendar parts", () => {
  it("renders icon slots, overlays, and legend markers", () => {
    const iconsMarkup = renderToStaticMarkup(
      <CalendarDayIcons icons={["fire"]} />,
    );
    const emptyIconsMarkup = renderToStaticMarkup(<CalendarDayIcons icons={[]} />);
    const overlayMarkup = renderToStaticMarkup(
      <CalendarDayOverlay day={{ ...baseDay, tone: "booked" }} />,
    );
    const noOverlayMarkup = renderToStaticMarkup(
      <CalendarDayOverlay day={baseDay} />,
    );
    const pointerMarkup = renderToStaticMarkup(<CalendarFirstAvailablePointer />);
    const nextPointerMarkup = renderToStaticMarkup(<CalendarNextMonthPointer />);
    const tooltipMarkup = renderToStaticMarkup(
      <CalendarFirstAvailableTooltip align="center" onDismiss={() => undefined} />,
    );
    const legendMarkup = renderToStaticMarkup(<CalendarLegend />);
    const swatchMarkup = renderToStaticMarkup(
      <CalendarLegendItem swatchClassName="bg-[var(--site-primary)]">
        test
      </CalendarLegendItem>,
    );

    expect(iconsMarkup).toContain('data-calendar-icon="fire"');
    expect(iconsMarkup).toContain("animate-in");
    expect(iconsMarkup).toContain("calendar-fire-flicker");
    expect(iconsMarkup).not.toMatch(/\sstyle=/);
    expect(iconsMarkup).not.toContain('data-calendar-icon="promotion"');
    expect(emptyIconsMarkup).toContain('data-calendar-icon-slot="empty"');
    expect(emptyIconsMarkup).not.toMatch(/\sstyle=/);
    expect(overlayMarkup).toContain('data-calendar-overlay="booked-stripes"');
    expect(overlayMarkup).not.toMatch(/\sstyle=/);
    expect(noOverlayMarkup).toBe("");
    expect(pointerMarkup).toContain(
      'data-calendar-first-available-pointer="true"',
    );
    expect(pointerMarkup).toContain("animate-in");
    expect(pointerMarkup).toContain("calendar-pointer-bob");
    expect(pointerMarkup).not.toMatch(/\sstyle=/);
    expect(nextPointerMarkup).toContain(
      'data-calendar-next-month-pointer="true"',
    );
    expect(nextPointerMarkup).toContain("animate-in");
    expect(nextPointerMarkup).toContain("calendar-pointer-bob");
    expect(nextPointerMarkup).not.toMatch(/\sstyle=/);
    expect(tooltipMarkup).toContain('data-calendar-first-available-tip="true"');
    expect(tooltipMarkup).toContain("animate-in");
    expect(tooltipMarkup).not.toMatch(/\sstyle=/);
    expect(legendMarkup).not.toMatch(/\sstyle=/);
    expect(legendMarkup).toContain("ติดจองแล้ว");
    expect(legendMarkup).not.toContain("โปรโมชั่น");
    expect(legendMarkup).toContain("bg-emerald-700");
    expect(legendMarkup).toContain("bg-[var(--site-danger,#991b1b)]");
    expect(legendMarkup).toContain("bg-yellow-500");
    expect(swatchMarkup).not.toContain("bg-[var(--site-surface-soft)]");
  });

  it("hides the navigation finger when a prior month is visible", () => {
    const priorCaptionMarkup = renderToStaticMarkup(
      <BookingCalendarMonthCaption
        calendarMonth={{ date: new Date(2026, 5, 1) }}
        currentMonth={new Date(2026, 6, 1)}
        maximumMonth={new Date(2027, 6, 1)}
        minimumMonth={new Date(2026, 5, 1)}
        setVisibleMonth={() => undefined}
        showNextMonthPointer={false}
      />,
    );

    expect(priorCaptionMarkup).not.toContain(
      'data-calendar-next-month-pointer="true"',
    );
  });
});
