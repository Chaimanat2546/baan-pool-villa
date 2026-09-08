// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VillaReviewModal } from "../villa-review-modal";

let root: Root;
let host: HTMLDivElement;
const fetchMock = vi.fn();
const submitted = vi.fn();
const closed = vi.fn();
async function click(text: string) {
  const button = Array.from(document.querySelectorAll("button")).find((node) =>
    node.textContent?.includes(text),
  );
  await act(async () => button?.click());
}
async function fill(selector: string, value: string) {
  const node = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    selector,
  )!;
  const prototype =
    node.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function stepTwo() {
  await fill('[name="bookingCode"]', "booking-private");
  await fill('[name="phone"]', "0812345678");
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
  await click("ถัดไป");
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  submitted.mockReset();
  closed.mockReset();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <VillaReviewModal
        villaId="villa-1"
        onClose={closed}
        onSubmitted={submitted}
      />,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("review modal", () => {
  it("separates the scrollable form body from the persistent action bar", () => {
    const dialog = document.querySelector("dialog")!;
    const body = document.querySelector("[data-review-modal-scroll]")!;
    const actions = document.querySelector("[data-review-modal-actions]")!;

    expect(dialog.className).toContain("overflow-hidden");
    expect(dialog.className).toContain("#ffffff");
    expect(body.className).toContain("overflow-y-auto");
    expect(body.className).toContain("space-y-5");
    expect(actions.className).toContain("shrink-0");
    expect(actions.className).toContain("#ffffff");
  });

  it("validates private fields before showing the second and last step", async () => {
    expect(document.querySelector('[name="bookingCode"]')).not.toBeNull();
    expect(document.querySelector('[name="rating"]')).toBeNull();
    await stepTwo();
    expect(document.querySelector('[name="bookingCode"]')).toBeNull();
    expect(document.querySelectorAll('[name="rating"]')).toHaveLength(5);
    expect(document.body.textContent).toContain("ขั้นตอน 2 จาก 2");
    await click("ย้อนกลับ");
    expect(
      document.querySelector<HTMLInputElement>('[name="phone"]')?.value,
    ).toBe("0812345678");
  });
  it("verifies booking details before showing the review step and keeps a mismatch in its section", async () => {
    await fill('[name="bookingCode"]', "booking-private");
    await fill('[name="phone"]', "0812345678");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        fieldErrors: { bookingCode: "ไม่พบข้อมูลการจองที่ตรงกัน" },
      }),
    });

    await click("ถัดไป");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/villas/villa-1/reviews/verification",
      expect.objectContaining({ method: "POST" }),
    );
    expect(document.querySelector('[name="bookingCode"]')).not.toBeNull();
    expect(document.querySelector('[name="rating"]')).toBeNull();
    expect(document.body.textContent).toContain("ไม่พบข้อมูลการจองที่ตรงกัน");
    expect(document.body.textContent).not.toContain("กรุณาตรวจสอบข้อมูลที่ระบุ");
  });
  it("moves focus and scrolls to the first invalid experience field", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: scrollIntoView,
      configurable: true,
    });
    await stepTwo();

    await click("ส่งรีวิว");

    const firstRating = document.querySelector<HTMLInputElement>(
      '[name="rating"][value="1"]',
    )!;
    expect(document.activeElement).toBe(firstRating);
    expect(scrollIntoView).toHaveBeenCalled();
  });
  it("returns to and focuses booking details when the booking code already has a review", async () => {
    await stepTwo();
    await act(async () =>
      document
        .querySelector<HTMLInputElement>('[name="rating"][value="5"]')!
        .click(),
    );
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "รหัสการจองนี้เคยใช้รีวิวแล้ว",
        fieldErrors: { bookingCode: "รหัสการจองนี้เคยใช้รีวิวแล้ว" },
      }),
    });

    await click("ส่งรีวิว");

    const booking = document.querySelector<HTMLInputElement>('[name="bookingCode"]')!;
    expect(booking).not.toBeNull();
    expect(document.activeElement).toBe(booking);
    expect(document.body.textContent).toContain("รหัสการจองนี้เคยใช้รีวิวแล้ว");
  });
  it("keeps comment and rating after a server error, and passes only public data after success", async () => {
    await stepTwo();
    await act(async () =>
      document
        .querySelector<HTMLInputElement>('[name="rating"][value="5"]')!
        .click(),
    );
    await fill('[name="comment"]', "บ้านสะอาด");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "แก้ไขความคิดเห็น",
        fieldErrors: { comment: "คำไม่เหมาะสม" },
        detectedWords: ["คำต้องห้าม"],
      }),
    });
    await click("ส่งรีวิว");
    expect(document.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "บ้านสะอาด",
    );
    const sectionStatus = document.querySelector("[data-review-section-status]")!;
    const ratingField = document.querySelector('[name="rating"][value="1"]')!;
    expect(sectionStatus.textContent).toContain("แก้ไขความคิดเห็น");
    expect(
      sectionStatus.compareDocumentPosition(ratingField) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(document.body.textContent).toContain("คำไม่เหมาะสม");
    expect(document.body.textContent).toContain("คำที่ตรวจพบ: คำต้องห้าม");
    expect(closed).not.toHaveBeenCalled();
    const review = {
      id: "review-1",
      villaId: "villa-1",
      rating: 5,
      comment: "บ้านสะอาด",
      maskedPhone: "xxx-xxxx-5678",
      images: [],
      createdAt: "2026-09-07T00:00:00Z",
      updatedAt: "2026-09-07T00:00:00Z",
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        review: {
          ...review,
          phone: "0812345678",
          bookingCode: "booking-private",
        },
      }),
    });
    await click("ส่งรีวิว");
    expect(submitted).toHaveBeenCalledWith(review);
    expect(closed).toHaveBeenCalledOnce();
    const body = fetchMock.mock.calls[2][1].body as FormData;
    expect(body.get("phone")).toBe("0812345678");
  });
  it("rejects oversized files before creating previews and revokes valid previews on removal", async () => {
    await stepTwo();
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const large = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    await act(async () => {
      Object.defineProperty(input, "files", {
        value: [large],
        configurable: true,
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(document.body.textContent).toContain("5 MB");
    expect(document.body.textContent).toContain("big.jpg");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await act(async () => {
      Object.defineProperty(input, "files", {
        value: [new File(["image"], "small.jpg", { type: "image/jpeg" })],
        configurable: true,
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>('[aria-label="ลบรูปที่ 1"]')!
        .click(),
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("keeps the first five valid files without a stale rejection after a larger selection", async () => {
    await stepTwo();
    vi.mocked(URL.createObjectURL).mockImplementation(
      (file) => `blob:${(file as File).name}`,
    );
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const files = Array.from(
      { length: 6 },
      (_, index) =>
        new File(["image"], `photo-${index + 1}.jpg`, {
          type: "image/jpeg",
        }),
    );

    await act(async () => {
      Object.defineProperty(input, "files", {
        value: files,
        configurable: true,
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(
      document.querySelectorAll('[aria-label^="ลบรูปที่"]'),
    ).toHaveLength(5);
    expect(document.body.textContent).not.toContain("แนบรูปได้สูงสุด 5 รูป");
  });

  it("submits an optional blank comment and repeated images once while pending", async () => {
    await stepTwo();
    await act(async () =>
      document
        .querySelector<HTMLInputElement>('[name="rating"][value="4"]')!
        .click(),
    );
    const files = [
      new File(["a"], "one.jpg", { type: "image/jpeg" }),
      new File(["b"], "two.png", { type: "image/png" }),
    ];
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce("blob:one")
      .mockReturnValueOnce("blob:two");
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      Object.defineProperty(input, "files", {
        value: files,
        configurable: true,
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    let resolveResponse!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveResponse = resolve;
      }),
    );
    await click("ส่งรีวิว");
    await act(async () =>
      document
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      document.querySelector<HTMLButtonElement>(
        '[aria-label="ปิดหน้าต่างรีวิว"]',
      )?.disabled,
    ).toBe(true);
    const body = fetchMock.mock.calls[1][1].body as FormData;
    expect(body.get("comment")).toBe("");
    expect(body.getAll("images")).toHaveLength(2);
    await act(async () =>
      resolveResponse({
        ok: true,
        json: async () => ({
          review: {
            id: "1",
            villaId: "villa-1",
            rating: 4,
            comment: "",
            maskedPhone: "xxx-xxxx-5678",
            images: [],
            createdAt: "2026-09-07T00:00:00Z",
            updatedAt: "2026-09-07T00:00:00Z",
          },
        }),
      }),
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:one");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:two");
    expect(closed).toHaveBeenCalledOnce();
  });

  it("revokes every remaining object URL when the modal unmounts", async () => {
    await stepTwo();
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      Object.defineProperty(input, "files", {
        value: [new File(["a"], "one.jpg", { type: "image/jpeg" })],
        configurable: true,
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => root.render(null));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
    expect(document.body.classList.contains("body-scroll-locked")).toBe(false);
  });
});
