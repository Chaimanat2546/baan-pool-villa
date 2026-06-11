import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertHomeConfigAdmin,
  getBearerToken,
  jsonError,
} from "@/lib/admin/home-config-auth";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/admin/home-config-auth", () => ({
  assertHomeConfigAdmin: vi.fn(),
  getBearerToken: vi.fn(),
  jsonError: vi.fn(
    (
      message: string,
      status: number,
      extra?: Record<string, string | null | undefined>,
    ) => Response.json({ error: message, ...extra }, { status }),
  ),
}));

const assertHomeConfigAdminMock = vi.mocked(assertHomeConfigAdmin);
const getBearerTokenMock = vi.mocked(getBearerToken);
const jsonErrorMock = vi.mocked(jsonError);

function uploadRequest(formData: FormData) {
  return new Request("https://example.com/api/admin/guides/assets", {
    body: formData,
    headers: { authorization: "Bearer token", origin: "https://example.com" },
    method: "POST",
  });
}

function validFormData(fileType = "image/webp") {
  const formData = new FormData();

  formData.set("image", new File(["cover"], "cover.webp", { type: fileType }));
  formData.set("role", "cover");
  formData.set("guideId", "guide-1");
  formData.set("alt", " Pool villa cover ");

  return formData;
}

function uploadHistoryInsertQuery(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });

  return { insert, select, single };
}

function fromQueue(queues: Record<string, unknown[]>) {
  return vi.fn((table: string) => {
    const queue = queues[table];

    if (!queue || queue.length === 0) {
      throw new Error(`Unexpected Supabase table call: ${table}`);
    }

    return queue.shift();
  });
}

function authSupabase(supabase: unknown) {
  assertHomeConfigAdminMock.mockResolvedValue({
    ok: true,
    supabase,
  } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);
}

describe("admin guide asset route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getBearerTokenMock.mockReturnValue("token");
  });

  it("uploads a guide image, records upload history, and returns image metadata", async () => {
    const historyQuery = uploadHistoryInsertQuery({
      data: { id: "upload-1" },
      error: null,
    });
    const from = fromQueue({ guide_asset_uploads: [historyQuery] });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/cover.webp" },
    });
    const storageFrom = vi.fn().mockReturnValue({ getPublicUrl, upload });

    authSupabase({ from, storage: { from: storageFrom } });

    const { POST } = await import(
      "../../../app/(admin)/api/admin/guides/assets/route"
    );
    const response = await POST(uploadRequest(validFormData()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(storageFrom).toHaveBeenCalledWith("guide-assets");
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^guides\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/),
      expect.any(File),
      {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: false,
      },
    );
    expect(historyQuery.insert).toHaveBeenCalledWith({
      asset_role: "cover",
      guide_id: "guide-1",
      storage_bucket: "guide-assets",
      storage_path: expect.stringMatching(/^guides\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/),
      public_url: "https://cdn.example.com/cover.webp",
      is_current: true,
    });
    expect(body.image).toEqual({
      alt: "Pool villa cover",
      path: expect.stringMatching(/^guides\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/),
      url: "https://cdn.example.com/cover.webp",
    });
    expect(jsonErrorMock).not.toHaveBeenCalled();
  });

  it("rejects invalid files before uploading", async () => {
    const upload = vi.fn();
    const storageFrom = vi.fn().mockReturnValue({ upload });

    authSupabase({ from: vi.fn(), storage: { from: storageFrom } });

    const { POST } = await import(
      "../../../app/(admin)/api/admin/guides/assets/route"
    );
    const response = await POST(uploadRequest(validFormData("image/gif")));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: ["รูปบทความต้องเป็น JPG, PNG หรือ WebP"],
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects unsupported asset roles before uploading", async () => {
    const formData = validFormData();
    formData.set("role", "thumbnail");
    const upload = vi.fn();
    const storageFrom = vi.fn().mockReturnValue({ upload });

    authSupabase({ from: vi.fn(), storage: { from: storageFrom } });

    const { POST } = await import(
      "../../../app/(admin)/api/admin/guides/assets/route"
    );
    const response = await POST(uploadRequest(formData));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: ["Guide image role must be cover or inline."],
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("removes an uploaded object when history insert fails", async () => {
    const historyError = {
      message: "History insert failed",
      code: "42501",
      details: "RLS denied",
      hint: "check policy",
    };
    const historyQuery = uploadHistoryInsertQuery({
      data: null,
      error: historyError,
    });
    const from = fromQueue({ guide_asset_uploads: [historyQuery] });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/cover.webp" },
    });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const storageFrom = vi.fn().mockReturnValue({ getPublicUrl, remove, upload });

    authSupabase({ from, storage: { from: storageFrom } });

    const { POST } = await import(
      "../../../app/(admin)/api/admin/guides/assets/route"
    );
    const response = await POST(uploadRequest(validFormData()));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "History insert failed",
      code: "42501",
      details: "RLS denied",
      hint: "check policy",
    });
    expect(remove).toHaveBeenCalledWith([
      expect.stringMatching(/^guides\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/),
    ]);
  });
});
