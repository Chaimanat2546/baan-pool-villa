import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/villa-reviews/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/villa-reviews/server")>();
  return { ...actual, verifyVillaReviewBooking: vi.fn() };
});

import {
  verifyVillaReviewBooking,
  VillaReviewError,
} from "@/lib/villa-reviews/server";
import { POST } from "./route";

const context = (id = "villa-1") => ({ params: Promise.resolve({ id }) });
const request = (body: unknown) =>
  new Request("https://example.com/api/villas/villa-1/reviews/verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("review booking verification route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only a neutral booking field error when booking verification fails", async () => {
    vi.mocked(verifyVillaReviewBooking).mockRejectedValue(
      new VillaReviewError(
        "booking_verification_failed",
        "private booking data",
        false,
        { bookingCode: "ไม่พบข้อมูลการจองที่ตรงกัน" },
      ),
    );

    const response = await POST(
      request({ bookingCode: "BOOKING-1", phone: "0812345678" }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      fieldErrors: { bookingCode: "ไม่พบข้อมูลการจองที่ตรงกัน" },
    });
  });

  it("passes the two customer fields and villa ID to server verification", async () => {
    vi.mocked(verifyVillaReviewBooking).mockResolvedValue();

    const response = await POST(
      request({ bookingCode: "BOOKING-1", phone: "0812345678" }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(verifyVillaReviewBooking).toHaveBeenCalledWith({
      villaId: "villa-1",
      bookingCode: "BOOKING-1",
      phone: "0812345678",
    });
  });
});
