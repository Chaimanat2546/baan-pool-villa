/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  click,
  flushEffects,
  makeFetchMock,
  makeJsonResponse,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";
import type { LegalPage } from "@/lib/legal-pages/types";

const mocks = vi.hoisted(() => ({
  readAdminAccessToken: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  router: {
    refresh: vi.fn(),
    replace: vi.fn(),
  },
}));

const termsPage: LegalPage = {
  contentBlocks: [
    { type: "heading", content: [{ type: "text", text: "Terms heading" }] },
    { type: "paragraph", content: [{ type: "text", text: "Terms body" }] },
  ],
  createdAt: "2026-06-10T01:00:00.000Z",
  id: "terms-row",
  publishedAt: "2026-06-10T02:00:00.000Z",
  seoDescription: "Terms SEO",
  slug: "terms",
  status: "published",
  title: "Terms and Conditions",
  updatedAt: "2026-06-10T03:00:00.000Z",
};

const privacyPage: LegalPage = {
  contentBlocks: [
    { type: "paragraph", content: [{ type: "text", text: "Privacy body" }] },
  ],
  createdAt: "2026-06-10T01:00:00.000Z",
  id: "privacy-row",
  publishedAt: null,
  seoDescription: "Privacy SEO",
  slug: "privacy",
  status: "draft",
  title: "Privacy Policy",
  updatedAt: "2026-06-10T03:00:00.000Z",
};

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

import { AdminLegalPagesPage } from "../admin-legal-pages-page";

function changeTextField(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  act(() => {
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

    valueSetter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function legalListResponse() {
  return {
    legalPages: [termsPage, privacyPage],
  };
}

describe("AdminLegalPagesPage", () => {
  beforeEach(() => {
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
    mocks.router.refresh = mocks.refresh;
    mocks.router.replace = mocks.replace;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads legal pages and selects terms by default", async () => {
    const fetchMock = makeFetchMock([
      {
        body: legalListResponse(),
        url: "/api/admin/legal-pages",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminLegalPagesPage />);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/legal-pages",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
    expect(page.container.querySelector('[data-legal-page="terms"]')).not.toBeNull();
    expect(page.container.querySelector('[data-legal-page="privacy"]')).not.toBeNull();
    expect((page.container.querySelector("#legalTitle") as HTMLInputElement).value).toBe(
      "Terms and Conditions",
    );

    await page.unmount();
  });

  it("saves legal edits without refreshing the admin route", async () => {
    const savedTerms = {
      ...termsPage,
      title: "Updated Terms",
      updatedAt: "2026-06-10T04:00:00.000Z",
    };
    const fetchMock = makeFetchMock([
      {
        body: legalListResponse(),
        url: "/api/admin/legal-pages",
      },
      {
        body: { legalPage: savedTerms },
        method: "PUT",
        url: "/api/admin/legal-pages",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminLegalPagesPage />);
    const titleInput = page.container.querySelector("#legalTitle") as HTMLInputElement;
    const contentInput = page.container.querySelector(
      "#legalContent",
    ) as HTMLTextAreaElement;

    changeTextField(titleInput, "Updated Terms");
    changeTextField(
      contentInput,
      "# Heading\n\n> Quote\n\n- Bullet\n\n1. Numbered\n\nPlain paragraph",
    );
    await flushEffects();

    const saveButton = Array.from(page.container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("บันทึก"),
    ) as HTMLButtonElement | undefined;

    expect(saveButton).not.toBeUndefined();
    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/legal-pages",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json",
        },
        method: "PUT",
      }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      legalPage: {
        contentBlocks: [
          { type: "heading", content: [{ type: "text", text: "Heading" }] },
          { type: "quote", content: [{ type: "text", text: "Quote" }] },
          { type: "bulletListItem", content: [{ type: "text", text: "Bullet" }] },
          {
            type: "numberedListItem",
            content: [{ type: "text", text: "Numbered" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Plain paragraph" }],
          },
        ],
        slug: "terms",
        title: "Updated Terms",
      },
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(page.container.textContent).toContain("บันทึกหน้ากฎหมายเรียบร้อยแล้ว");

    await page.unmount();
  });

  it("keeps dirty and saved state scoped to the selected legal page", async () => {
    const savedPrivacy = {
      ...privacyPage,
      title: "Updated Privacy",
      updatedAt: "2026-06-10T04:00:00.000Z",
    };
    const fetchMock = makeFetchMock([
      {
        body: legalListResponse(),
        url: "/api/admin/legal-pages",
      },
      {
        body: { legalPage: savedPrivacy },
        method: "PUT",
        url: "/api/admin/legal-pages",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminLegalPagesPage />);
    const termsTitleInput = page.container.querySelector(
      "#legalTitle",
    ) as HTMLInputElement;

    changeTextField(termsTitleInput, "Unsaved Terms");
    await flushEffects();

    const privacyButton = page.container.querySelector(
      '[data-legal-page="privacy"]',
    ) as HTMLButtonElement;
    await click(privacyButton);

    const saveButton = Array.from(page.container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("บันทึก"),
    ) as HTMLButtonElement | undefined;

    expect(saveButton?.disabled).toBe(true);

    const privacyTitleInput = page.container.querySelector(
      "#legalTitle",
    ) as HTMLInputElement;

    changeTextField(privacyTitleInput, "Updated Privacy");
    await flushEffects();
    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      legalPage: {
        slug: "privacy",
        title: "Updated Privacy",
      },
    });
    expect((page.container.querySelector("#legalTitle") as HTMLInputElement).value).toBe(
      "Updated Privacy",
    );

    const termsButton = page.container.querySelector(
      '[data-legal-page="terms"]',
    ) as HTMLButtonElement;
    await click(termsButton);

    expect((page.container.querySelector("#legalTitle") as HTMLInputElement).value).toBe(
      "Unsaved Terms",
    );

    await page.unmount();
  });

  it("blocks invalid legal page drafts before sending a save request", async () => {
    const fetchMock = makeFetchMock([
      {
        body: legalListResponse(),
        url: "/api/admin/legal-pages",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminLegalPagesPage />);
    const contentInput = page.container.querySelector(
      "#legalContent",
    ) as HTMLTextAreaElement;

    changeTextField(contentInput, "");
    await flushEffects();

    const saveButton = page.container.querySelector(
      "#legalPagesHeader button",
    ) as HTMLButtonElement | null;

    expect(saveButton).not.toBeNull();

    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    expect(
      fetchMock.mock.calls.filter(([url, init]) => {
        return url === "/api/admin/legal-pages" && init?.method === "PUT";
      }),
    ).toHaveLength(0);
    expect(page.container.textContent).toContain(
      "หน้ากฎหมายที่เผยแพร่ต้องมีเนื้อหาอย่างน้อย 1 บล็อก",
    );

    await page.unmount();
  });

  it("locks editing and page switching while a save request is pending", async () => {
    let resolveSave: (response: Response) => void = () => {};
    const saveResponse = new Promise<Response>((resolve) => {
      resolveSave = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = input instanceof Request ? input.url : String(input);
      const requestMethod = input instanceof Request
        ? input.method
        : init?.method ?? "GET";

      if (requestUrl === "/api/admin/legal-pages" && requestMethod === "PUT") {
        return saveResponse;
      }

      return Promise.resolve(
        makeJsonResponse({
          body: legalListResponse(),
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminLegalPagesPage />);
    const titleInput = page.container.querySelector("#legalTitle") as HTMLInputElement;

    changeTextField(titleInput, "Updated Terms");
    await flushEffects();

    const saveButton = Array.from(page.container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("บันทึก"),
    ) as HTMLButtonElement | undefined;

    await click(saveButton as HTMLButtonElement);

    expect(
      (page.container.querySelector('[data-legal-page="privacy"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect((page.container.querySelector("#legalTitle") as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(
      (page.container.querySelector("#legalContent") as HTMLTextAreaElement).disabled,
    ).toBe(true);

    await act(async () => {
      resolveSave(
        makeJsonResponse({
          body: {
            legalPage: {
              ...termsPage,
              title: "Updated Terms",
            },
          },
        }),
      );
      await Promise.resolve();
    });
    await flushEffects();

    expect((page.container.querySelector("#legalTitle") as HTMLInputElement).value).toBe(
      "Updated Terms",
    );

    await page.unmount();
  });

  it("locks editing while the save token lookup is pending", async () => {
    let resolveSaveToken: (token: string) => void = () => {};
    const pendingSaveToken = new Promise<string>((resolve) => {
      resolveSaveToken = resolve;
    });
    mocks.readAdminAccessToken
      .mockResolvedValueOnce("admin-token")
      .mockReturnValueOnce(pendingSaveToken);
    const fetchMock = makeFetchMock([
      {
        body: legalListResponse(),
        url: "/api/admin/legal-pages",
      },
      {
        body: {
          legalPage: {
            ...termsPage,
            title: "Updated Terms",
          },
        },
        method: "PUT",
        url: "/api/admin/legal-pages",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminLegalPagesPage />);
    const titleInput = page.container.querySelector("#legalTitle") as HTMLInputElement;

    changeTextField(titleInput, "Updated Terms");
    await flushEffects();

    const saveButton = Array.from(page.container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("บันทึก"),
    ) as HTMLButtonElement | undefined;

    await click(saveButton as HTMLButtonElement);

    expect((page.container.querySelector("#legalTitle") as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(
      (page.container.querySelector('[data-legal-page="privacy"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await act(async () => {
      resolveSaveToken("admin-token");
      await Promise.resolve();
    });
    await flushEffects();

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/legal-pages",
      expect.objectContaining({
        method: "PUT",
      }),
    );

    await page.unmount();
  });

  it("switches the editor and preview to privacy", async () => {
    const fetchMock = makeFetchMock([
      {
        body: legalListResponse(),
        url: "/api/admin/legal-pages",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminLegalPagesPage />);
    const privacyButton = page.container.querySelector(
      '[data-legal-page="privacy"]',
    ) as HTMLButtonElement | null;

    expect(privacyButton).not.toBeNull();
    await click(privacyButton as HTMLButtonElement);

    expect((page.container.querySelector("#legalTitle") as HTMLInputElement).value).toBe(
      "Privacy Policy",
    );
    expect(page.container.textContent).toContain("Privacy body");

    await page.unmount();
  });

  it("shows non-auth 403 errors without redirecting to login", async () => {
    const fetchMock = makeFetchMock([
      {
        body: {
          code: "42501",
          details: "RLS denied",
          error: "Access denied.",
          hint: "Check policy",
        },
        status: 403,
        url: "/api/admin/legal-pages",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminLegalPagesPage />);
    await flushEffects();

    expect(page.container.textContent).toContain("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
    expect(page.container.textContent).toContain("42501");
    expect(mocks.replace).not.toHaveBeenCalled();

    await page.unmount();
  });

  it("redirects to login without fetching when the admin token is missing", async () => {
    const fetchMock = vi.fn();
    mocks.readAdminAccessToken.mockResolvedValue(null);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminLegalPagesPage />);

    expect(mocks.replace).toHaveBeenCalledWith("/admin/login");
    expect(fetchMock).not.toHaveBeenCalled();

    await page.unmount();
  });
});
