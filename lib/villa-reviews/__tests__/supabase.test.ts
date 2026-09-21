import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { createVillaReviewsClient } from "../supabase";

describe("villa review Supabase client", () => {
  const previousUrl = process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SECRET_KEY;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "server-only-key";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL = previousUrl;
    process.env.SUPABASE_SECRET_KEY = previousKey;
  });

  it("bounds PostgREST reads so a Worker cannot wait indefinitely", () => {
    createVillaReviewsClient();

    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "server-only-key",
      expect.objectContaining({ db: { timeout: 5_000 } }),
    );
  });
});
