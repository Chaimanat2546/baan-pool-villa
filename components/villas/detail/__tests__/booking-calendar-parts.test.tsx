import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BookingCalendarDay } from "../booking-calendar-ui";
import {
  CalendarDayIcons,
  CalendarDayOverlay,
  CalendarLegendItem,
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
      <CalendarDayIcons icons={["fire", "promotion"]} />,
    );
    const emptyIconsMarkup = renderToStaticMarkup(<CalendarDayIcons icons={[]} />);
    const overlayMarkup = renderToStaticMarkup(
      <CalendarDayOverlay day={{ ...baseDay, tone: "booked" }} />,
    );
    const noOverlayMarkup = renderToStaticMarkup(
      <CalendarDayOverlay day={baseDay} />,
    );
    const legendMarkup = renderToStaticMarkup(
      <CalendarLegendItem icon="promotion">โปรโมชั่น</CalendarLegendItem>,
    );

    expect(iconsMarkup).toContain('data-calendar-icon="fire"');
    expect(iconsMarkup).toContain('data-calendar-icon="promotion"');
    expect(emptyIconsMarkup).toContain('data-calendar-icon-slot="empty"');
    expect(overlayMarkup).toContain('data-calendar-overlay="booked-stripes"');
    expect(noOverlayMarkup).toBe("");
    expect(legendMarkup).toContain("โปรโมชั่น");
  });
});
