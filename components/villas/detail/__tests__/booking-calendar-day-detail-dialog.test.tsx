/** @vitest-environment jsdom */
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { CalendarDayDetailDialog } from "../booking-calendar-day-detail-dialog";

describe("CalendarDayDetailDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("shows every configured phone contact in its saved order", () => {
    const dialogProps = {
      contactLinks: { line: "https://line.me", messenger: "https://m.me" },
      date: new Date(2026, 5, 3),
      day: {
        disabled: false,
        displayPrice: "18,900",
        guestCapacity: null,
        holidayAlert: null,
        icons: [],
        kind: "base",
        label: "ว่าง",
        price: 18900,
        promotionMessage: null,
        tone: "default",
      },
      onClose: () => undefined,
      phoneContacts: [
        { href: "tel:0812345678", phone: "0812345678" },
        { href: "tel:0898765432", phone: "0898765432" },
      ],
    } satisfies ComponentProps<typeof CalendarDayDetailDialog>;
    const markup = renderToStaticMarkup(<CalendarDayDetailDialog {...dialogProps} />);

    expect(markup).toContain('href="tel:0812345678"');
    expect(markup).toContain('href="tel:0898765432"');
    expect(markup.indexOf("0812345678")).toBeLessThan(markup.indexOf("0898765432"));
  });

  it("keeps duplicate phone contacts warning-free", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const dialogProps = {
      contactLinks: { line: "https://line.me", messenger: "https://m.me" },
      date: new Date(2026, 5, 3),
      day: {
        disabled: false,
        displayPrice: "18,900",
        guestCapacity: null,
        holidayAlert: null,
        icons: [],
        kind: "base",
        label: "ว่าง",
        price: 18900,
        promotionMessage: null,
        tone: "default",
      },
      onClose: () => undefined,
      phoneContacts: [
        { href: "tel:0838126451", phone: "0838126451" },
        { href: "tel:0838126451", phone: "0838126451" },
      ],
    } satisfies ComponentProps<typeof CalendarDayDetailDialog>;

    const page = await mountAdminPage(<CalendarDayDetailDialog {...dialogProps} />);

    expect(
      consoleError.mock.calls.filter((call) =>
        String(call[0]).includes("Encountered two children with the same key"),
      ),
    ).toHaveLength(0);
    await page.unmount();
  });
});
