// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("@/components/admin/admin-auth", () => ({ readAdminAccessToken: vi.fn(async () => "token") }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../review-editor", () => ({ ReviewEditor: ({ onSave, onDelete, error }: { onSave: (form: FormData) => void; onDelete: () => void; error: string }) => <><button onClick={() => onSave(new FormData())}>save</button><button onClick={onDelete}>delete</button>{error ? <p role="alert">{error}</p> : null}</> }));
vi.mock("../review-history", () => ({ ReviewHistory: () => null, formatReviewDate: () => "7 ก.ย. 2569 07:00" }));

import { AdminVillaReviewEditPage } from "../admin-villa-review-edit-page";

const review = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", villaId: "42", villaTitle: "Happy D Pool", rating: 4, comment: "สะอาด", commentExcerpt: "สะอาด", maskedPhone: "xxx-xxxx-6993", imageCount: 2, createdAt: "2026-09-07T00:00:00Z", updatedAt: "2026-09-07T00:00:00Z", phoneE164: "+66812345678", bookingCode: "BOOK1", images: [{id:"image-2",url:"https://localhost/storage/v1/object/public/villa-reviews/second.jpg",displayOrder:2},{id:"image-1",url:"https://localhost/storage/v1/object/public/villa-reviews/first.jpg",displayOrder:1}], editLogs: [] };
let root: Root, host: HTMLDivElement;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await new Promise((resolve) => setTimeout(resolve, 0)); };

beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("confirm", vi.fn(() => true)); vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(review), { status: 200 }))); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("admin review edit page network failures", () => {
  it("keeps the villa title clickable and uses the first review image in the summary", async () => {
    await act(async () => { root.render(<AdminVillaReviewEditPage id={review.id} back="/admin/villa-reviews" />); await flush(); });
    expect(host.querySelector('a[href="/villas/42"]')?.textContent).toContain("Happy D Pool");
    expect(host.querySelector('img[alt="รูปรีวิวแรกของ Happy D Pool"]')?.getAttribute("src")).toContain("first.jpg");
  });
  it("shows an error instead of leaving detail loading when the initial request rejects", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await act(async () => { root.render(<AdminVillaReviewEditPage id={review.id} back="/admin/villa-reviews" />); await flush(); });
    expect(host.textContent).toContain("ไม่สามารถโหลดรายละเอียดรีวิวได้");
    expect(host.textContent).not.toContain("กำลังโหลดรีวิว…");
  });

  it("shows an error when saving request rejects", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(review), { status: 200 })).mockRejectedValueOnce(new Error("offline"));
    await act(async () => { root.render(<AdminVillaReviewEditPage id={review.id} back="/admin/villa-reviews" />); await flush(); });
    await act(async () => { (host.querySelector("button") as HTMLButtonElement).click(); await flush(); });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("ไม่สามารถบันทึกรีวิวได้");
  });

  it("shows an error when deletion request rejects", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(review), { status: 200 })).mockRejectedValueOnce(new Error("offline"));
    await act(async () => { root.render(<AdminVillaReviewEditPage id={review.id} back="/admin/villa-reviews" />); await flush(); });
    await act(async () => { (host.querySelectorAll("button")[1] as HTMLButtonElement).click(); await flush(); });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("ไม่สามารถลบรีวิวได้");
  });
});
