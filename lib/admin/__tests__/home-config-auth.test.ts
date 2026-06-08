import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHomeConfigClient } from "@/lib/home-sections/supabase";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createHomeConfigClient: vi.fn(),
}));

const createHomeConfigClientMock = vi.mocked(createHomeConfigClient);

function makeSupabaseClient(userId = "admin-user") {
  const limit = vi.fn().mockResolvedValue({
    data: [{ user_id: userId }],
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit }) });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const getUser = vi.fn().mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });

  return {
    auth: { getUser },
    from,
    getUser,
    limit,
  };
}

function tokenWithExpiry(expiresAtSeconds: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: expiresAtSeconds, sub: "admin-user" }),
  ).toString("base64url");

  return `header.${payload}.signature`;
}

describe("home config admin auth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("reuses successful admin auth checks inside the short TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T08:00:00.000Z"));
    const supabase = makeSupabaseClient();
    createHomeConfigClientMock.mockReturnValue(supabase as never);
    const { assertHomeConfigAdmin } = await import("../home-config-auth");

    const token = tokenWithExpiry(Math.floor(Date.now() / 1000) + 300);
    const firstResult = await assertHomeConfigAdmin(token);
    const secondResult = await assertHomeConfigAdmin(token);

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    expect(createHomeConfigClientMock).toHaveBeenCalledTimes(1);
    expect(supabase.getUser).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("rechecks Supabase after the short admin auth cache TTL expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T08:00:00.000Z"));
    const firstSupabase = makeSupabaseClient();
    const secondSupabase = makeSupabaseClient();
    createHomeConfigClientMock
      .mockReturnValueOnce(firstSupabase as never)
      .mockReturnValueOnce(secondSupabase as never);
    const { assertHomeConfigAdmin } = await import("../home-config-auth");

    const token = tokenWithExpiry(Math.floor(Date.now() / 1000) + 300);
    await assertHomeConfigAdmin(token);
    vi.setSystemTime(new Date("2026-06-08T08:00:31.000Z"));
    await assertHomeConfigAdmin(token);

    expect(createHomeConfigClientMock).toHaveBeenCalledTimes(2);
    expect(firstSupabase.getUser).toHaveBeenCalledTimes(1);
    expect(secondSupabase.getUser).toHaveBeenCalledTimes(1);
  });

  it("does not cache failed admin auth checks", async () => {
    const deniedSupabase = makeSupabaseClient();
    deniedSupabase.limit.mockResolvedValueOnce({ data: [], error: null });
    const allowedSupabase = makeSupabaseClient();
    createHomeConfigClientMock
      .mockReturnValueOnce(deniedSupabase as never)
      .mockReturnValueOnce(allowedSupabase as never);
    const { assertHomeConfigAdmin } = await import("../home-config-auth");

    const token = tokenWithExpiry(Math.floor(Date.now() / 1000) + 300);
    const firstResult = await assertHomeConfigAdmin(token);
    const secondResult = await assertHomeConfigAdmin(token);

    expect(firstResult.ok).toBe(false);
    expect(secondResult.ok).toBe(true);
    expect(createHomeConfigClientMock).toHaveBeenCalledTimes(2);
  });
});
