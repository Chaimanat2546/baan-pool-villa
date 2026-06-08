import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { fetchHouseListingsMock, fetchVillaDetailMock } = vi.hoisted(() => ({
  fetchHouseListingsMock: vi.fn(),
  fetchVillaDetailMock: vi.fn(),
}));

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: fetchHouseListingsMock,
  fetchVillaDetail: fetchVillaDetailMock,
}));

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  fetchHouseListingsMock.mockReset();
  fetchVillaDetailMock.mockReset();
});

describe("GET /api/houses", () => {
  it("returns a generic 502 error and logs backend failures", async () => {
    const rawError = new Error("secret listing backend detail");
    fetchHouseListingsMock.mockRejectedValue(rawError);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { GET } = await import("../../../app/(public)/api/houses/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "Unable to load houses" });
    expect(JSON.stringify(body)).not.toContain("secret listing backend detail");
    expect(consoleError).toHaveBeenCalledWith("Unable to load houses", rawError);
  });
});

describe("GET /api/villas/[id]", () => {
  it("returns a generic 502 error and logs backend failures", async () => {
    const rawError = new Error("secret villa backend detail");
    fetchVillaDetailMock.mockRejectedValue(rawError);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { GET } = await import("../../../app/(public)/api/villas/[id]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ id: "9" }),
    });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "Unable to load villa" });
    expect(JSON.stringify(body)).not.toContain("secret villa backend detail");
    expect(consoleError).toHaveBeenCalledWith("Unable to load villa", rawError);
  });

  it("returns 404 when the villa does not exist", async () => {
    fetchVillaDetailMock.mockResolvedValue(null);

    const { GET } = await import("../../../app/(public)/api/villas/[id]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ id: "9" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Villa not found" });
  });
});
