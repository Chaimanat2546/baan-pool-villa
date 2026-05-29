import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertHomeConfigAdmin,
  getBearerToken,
  jsonError,
} from "@/lib/admin/home-config-auth";
import { SITE_SETTINGS_ID } from "@/lib/site-settings/defaults";
import { DEFAULT_DETAIL_LAYOUT } from "../defaults";
import type { DetailLayoutConfig } from "../types";
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
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });

  return { eq, select, single, update };
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
                enabled: false,
                hideWhenEmpty: false,
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
                enabled: false,
                hideWhenEmpty: false,
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
});
