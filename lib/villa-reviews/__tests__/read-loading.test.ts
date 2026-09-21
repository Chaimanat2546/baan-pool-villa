import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../validation", () => {
  throw new Error("Content moderation must not initialize while loading reviews");
});

it("answers invalid review GETs without loading write-side content moderation", async () => {
  const { getPublicVillaReviews } = await import("../route");
  const response = await getPublicVillaReviews(
    new Request("https://example.com/api/villas/1630/reviews?sort=invalid"),
    "1630",
  );
  expect(response.status).toBe(400);
});
