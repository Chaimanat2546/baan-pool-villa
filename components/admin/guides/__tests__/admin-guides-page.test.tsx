/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";

import {
  changeInput,
  click,
  flushEffects,
  makeFetchMock,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";
import type { GuidePost } from "@/lib/guides/types";

const mocks = vi.hoisted(() => ({
  editorInstance: null as null | {
    chain: () => unknown;
    getAttributes: (name: string) => Record<string, unknown>;
    isActive: (name: string, attrs?: Record<string, unknown>) => boolean;
  },
  editorOptions: [] as unknown[],
  imageExtension: { configure: vi.fn() },
  linkExtension: { configure: vi.fn() },
  placeholderExtension: { configure: vi.fn() },
  readAdminAccessToken: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  router: {
    refresh: vi.fn(),
    replace: vi.fn(),
  },
  starterKit: { configure: vi.fn() },
  taskItemExtension: { configure: vi.fn() },
  taskListExtension: { configure: vi.fn() },
}));
mocks.imageExtension.configure.mockReturnValue(mocks.imageExtension);
mocks.linkExtension.configure.mockReturnValue(mocks.linkExtension);
mocks.placeholderExtension.configure.mockReturnValue(mocks.placeholderExtension);
mocks.starterKit.configure.mockReturnValue(mocks.starterKit);
mocks.taskItemExtension.configure.mockReturnValue(mocks.taskItemExtension);

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
  useRouter: () => mocks.router,
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    loading,
    src,
  }: {
    alt: string;
    loading?: "eager" | "lazy";
    src: string;
  }) => (
    <span
      aria-label={alt}
      data-loading={loading ?? ""}
      data-src={src}
      role="img"
    />
  ),
}));
vi.mock("@tiptap/extension-image", () => ({ default: mocks.imageExtension }));
vi.mock("@tiptap/extension-link", () => ({ default: mocks.linkExtension }));
vi.mock("@tiptap/extension-placeholder", () => ({ default: mocks.placeholderExtension }));
vi.mock("@tiptap/extension-task-item", () => ({ default: mocks.taskItemExtension }));
vi.mock("@tiptap/extension-task-list", () => ({ default: mocks.taskListExtension }));
vi.mock("@tiptap/starter-kit", () => ({ default: mocks.starterKit }));
vi.mock("@tiptap/react", () => ({
  EditorContent: () => <div data-testid="mock-editor" />,
  useEditor: (options: unknown) => {
    mocks.editorOptions.push(options);
    return mocks.editorInstance;
  },
}));
vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-bubble-menu">{children}</div>
  ),
}));

import { AdminGuidesPage } from "../admin-guides-page";

describe("AdminGuidesPage", () => {
  beforeEach(() => {
    mocks.editorInstance = null;
    mocks.editorOptions.length = 0;
    mocks.imageExtension.configure.mockClear();
    mocks.linkExtension.configure.mockClear();
    mocks.placeholderExtension.configure.mockClear();
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
    mocks.router.refresh = mocks.refresh;
    mocks.router.replace = mocks.replace;
    mocks.starterKit.configure.mockClear();
    mocks.taskItemExtension.configure.mockClear();
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

  it("redirects to login when guide loading returns an auth 403", async () => {
    const fetchMock = makeFetchMock([
      {
        body: {
          error: "Signed-in user is not listed as an active home config admin.",
        },
        status: 403,
        url: "/api/admin/guides",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminGuidesPage />);

    expect(mocks.replace).toHaveBeenCalledWith("/admin/login");

    await page.unmount();
  });

  it("saves guide edits without triggering a full route refresh", async () => {
    const pinnedGuide = {
      ...guidePost,
      isPinned: true,
    };
    const fetchMock = makeFetchMock([
      {
        body: { guides: [guidePost] },
        url: "/api/admin/guides",
      },
      {
        body: { guide: pinnedGuide },
        method: "PUT",
        url: "/api/admin/guides",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminGuidesPage />);
    const pinnedCheckbox = page.container.querySelector(
      "input[type='checkbox']",
    ) as HTMLInputElement | null;

    expect(pinnedCheckbox).not.toBeNull();

    await click(pinnedCheckbox as HTMLInputElement);
    const callsBeforeSave = fetchMock.mock.calls.length;

    const saveButton = Array.from(page.container.querySelectorAll("button")).find(
      (button) => {
        return button.textContent?.includes("บันทึก");
      },
    );

    expect(saveButton).not.toBeNull();

    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    expect(fetchMock.mock.calls.length - callsBeforeSave).toBe(1);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/guides",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json",
        },
        method: "PUT",
      }),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();

    await page.unmount();
  });

  it("keeps the custom link extension as the only Tiptap link source", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { guides: [guidePost] },
        url: "/api/admin/guides",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminGuidesPage />);

    expect(mocks.starterKit.configure).toHaveBeenCalledWith(
      expect.objectContaining({
        heading: { levels: [2] },
        link: false,
        underline: false,
      }),
    );
    expect(mocks.linkExtension.configure).toHaveBeenCalledTimes(1);

    await page.unmount();
  });

  it("registers rich text marks for guide content editing", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { guides: [guidePost] },
        url: "/api/admin/guides",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminGuidesPage />);
    const editorOptions = mocks.editorOptions[0] as {
      extensions?: { name?: string }[];
    };
    const extensionNames = editorOptions.extensions?.map((extension) => {
      return extension.name;
    });

    expect(extensionNames).toContain("underline");
    expect(extensionNames).toContain("textColor");
    expect(
      extensionNames?.filter((extensionName) => extensionName === "underline"),
    ).toHaveLength(1);

    await page.unmount();
  });

  it("shows a Word-style color control with swatches and native custom picker", async () => {
    const originalInnerWidth = window.innerWidth;
    const run = vi.fn();
    const focus = vi.fn(() => ({ setMark }));
    const setMark = vi.fn(() => ({ run }));

    mocks.editorInstance = {
      chain: () => ({ focus }),
      getAttributes: (name: string) => {
        return name === "textColor" ? { color: "#0f5a66" } : {};
      },
      isActive: () => false,
    };
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 1183,
    });

    const fetchMock = makeFetchMock([
      {
        body: { guides: [guidePost] },
        url: "/api/admin/guides",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminGuidesPage />);
    const colorButton = page.container.querySelector(
      "[data-guide-mark-type='textColor']",
    ) as HTMLButtonElement | null;

    expect(colorButton).not.toBeNull();

    const toolbar = colorButton?.closest("[data-guide-toolbar='bar']");
    expect(toolbar?.className).toContain("grid-rows-2");
    expect(toolbar?.className).toContain("sm:flex");

    const bubbleToolbar = page.container.querySelector(
      "[data-guide-toolbar='bubble']",
    );
    expect(bubbleToolbar?.className).toContain("grid-rows-2");
    expect(bubbleToolbar?.className).toContain("sm:flex");

    await click(colorButton as HTMLButtonElement);

    expect(page.container.querySelector("[role='dialog']")).toBeNull();
    expect(document.body.querySelector("[role='dialog']")).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.paddingRight).toBe("17px");
    expect(
      document.body.querySelectorAll("[data-guide-color-swatch='true']").length,
    ).toBeGreaterThan(20);

    const customButton = document.body.querySelector(
      "[data-guide-color-custom-open='true']",
    ) as HTMLElement | null;

    expect(customButton).not.toBeNull();
    const colorInput = document.body.querySelector(
      "[data-guide-color-picker='true']",
    ) as HTMLInputElement | null;

    expect(colorInput).not.toBeNull();
    expect(customButton?.contains(colorInput)).toBe(true);
    expect(colorInput?.className).toContain("absolute");
    expect(
      document.body.querySelector("[data-guide-color-code-input='true']"),
    ).toBeNull();
    expect(
      document.body.querySelector("[data-guide-color-custom-preview='true']"),
    ).toBeNull();
    expect(
      document.body.querySelector("[data-guide-color-custom-apply='true']"),
    ).toBeNull();

    await click(customButton as HTMLElement);

    await changeInput(colorInput as HTMLInputElement, "#112233");

    expect(setMark).toHaveBeenCalledWith("textColor", { color: "#112233" });
    expect(document.body.style.paddingRight).toBe("");

    await page.unmount();
    expect(document.body.style.overflow).toBe("");
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
    Reflect.deleteProperty(document.documentElement, "clientWidth");
  });

  it("loads the admin guide cover image eagerly", async () => {
    const guideWithCover = {
      ...guidePost,
      coverImage: {
        alt: "Guide cover",
        path: "guides/cover.jpg",
        url: "https://example.supabase.co/storage/v1/object/public/guide-assets/guides/cover.jpg",
      },
    };
    const fetchMock = makeFetchMock([
      {
        body: { guides: [guideWithCover] },
        url: "/api/admin/guides",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminGuidesPage />);
    const coverImage = page.container.querySelector(
      "[role='img'][aria-label='Guide cover']",
    ) as HTMLElement | null;

    expect(coverImage).not.toBeNull();
    expect(coverImage?.dataset.loading).toBe("eager");

    await page.unmount();
  });

  it("defers cover image upload until admins save the guide", async () => {
    const coverImage = {
      alt: "Family Pool Villa",
      path: "guides/cover.jpg",
      url: "https://example.supabase.co/storage/v1/object/public/guide-assets/guides/cover.jpg",
    };
    const savedGuide = {
      ...guidePost,
      coverImage,
    };
    const fetchMock = makeFetchMock([
      {
        body: { guides: [guidePost] },
        url: "/api/admin/guides",
      },
      {
        body: { image: coverImage },
        method: "POST",
        url: "/api/admin/guides/assets",
      },
      {
        body: { guide: savedGuide },
        method: "PUT",
        url: "/api/admin/guides",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminGuidesPage />);
    const coverInput = page.container.querySelector(
      "input[type='file']",
    ) as HTMLInputElement | null;

    expect(coverInput).not.toBeNull();

    Object.defineProperty(coverInput, "files", {
      configurable: true,
      value: [new File(["cover"], "cover.webp", { type: "image/webp" })],
    });

    act(() => {
      coverInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushEffects();

    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/admin/guides/assets"),
    ).toHaveLength(0);

    const saveButton = page.container.querySelector(
      "[data-guide-save='true']",
    ) as HTMLButtonElement | null;

    expect(saveButton).not.toBeNull();
    expect(saveButton?.disabled).toBe(false);

    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/admin/guides/assets"),
    ).toHaveLength(1);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/guides",
      expect.objectContaining({ method: "PUT" }),
    );

    await page.unmount();
  });

  it("clears a pending cover image when admins select another guide", async () => {
    const secondGuide = {
      ...guidePost,
      id: "guide-2",
      slug: "second-family-guide",
      title: "Second Family Guide",
    };
    const fetchMock = makeFetchMock([
      {
        body: { guides: [guidePost, secondGuide] },
        url: "/api/admin/guides",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminGuidesPage />);
    const coverInput = page.container.querySelector(
      "input[type='file']",
    ) as HTMLInputElement | null;

    expect(coverInput).not.toBeNull();

    Object.defineProperty(coverInput, "files", {
      configurable: true,
      value: [new File(["cover"], "cover.webp", { type: "image/webp" })],
    });

    act(() => {
      coverInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushEffects();

    const saveButton = page.container.querySelector(
      "[data-guide-save='true']",
    ) as HTMLButtonElement | null;

    expect(saveButton?.disabled).toBe(false);

    const secondGuideButton = Array.from(
      page.container.querySelectorAll<HTMLButtonElement>("aside button"),
    ).find((button) => {
      return button.textContent?.includes("Second Family Guide");
    });

    expect(secondGuideButton).not.toBeNull();

    await click(secondGuideButton as HTMLButtonElement);

    expect(saveButton?.disabled).toBe(true);
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/admin/guides/assets"),
    ).toHaveLength(0);

    await page.unmount();
  });

  it("rejects unsupported cover images before upload", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { guides: [guidePost] },
        url: "/api/admin/guides",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminGuidesPage />);
    const coverInput = page.container.querySelector(
      "input[type='file']",
    ) as HTMLInputElement | null;

    expect(coverInput).not.toBeNull();

    Object.defineProperty(coverInput, "files", {
      configurable: true,
      value: [new File(["cover"], "cover.gif", { type: "image/gif" })],
    });

    act(() => {
      coverInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushEffects();

    expect(
      fetchMock.mock.calls.filter(([url]) => {
        return url === "/api/admin/guides/assets";
      }),
    ).toHaveLength(0);
    expect(page.container.textContent).toContain(
      "รูปบทความต้องเป็น JPG, PNG หรือ WebP",
    );

    await page.unmount();
  });
});
