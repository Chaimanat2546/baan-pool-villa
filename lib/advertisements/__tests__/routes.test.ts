import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GET,
  POST,
  DELETE,
} from "../../../app/(admin)/api/admin/advertisements/route";
import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  listAdminAdvertisements,
  saveAdminAdvertisement,
  deleteAdminAdvertisement,
} from "../admin-route";
vi.mock("@/lib/admin/route-helpers", () => ({
  requireHomeConfigAdmin: vi.fn(),
}));
vi.mock("../admin-route", () => ({
  listAdminAdvertisements: vi.fn(),
  saveAdminAdvertisement: vi.fn(),
  deleteAdminAdvertisement: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
describe("advertisement admin authorization", () => {
  it.each([GET, POST, DELETE])(
    "rejects unauthorized requests before touching advertisement helpers",
    async (handler) => {
      vi.mocked(requireHomeConfigAdmin).mockResolvedValue({
        ok: false,
        response: new Response(null, { status: 401 }),
      });
      expect(
        (
          await handler(
            new Request("https://example.com/api/admin/advertisements"),
          )
        ).status,
      ).toBe(401);
      for (const helper of [
        listAdminAdvertisements,
        saveAdminAdvertisement,
        deleteAdminAdvertisement,
      ])
        expect(helper).not.toHaveBeenCalled();
    },
  );
});
