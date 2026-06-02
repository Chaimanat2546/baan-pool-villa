import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertHomeConfigAdmin,
  getBearerToken,
  jsonError,
} from "@/lib/admin/home-config-auth";
import {
  DEFAULT_SITE_SETTINGS,
  SITE_SETTINGS_ID,
} from "@/lib/site-settings/defaults";
import {
  DEFAULT_DETAIL_LAYOUT,
  DEFAULT_DETAIL_LAYOUT_V2,
} from "../defaults";
import type { DetailLayoutConfig, DetailLayoutV2Config } from "../types";
import { validateDetailLayout } from "../validation";

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

vi.mock("@/lib/site-settings/defaults", async () => import("../../site-settings/defaults"));
vi.mock("@/lib/detail-layout/defaults", async () => import("../defaults"));
vi.mock("@/lib/detail-layout/validation", async () => import("../validation"));

const assertHomeConfigAdminMock = vi.mocked(assertHomeConfigAdmin);
const getBearerTokenMock = vi.mocked(getBearerToken);
const jsonErrorMock = vi.mocked(jsonError);

function detailLayoutSelectQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });

  return { eq, maybeSingle, select };
}

function detailLayoutUpdateQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });

  return { eq, maybeSingle, select, update };
}

function detailLayoutInsertQuery(result: { data: unknown; error: unknown }) {
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

function authenticatedRequest() {
  return new Request("https://example.com/api/admin/detail-layout", {
    headers: { authorization: "Bearer token" },
  });
}

function putRequest(body: unknown) {
  return new Request("https://example.com/api/admin/detail-layout", {
    body: JSON.stringify(body),
    headers: {
      authorization: "Bearer token",
      "content-type": "application/json",
    },
    method: "PUT",
  });
}

function authSupabase(supabase: unknown) {
  assertHomeConfigAdminMock.mockResolvedValue({
    ok: true,
    supabase,
  } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);
}

function customLayout(): DetailLayoutConfig {
  return {
    ...DEFAULT_DETAIL_LAYOUT,
    rows: [
      {
        id: " custom_row ",
        columns: 2,
        ratio: "60/40",
        enabled: true,
        blocks: [
          {
            type: "details",
            title: " Custom details ",
            enabled: true,
            hideWhenEmpty: true,
          },
          {
            type: "booking_contact",
            title: " Booking ",
            enabled: false,
            hideWhenEmpty: false,
          },
        ],
      },
    ],
  };
}

function customLayoutV2(): DetailLayoutV2Config {
  return {
    ...DEFAULT_DETAIL_LAYOUT_V2,
    mainSplit: {
      ...DEFAULT_DETAIL_LAYOUT_V2.mainSplit,
      ratio: "30/70",
      wideRows: [
        {
          id: " wide_details ",
          columns: 2,
          ratio: "60/40",
          enabled: true,
          blocks: [
            {
              type: "details",
              title: " Custom details ",
              enabled: true,
              hideWhenEmpty: true,
            },
            {
              type: "amenities",
              title: " Amenities ",
              enabled: true,
              hideWhenEmpty: true,
            },
          ],
        },
      ],
      narrowRows: [
        {
          id: " narrow_booking ",
          enabled: true,
          block: {
            type: "booking_contact",
            title: " Booking ",
            enabled: true,
            hideWhenEmpty: false,
          },
        },
      ],
    },
  };
}

describe("admin detail layout route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getBearerTokenMock.mockReturnValue("token");
  });

  it("requires admin auth and returns normalized layout on GET", async () => {
    const detailLayout = customLayout();
    const query = detailLayoutSelectQuery({
      data: {
        id: SITE_SETTINGS_ID,
        detail_layout: detailLayout,
      },
      error: null,
    });
    const from = vi.fn().mockReturnValue(query);

    authSupabase({ from });

    const { GET } = await import(
      "../../../app/(admin)/api/admin/detail-layout/route"
    );
    const response = await GET(authenticatedRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      layout: {
        version: 1,
        lockedTop: ["gallery", "intro"],
        rows: [
          {
            id: "custom_row",
            columns: 2,
            ratio: "60/40",
            enabled: true,
            blocks: [
              {
                type: "details",
                title: "Custom details",
                enabled: true,
                hideWhenEmpty: true,
              },
              {
                type: "booking_contact",
                title: "Booking",
                enabled: true,
                hideWhenEmpty: true,
              },
            ],
          },
        ],
      },
    });
    expect(from).toHaveBeenCalledWith("site_settings");
    expect(query.select).toHaveBeenCalledWith("id,detail_layout");
    expect(query.eq).toHaveBeenCalledWith("id", SITE_SETTINGS_ID);
  });

  it("returns normalized V2 layout on GET", async () => {
    const detailLayout = customLayoutV2();
    const query = detailLayoutSelectQuery({
      data: {
        id: SITE_SETTINGS_ID,
        detail_layout: detailLayout,
      },
      error: null,
    });
    const from = vi.fn().mockReturnValue(query);

    authSupabase({ from });

    const { GET } = await import(
      "../../../app/(admin)/api/admin/detail-layout/route"
    );
    const response = await GET(authenticatedRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      layout: {
        version: 2,
        mainSplit: {
          ratio: "30/70",
          wideRows: [
            {
              id: "wide_details",
              ratio: "50/50",
              blocks: [
                {
                  title: "Custom details",
                },
                {
                  title: "Amenities",
                },
              ],
            },
          ],
          narrowRows: [
            {
              id: "narrow_booking",
              block: {
                title: "Booking",
              },
            },
          ],
        },
      },
    });
  });

  it("rejects invalid PUT layout with validation errors", async () => {
    authSupabase({ from: vi.fn() });
    const invalidLayout = {
      ...DEFAULT_DETAIL_LAYOUT,
      rows: [
        {
          id: "empty",
          columns: 2,
          ratio: "80/20",
          enabled: true,
          blocks: [],
        },
      ],
    };
    const expectedErrors = validateDetailLayout(invalidLayout).errors;

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/detail-layout/route"
    );
    const response = await PUT(putRequest({ layout: invalidLayout }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ errors: expectedErrors });
  });

  it("rejects invalid JSON on PUT", async () => {
    authSupabase({ from: vi.fn() });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/detail-layout/route"
    );
    const response = await PUT(
      new Request("https://example.com/api/admin/detail-layout", {
        body: "{",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        method: "PUT",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: ["Request body must be JSON."],
    });
  });

  it("surfaces Supabase save details on PUT", async () => {
    const saveError = {
      message: "Save failed",
      code: "23514",
      details: "check constraint",
      hint: "fix detail layout",
    };
    const query = detailLayoutUpdateQuery({ data: null, error: saveError });
    const from = vi.fn().mockReturnValue(query);

    authSupabase({ from });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/detail-layout/route"
    );
    const response = await PUT(putRequest({ layout: DEFAULT_DETAIL_LAYOUT }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Save failed",
      code: "23514",
      details: "check constraint",
      hint: "fix detail layout",
    });
  });

  it("saves and returns normalized layout on PUT", async () => {
    const detailLayout = customLayout();
    const query = detailLayoutUpdateQuery({
      data: {
        id: SITE_SETTINGS_ID,
        detail_layout: detailLayout,
      },
      error: null,
    });
    const from = vi.fn().mockReturnValue(query);

    authSupabase({ from });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/detail-layout/route"
    );
    const response = await PUT(putRequest({ layout: detailLayout }));

    expect(response.status).toBe(200);
    expect(query.update).toHaveBeenCalledWith({
      detail_layout: {
        version: 1,
        lockedTop: ["gallery", "intro"],
        rows: [
          {
            id: "custom_row",
            columns: 2,
            ratio: "60/40",
            enabled: true,
            blocks: [
              {
                type: "details",
                title: "Custom details",
                enabled: true,
                hideWhenEmpty: true,
              },
              {
                type: "booking_contact",
                title: "Booking",
                enabled: true,
                hideWhenEmpty: true,
              },
            ],
          },
        ],
      },
    });
    expect(query.eq).toHaveBeenCalledWith("id", SITE_SETTINGS_ID);
    expect(query.select).toHaveBeenCalledWith("id,detail_layout");
    await expect(response.json()).resolves.toMatchObject({
      layout: {
        rows: [
          {
            id: "custom_row",
            ratio: "60/40",
          },
        ],
      },
    });
    expect(jsonErrorMock).not.toHaveBeenCalled();
  });

  it("saves and returns normalized V2 layout on PUT", async () => {
    const detailLayout = customLayoutV2();
    const query = detailLayoutUpdateQuery({
      data: {
        id: SITE_SETTINGS_ID,
        detail_layout: detailLayout,
      },
      error: null,
    });
    const from = vi.fn().mockReturnValue(query);

    authSupabase({ from });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/detail-layout/route"
    );
    const response = await PUT(putRequest({ layout: detailLayout }));

    expect(response.status).toBe(200);
    expect(query.update).toHaveBeenCalledWith({
      detail_layout: expect.objectContaining({
        version: 2,
        mainSplit: expect.objectContaining({
          ratio: "30/70",
          wideRows: [
            expect.objectContaining({
              id: "wide_details",
              ratio: "50/50",
            }),
          ],
          narrowRows: [
            expect.objectContaining({
              id: "narrow_booking",
            }),
          ],
        }),
      }),
    });
    await expect(response.json()).resolves.toMatchObject({
      layout: {
        version: 2,
        mainSplit: {
          ratio: "30/70",
        },
      },
    });
    expect(jsonErrorMock).not.toHaveBeenCalled();
  });

  it("creates the global settings row with defaults when PUT update finds no row", async () => {
    const detailLayout = customLayout();
    const updateQuery = detailLayoutUpdateQuery({
      data: null,
      error: null,
    });
    const insertQuery = detailLayoutInsertQuery({
      data: {
        id: SITE_SETTINGS_ID,
        detail_layout: detailLayout,
      },
      error: null,
    });
    const from = fromQueue({
      site_settings: [updateQuery, insertQuery],
    });

    authSupabase({ from });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/detail-layout/route"
    );
    const response = await PUT(putRequest({ layout: detailLayout }));

    expect(response.status).toBe(200);
    expect(updateQuery.maybeSingle).toHaveBeenCalled();
    expect(insertQuery.insert).toHaveBeenCalledWith({
      id: SITE_SETTINGS_ID,
      site_name: DEFAULT_SITE_SETTINGS.siteName,
      primary_color: DEFAULT_SITE_SETTINGS.primaryColor,
      accent_color: DEFAULT_SITE_SETTINGS.accentColor,
      logo_image_path: DEFAULT_SITE_SETTINGS.logoImage.path,
      logo_image_url: DEFAULT_SITE_SETTINGS.logoImage.url,
      hero_image_path: DEFAULT_SITE_SETTINGS.heroImage.path,
      hero_image_url: DEFAULT_SITE_SETTINGS.heroImage.url,
      hero_image_alt: DEFAULT_SITE_SETTINGS.heroImage.alt,
      bank_account_name: DEFAULT_SITE_SETTINGS.bank.accountName,
      bank_name: DEFAULT_SITE_SETTINGS.bank.bankName,
      bank_account_number: DEFAULT_SITE_SETTINGS.bank.accountNumber,
      phone_contacts: DEFAULT_SITE_SETTINGS.contact.phoneContacts,
      messenger_url: DEFAULT_SITE_SETTINGS.contact.messengerUrl,
      line_id: DEFAULT_SITE_SETTINGS.contact.lineId,
      line_url: DEFAULT_SITE_SETTINGS.contact.lineUrl,
      seo_title: DEFAULT_SITE_SETTINGS.seo.title,
      seo_description: DEFAULT_SITE_SETTINGS.seo.description,
      seo_og_image_url: DEFAULT_SITE_SETTINGS.seo.ogImage.url,
      seo_og_image_alt: DEFAULT_SITE_SETTINGS.seo.ogImage.alt,
      seo_business_name: DEFAULT_SITE_SETTINGS.seo.businessName,
      seo_same_as_urls: DEFAULT_SITE_SETTINGS.seo.sameAsUrls,
      detail_layout: {
        version: 1,
        lockedTop: ["gallery", "intro"],
        rows: [
          {
            id: "custom_row",
            columns: 2,
            ratio: "60/40",
            enabled: true,
            blocks: [
              {
                type: "details",
                title: "Custom details",
                enabled: true,
                hideWhenEmpty: true,
              },
              {
                type: "booking_contact",
                title: "Booking",
                enabled: true,
                hideWhenEmpty: true,
              },
            ],
          },
        ],
      },
    });
    expect(insertQuery.select).toHaveBeenCalledWith("id,detail_layout");
    await expect(response.json()).resolves.toEqual({
      layout: {
        version: 1,
        lockedTop: ["gallery", "intro"],
        rows: [
          {
            id: "custom_row",
            columns: 2,
            ratio: "60/40",
            enabled: true,
            blocks: [
              {
                type: "details",
                title: "Custom details",
                enabled: true,
                hideWhenEmpty: true,
              },
              {
                type: "booking_contact",
                title: "Booking",
                enabled: true,
                hideWhenEmpty: true,
              },
            ],
          },
        ],
      },
    });
  });

  it("surfaces Supabase insert details when missing-row create fails", async () => {
    const insertError = {
      message: "Insert failed",
      code: "23502",
      details: "site_name cannot be null",
      hint: "include required defaults",
    };
    const updateQuery = detailLayoutUpdateQuery({
      data: null,
      error: null,
    });
    const insertQuery = detailLayoutInsertQuery({
      data: null,
      error: insertError,
    });
    const from = fromQueue({
      site_settings: [updateQuery, insertQuery],
    });

    authSupabase({ from });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/detail-layout/route"
    );
    const response = await PUT(putRequest({ layout: DEFAULT_DETAIL_LAYOUT }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Insert failed",
      code: "23502",
      details: "site_name cannot be null",
      hint: "include required defaults",
    });
  });
});
