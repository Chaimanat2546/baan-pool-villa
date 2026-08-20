import { describe, expect, it } from "vitest";

import {
  selectFirstRailFullImageResponseEvents,
  type SuccessfulImageResponseEvent,
} from "./production-smoke-image-responses";

function responseEvent(url: string, sequence: number): SuccessfulImageResponseEvent {
  return { requestIdentity: { sequence }, url };
}

describe("production smoke first-rail image response attribution", () => {
  it("retains every successful response event instead of deduplicating URLs", () => {
    const url = "https://example.com/api/houses/images/1?w=640&q=60";
    const responses = Array.from({ length: 5 }, (_, index) =>
      responseEvent(url, index),
    );

    expect(
      selectFirstRailFullImageResponseEvents({
        excludedImageSources: [],
        firstRailFullImageSources: [url],
        responses,
      }),
    ).toHaveLength(5);
  });

  it("rejects ambiguous sources shared with thumbnails or later rails", () => {
    const sharedUrl = "https://example.com/api/houses/images/1?w=640&q=60";

    expect(() =>
      selectFirstRailFullImageResponseEvents({
        excludedImageSources: [sharedUrl],
        firstRailFullImageSources: [sharedUrl],
        responses: [responseEvent(sharedUrl, 1)],
      }),
    ).toThrow("first-rail full image source is shared");
  });

  it("excludes successful image responses outside first-rail main images", () => {
    const firstRailUrl = "https://example.com/api/houses/images/1?w=640&q=60";
    const thumbnailUrl = "https://example.com/api/houses/images/1?w=96&q=60";
    const laterRailUrl = "https://example.com/api/houses/images/9?w=640&q=60";

    expect(
      selectFirstRailFullImageResponseEvents({
        excludedImageSources: [thumbnailUrl, laterRailUrl],
        firstRailFullImageSources: [firstRailUrl],
        responses: [
          responseEvent(thumbnailUrl, 1),
          responseEvent(firstRailUrl, 2),
          responseEvent(laterRailUrl, 3),
        ],
      }),
    ).toEqual([responseEvent(firstRailUrl, 2)]);
  });
});
