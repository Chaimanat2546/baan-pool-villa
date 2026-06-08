/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  click,
  makeFetchMock,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";
import type { GuidePost } from "@/lib/guides/types";

const mocks = vi.hoisted(() => ({
  extension: {
    configure: vi.fn(),
  },
  readAdminAccessToken: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));
mocks.extension.configure.mockReturnValue(mocks.extension);

const guidePost: GuidePost = {
  contentBlocks: [{ text: "Intro", type: "paragraph" }],
  coverImage: null,
  createdAt: "2026-06-08T00:00:00.000Z",
  excerpt: "Guide excerpt",
  id: "guide-1",
  isPinned: false,
  publishedAt: null,
  recommendedHouseIds: ["2938"],
  slug: "family-pool-villa",
  status: "draft",
  tags: ["family"],
  title: "Family Pool Villa",
  updatedAt: "2026-06-08T00:00:00.000Z",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh,
    replace: mocks.replace,
  }),
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

vi.mock("@tiptap/extension-image", () => ({ default: mocks.extension }));
vi.mock("@tiptap/extension-link", () => ({ default: mocks.extension }));
vi.mock("@tiptap/extension-placeholder", () => ({ default: mocks.extension }));
vi.mock("@tiptap/extension-task-item", () => ({ default: mocks.extension }));
vi.mock("@tiptap/extension-task-list", () => ({ default: mocks.extension }));
vi.mock("@tiptap/starter-kit", () => ({ default: mocks.extension }));
vi.mock("@tiptap/react", () => ({
  EditorContent: () => <div data-testid="mock-editor" />,
  useEditor: () => null,
}));
vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: () => null,
}));

import { AdminGuidesPage } from "../admin-guides-page";

describe("AdminGuidesPage", () => {
  beforeEach(() => {
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads guide drafts and lets admins add a local draft", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { guides: [guidePost] },
        url: "/api/admin/guides",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminGuidesPage />);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/guides",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
    expect(page.container.querySelector("#guidesPageHeader")).not.toBeNull();
    expect(page.container.textContent).toContain("Family Pool Villa");

    const addButton = page.container.querySelector(
      "#guidesPageHeader button",
    ) as HTMLButtonElement | null;
    expect(addButton).not.toBeNull();

    await click(addButton as HTMLButtonElement);

    expect(page.container.textContent).toContain("2");
    expect(
      fetchMock.mock.calls.every(([url, init]) => {
        return url === "/api/admin/guides" && init?.method === undefined;
      }),
    ).toBe(true);

    await page.unmount();
  });
});
