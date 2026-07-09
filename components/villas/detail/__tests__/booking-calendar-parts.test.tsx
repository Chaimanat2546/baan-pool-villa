import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BookingCalendarDay } from "../booking-calendar-ui";
import {
  CalendarDayIcons,
  CalendarDayOverlay,
  CalendarFirstAvailablePointer,
  CalendarFirstAvailableTooltip,
  CalendarLegend,
  CalendarNextMonthPointer,
} from "../booking-calendar-parts";

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
  });
});
