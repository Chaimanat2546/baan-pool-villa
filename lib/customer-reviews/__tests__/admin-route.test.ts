import { beforeEach, describe, expect, it, vi } from "vitest";

import { revalidateCustomerReviewsCache } from "@/lib/cache-revalidation";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
}));

import {
  deleteAdminCustomerReviewImage,
  handleAdminCustomerReviewPatch,
  parseCustomerReviewHomepageQueuePayload,
  saveAdminCustomerReviewHomepageQueue,
  uploadAdminCustomerReviewImage,
} from "../admin-route";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/cache-revalidation", () => ({
  revalidateCustomerReviewsCache: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

const revalidateCustomerReviewsCacheMock = vi.mocked(
  revalidateCustomerReviewsCache,
);

const FIRST_IMAGE_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_IMAGE_ID = "22222222-2222-4222-8222-222222222222";
const ONE_PIXEL_PNG = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  ),
);

function jsonRequest(body: unknown) {
  return new Request("https://example.com/api/admin/customer-reviews", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
}

function multipartRequest(formData: FormData) {
  return new Request("https://example.com/api/admin/customer-reviews", {
    body: formData,
    method: "POST",
  });
}

describe("admin customer review route helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockRejectedValue(new Error("No Cloudflare context"));
  });

  it("validates homepage queue payloads before calling Supabase", () => {
    expect(
      parseCustomerReviewHomepageQueuePayload({
        imageIds: [FIRST_IMAGE_ID, SECOND_IMAGE_ID],
        layout: "carousel",
      }),
    ).toEqual({
      errors: [],
      queue: {
        imageIds: [FIRST_IMAGE_ID, SECOND_IMAGE_ID],
        layout: "carousel",
      },
    });
    expect(
      parseCustomerReviewHomepageQueuePayload({
        imageIds: [FIRST_IMAGE_ID, FIRST_IMAGE_ID],
        layout: "grid",
      }).errors,
    ).toEqual([
      "layout must be featured_rail, proof_wall, or carousel.",
      "imageIds must not contain duplicate ids.",
    ]);
    expect(
      parseCustomerReviewHomepageQueuePayload({
        imageIds: Array.from({ length: 21 }, (_, index) =>
          `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`,
        ),
        layout: "proof_wall",
      }).errors,
    ).toContain("Select no more than 20 homepage images.");
  });

  it("saves the homepage queue through the RPC and revalidates public cache", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const supabase = { rpc };

    const response = await saveAdminCustomerReviewHomepageQueue(
      jsonRequest({
        imageIds: [SECOND_IMAGE_ID, FIRST_IMAGE_ID],
        layout: "featured_rail",
      }),
      supabase as never,
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("save_customer_review_homepage_queue", {
      image_ids: [SECOND_IMAGE_ID, FIRST_IMAGE_ID],
      selected_layout: "featured_rail",
    });
    expect(revalidateCustomerReviewsCacheMock).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({
      layout: "featured_rail",
      queueImageIds: [SECOND_IMAGE_ID, FIRST_IMAGE_ID],
    });
  });

  it("updates image alt through the patch dispatcher", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        alt: "Updated proof",
        created_at: "2026-07-10T05:00:00.000Z",
        homepage_order: 1,
        id: FIRST_IMAGE_ID,
        is_active: true,
        is_homepage: true,
        public_url: "https://assets.example.com/proof.webp",
        storage_path: "customer-reviews/2026/07/proof.webp",
        updated_at: "2026-07-10T05:00:00.000Z",
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const supabase = {
      from: vi.fn(() => ({ update })),
    };

    const response = await handleAdminCustomerReviewPatch(
      jsonRequest({
        action: "update-image",
        alt: "Updated proof",
        id: FIRST_IMAGE_ID,
      }),
      supabase as never,
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      alt: "Updated proof",
    });
    expect(eq).toHaveBeenCalledWith("id", FIRST_IMAGE_ID);
    expect(revalidateCustomerReviewsCacheMock).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      image: {
        alt: "Updated proof",
        homepageOrder: 1,
        id: FIRST_IMAGE_ID,
        isActive: true,
        isHomepage: true,
      },
    });
  });

  it("rejects hidden status updates", async () => {
    const response = await handleAdminCustomerReviewPatch(
      jsonRequest({
        action: "update-image",
        id: FIRST_IMAGE_ID,
        isActive: false,
      }),
      {} as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: ["isActive updates are not supported.", "Provide alt to update."],
    });
  });

  it("deletes an image row before conservatively removing upload history and storage", async () => {
    const selectSingle = vi.fn().mockResolvedValue({
      data: { storage_path: "customer-reviews/2026/07/proof.webp" },
      error: null,
    });
    const selectEq = vi.fn(() => ({ single: selectSingle }));
    const selectImage = vi.fn(() => ({ eq: selectEq }));
    const deleteImageEq = vi.fn().mockResolvedValue({ error: null });
    const deleteImage = vi.fn(() => ({ eq: deleteImageEq }));
    const historyEqPath = vi.fn().mockResolvedValue({ error: null });
    const historyEqBucket = vi.fn(() => ({ eq: historyEqPath }));
    const historyEqAsset = vi.fn(() => ({ eq: historyEqBucket }));
    const deleteHistory = vi.fn(() => ({ eq: historyEqAsset }));
    const remove = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "customer_review_images") {
          return { delete: deleteImage, select: selectImage };
        }

        if (table === "site_asset_uploads") {
          return { delete: deleteHistory };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({ remove })),
      },
    };

    const response = await deleteAdminCustomerReviewImage(
      new Request(
        `https://example.com/api/admin/customer-reviews?id=${FIRST_IMAGE_ID}`,
        { method: "DELETE" },
      ),
      supabase as never,
    );

    expect(response.status).toBe(200);
    expect(selectImage).toHaveBeenCalledWith("storage_path");
    expect(deleteImageEq).toHaveBeenCalledWith("id", FIRST_IMAGE_ID);
    expect(historyEqAsset).toHaveBeenCalledWith(
      "asset_type",
      "customer-review",
    );
    expect(historyEqBucket).toHaveBeenCalledWith(
      "storage_bucket",
      "site-assets",
    );
    expect(historyEqPath).toHaveBeenCalledWith(
      "storage_path",
      "customer-reviews/2026/07/proof.webp",
    );
    expect(remove).toHaveBeenCalledWith(["customer-reviews/2026/07/proof.webp"]);
    expect(revalidateCustomerReviewsCacheMock).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({
      deletedImageId: FIRST_IMAGE_ID,
      warning: null,
    });
  });

  it("deletes multiple image rows in one request", async () => {
    const paths = [
      "customer-reviews/2026/07/proof-1.webp",
      "customer-reviews/2026/07/proof-2.webp",
    ];
    const selectSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { storage_path: paths[0] }, error: null })
      .mockResolvedValueOnce({ data: { storage_path: paths[1] }, error: null });
    const selectEq = vi.fn(() => ({ single: selectSingle }));
    const selectImage = vi.fn(() => ({ eq: selectEq }));
    const deleteImageEq = vi.fn().mockResolvedValue({ error: null });
    const deleteImage = vi.fn(() => ({ eq: deleteImageEq }));
    const historyEqPath = vi.fn().mockResolvedValue({ error: null });
    const historyEqBucket = vi.fn(() => ({ eq: historyEqPath }));
    const historyEqAsset = vi.fn(() => ({ eq: historyEqBucket }));
    const deleteHistory = vi.fn(() => ({ eq: historyEqAsset }));
    const remove = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "customer_review_images") {
          return { delete: deleteImage, select: selectImage };
        }

        if (table === "site_asset_uploads") {
          return { delete: deleteHistory };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({ remove })),
      },
    };

    const response = await deleteAdminCustomerReviewImage(
      new Request(
        `https://example.com/api/admin/customer-reviews?ids=${FIRST_IMAGE_ID},${SECOND_IMAGE_ID}`,
        { method: "DELETE" },
      ),
      supabase as never,
    );

    expect(response.status).toBe(200);
    expect(deleteImageEq).toHaveBeenCalledWith("id", FIRST_IMAGE_ID);
    expect(deleteImageEq).toHaveBeenCalledWith("id", SECOND_IMAGE_ID);
    expect(historyEqPath).toHaveBeenCalledWith("storage_path", paths[0]);
    expect(historyEqPath).toHaveBeenCalledWith("storage_path", paths[1]);
    expect(remove).toHaveBeenCalledWith([paths[0]]);
    expect(remove).toHaveBeenCalledWith([paths[1]]);
    expect(revalidateCustomerReviewsCacheMock).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({
      deletedImageIds: [FIRST_IMAGE_ID, SECOND_IMAGE_ID],
      warnings: [],
    });
  });

  it("rejects multipart patch requests because image replacement is not supported", async () => {
    const file = new File(["new image"], "new-proof.webp", { type: "image/webp" });
    const formData = new FormData();
    formData.set("action", "replace-image");
    formData.set("id", FIRST_IMAGE_ID);
    formData.set("image", file);

    const response = await handleAdminCustomerReviewPatch(
      multipartRequest(formData),
      {} as never,
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      errors: ["Image replacement is not supported."],
    });
  });

  it("uploads a customer review image and records it in the image library", async () => {
    const file = new File(["image"], "proof.webp", { type: "image/webp" });
    const formData = new FormData();
    formData.set("alt", "Customer slip");
    formData.set("image", file);

    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn(() => ({
      data: {
        publicUrl:
          "https://example.supabase.co/storage/v1/object/public/site-assets/customer-reviews/2026/07/proof.webp",
      },
    }));
    const remove = vi.fn().mockResolvedValue({ error: null });

    const insertHistory = vi.fn();
    const selectHistory = vi.fn();
    const singleHistory = vi.fn().mockResolvedValue({
      data: { id: "upload-1" },
      error: null,
    });
    insertHistory.mockReturnValue({ select: selectHistory });
    selectHistory.mockReturnValue({ single: singleHistory });

    const insertImage = vi.fn();
    const selectImage = vi.fn();
    const singleImage = vi.fn().mockResolvedValue({
      data: {
        alt: "Customer slip",
        created_at: "2026-07-10T04:00:00.000Z",
        homepage_order: null,
        id: FIRST_IMAGE_ID,
        is_active: true,
        is_homepage: false,
        public_url:
          "https://example.supabase.co/storage/v1/object/public/site-assets/customer-reviews/2026/07/proof.webp",
        storage_path: "customer-reviews/2026/07/proof.webp",
        updated_at: "2026-07-10T04:00:00.000Z",
      },
      error: null,
    });
    insertImage.mockReturnValue({ select: selectImage });
    selectImage.mockReturnValue({ single: singleImage });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "site_asset_uploads") {
          return { insert: insertHistory };
        }

        if (table === "customer_review_images") {
          return { insert: insertImage };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({ getPublicUrl, remove, upload })),
      },
    };

    const response = await uploadAdminCustomerReviewImage(
      multipartRequest(formData),
      supabase as never,
    );

    expect(response.status).toBe(200);
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^customer-reviews\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/),
      expect.any(File),
      {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: false,
      },
    );
    expect(insertHistory).toHaveBeenCalledWith({
      asset_type: "customer-review",
      is_current: true,
      public_url:
        "https://example.supabase.co/storage/v1/object/public/site-assets/customer-reviews/2026/07/proof.webp",
      storage_bucket: "site-assets",
      storage_path: expect.stringMatching(
        /^customer-reviews\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/,
      ),
    });
    expect(insertImage).toHaveBeenCalledWith({
      alt: "Customer slip",
      is_active: true,
      is_homepage: false,
      public_url:
        "https://example.supabase.co/storage/v1/object/public/site-assets/customer-reviews/2026/07/proof.webp",
      storage_bucket: "site-assets",
      storage_path: expect.stringMatching(
        /^customer-reviews\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/,
      ),
    });
    expect(remove).not.toHaveBeenCalled();
    expect(revalidateCustomerReviewsCacheMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      image: {
        alt: "Customer slip",
        createdAt: "2026-07-10T04:00:00.000Z",
        homepageOrder: null,
        id: FIRST_IMAGE_ID,
        isActive: true,
        isHomepage: false,
        path: "customer-reviews/2026/07/proof.webp",
        updatedAt: "2026-07-10T04:00:00.000Z",
        url:
          "https://example.supabase.co/storage/v1/object/public/site-assets/customer-reviews/2026/07/proof.webp",
      },
    });
  });

  it("converts PNG customer review images to WebP before storage upload", async () => {
    const file = new File([ONE_PIXEL_PNG], "proof.png", { type: "image/png" });
    const formData = new FormData();
    formData.set("alt", "Customer slip");
    formData.set("image", file);

    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn(() => ({
      data: {
        publicUrl:
          "https://example.supabase.co/storage/v1/object/public/site-assets/customer-reviews/2026/07/proof.webp",
      },
    }));
    const remove = vi.fn().mockResolvedValue({ error: null });
    const insertHistory = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "upload-1" },
          error: null,
        }),
      })),
    }));
    const insertImage = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            alt: "Customer slip",
            created_at: "2026-07-10T04:00:00.000Z",
            homepage_order: null,
            id: FIRST_IMAGE_ID,
            is_active: true,
            is_homepage: false,
            public_url:
              "https://example.supabase.co/storage/v1/object/public/site-assets/customer-reviews/2026/07/proof.webp",
            storage_path: "customer-reviews/2026/07/proof.webp",
            updated_at: "2026-07-10T04:00:00.000Z",
          },
          error: null,
        }),
      })),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "site_asset_uploads") {
          return { insert: insertHistory };
        }

        if (table === "customer_review_images") {
          return { insert: insertImage };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({ getPublicUrl, remove, upload })),
      },
    };

    const response = await uploadAdminCustomerReviewImage(
      multipartRequest(formData),
      supabase as never,
    );

    expect(response.status).toBe(200);
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^customer-reviews\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/),
      expect.objectContaining({ name: "proof.webp", type: "image/webp" }),
      {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: false,
      },
    );
  });

  it("uses Cloudflare Images to convert customer review uploads when available", async () => {
    const file = new File([ONE_PIXEL_PNG], "proof.png", { type: "image/png" });
    const formData = new FormData();
    formData.set("alt", "Customer slip");
    formData.set("image", file);

    const output = vi.fn().mockResolvedValue({
      response: () =>
        new Response("webp", {
          headers: { "content-type": "image/webp" },
          status: 200,
        }),
    });
    const input = vi.fn(() => ({ output }));
    mocks.getCloudflareContext.mockResolvedValue({
      env: {
        IMAGES: { input },
      },
    });

    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn(() => ({
      data: {
        publicUrl:
          "https://example.supabase.co/storage/v1/object/public/site-assets/customer-reviews/2026/07/proof.webp",
      },
    }));
    const remove = vi.fn().mockResolvedValue({ error: null });
    const insertHistory = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "upload-1" },
          error: null,
        }),
      })),
    }));
    const insertImage = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            alt: "Customer slip",
            created_at: "2026-07-10T04:00:00.000Z",
            homepage_order: null,
            id: FIRST_IMAGE_ID,
            is_active: true,
            is_homepage: false,
            public_url:
              "https://example.supabase.co/storage/v1/object/public/site-assets/customer-reviews/2026/07/proof.webp",
            storage_path: "customer-reviews/2026/07/proof.webp",
            updated_at: "2026-07-10T04:00:00.000Z",
          },
          error: null,
        }),
      })),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "site_asset_uploads") {
          return { insert: insertHistory };
        }

        if (table === "customer_review_images") {
          return { insert: insertImage };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({ getPublicUrl, remove, upload })),
      },
    };

    const response = await uploadAdminCustomerReviewImage(
      multipartRequest(formData),
      supabase as never,
    );

    expect(response.status).toBe(200);
    expect(input).toHaveBeenCalledWith(expect.any(ReadableStream));
    expect(output).toHaveBeenCalledWith({ format: "image/webp", quality: 90 });
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^customer-reviews\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/),
      expect.objectContaining({ name: "proof.webp", type: "image/webp" }),
      {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: false,
      },
    );
  });

  it("falls back to Sharp when Cloudflare Images conversion fails", async () => {
    const file = new File([ONE_PIXEL_PNG], "proof.png", { type: "image/png" });
    const formData = new FormData();
    formData.set("alt", "Customer slip");
    formData.set("image", file);
    const output = vi.fn().mockRejectedValue(new Error("Cloudflare unavailable"));
    mocks.getCloudflareContext.mockResolvedValue({ env: { IMAGES: { input: vi.fn(() => ({ output })) } } });

    const upload = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: "upload-1", alt: "Customer slip", created_at: "2026-07-10T04:00:00.000Z", homepage_order: null, is_active: true, is_homepage: false, public_url: "https://assets.example.com/proof.webp", storage_path: "customer-reviews/2026/07/proof.webp", updated_at: "2026-07-10T04:00:00.000Z" }, error: null }) })) }));
    const supabase = {
      from: vi.fn(() => ({ insert })),
      storage: { from: vi.fn(() => ({ getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://assets.example.com/proof.webp" } })), remove: vi.fn(), upload })) },
    };

    const response = await uploadAdminCustomerReviewImage(
      multipartRequest(formData),
      supabase as never,
    );

    expect(response.status).toBe(200);
    expect(upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ name: "proof.webp", type: "image/webp" }),
      expect.any(Object),
    );
  });

  it("rejects unsupported customer review images before storage upload", async () => {
    const file = new File(["image"], "proof.gif", { type: "image/gif" });
    const formData = new FormData();
    formData.set("image", file);
    const supabase = {
      from: vi.fn(),
      storage: { from: vi.fn() },
    };

    const response = await uploadAdminCustomerReviewImage(
      multipartRequest(formData),
      supabase as never,
    );

    expect(response.status).toBe(400);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.storage.from).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      errors: [
        "Image must be JPG, PNG, or WebP.",
        "Image extension must be .jpg, .jpeg, .png, or .webp.",
      ],
    });
  });

  it("cleans up uploaded storage and history when image metadata save fails", async () => {
    const file = new File(["image"], "proof.webp", { type: "image/webp" });
    const formData = new FormData();
    formData.set("image", file);

    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn(() => ({
      data: { publicUrl: "https://assets.example.com/proof.webp" },
    }));
    const remove = vi.fn().mockResolvedValue({ error: null });
    const insertHistory = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "upload-1" },
          error: null,
        }),
      })),
    }));
    const deleteHistory = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    const insertImage = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "insert failed" },
        }),
      })),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "site_asset_uploads") {
          return { delete: deleteHistory, insert: insertHistory };
        }

        if (table === "customer_review_images") {
          return { insert: insertImage };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({ getPublicUrl, remove, upload })),
      },
    };

    const response = await uploadAdminCustomerReviewImage(
      multipartRequest(formData),
      supabase as never,
    );

    expect(response.status).toBe(500);
    expect(deleteHistory).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith([
      expect.stringMatching(/^customer-reviews\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/),
    ]);
    expect(revalidateCustomerReviewsCacheMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: "insert failed",
    });
  });
});
