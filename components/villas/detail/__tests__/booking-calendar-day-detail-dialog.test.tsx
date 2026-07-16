import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CalendarDayDetailDialog } from "../booking-calendar-day-detail-dialog";

describe("CalendarDayDetailDialog", () => {
  it("shows the guest capacity and holiday alert for the selected day", () => {
    const markup = renderToStaticMarkup(
      <CalendarDayDetailDialog
        contactLinks={{ line: "https://line.me", messenger: "https://m.me" }}
        date={new Date(2026, 5, 3)}
        day={{
          disabled: false,
          displayPrice: "18,900",
          guestCapacity: "18",
          holidayAlert: "วันหยุดยาว เข้าพักขั้นต่ำ 2 คืน",
          icons: [],
          kind: "holiday",
          label: "วันหยุดนักขัตฤกษ์",
          price: 18900,
          promotionMessage: null,
          tone: "holiday",
        }}
        onClose={() => undefined}
      />,
    );

    expect(markup).toContain("ราคานี้รองรับ 18 ท่าน");
    expect(markup).toContain("วันหยุดยาว เข้าพักขั้นต่ำ 2 คืน");
    expect(markup.indexOf("ราคา 18,900 บาท")).toBeLessThan(
      markup.indexOf("ราคานี้รองรับ 18 ท่าน"),
    );
    expect(markup.indexOf("ราคานี้รองรับ 18 ท่าน")).toBeLessThan(
      markup.indexOf("ราคาเฉพาะวันที่เลือก"),
    );
    expect(markup).toContain(
      "max-h-[calc(100dvh-12rem-env(safe-area-inset-bottom))]",
    );
  });
});
