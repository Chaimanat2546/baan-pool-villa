export interface SuccessfulImageResponseEvent {
  requestIdentity: object;
  url: string;
}

interface FirstRailFullImageResponseSelection {
  excludedImageSources: string[];
  firstRailFullImageSources: string[];
  responses: SuccessfulImageResponseEvent[];
}

function normalizeImageSource(source: string): string {
  return new URL(source).href;
}

export function selectFirstRailFullImageResponseEvents({
  excludedImageSources,
  firstRailFullImageSources,
  responses,
}: FirstRailFullImageResponseSelection): SuccessfulImageResponseEvent[] {
  const firstRailSources = new Set(
    firstRailFullImageSources.map(normalizeImageSource),
  );
  const excludedSources = new Set(excludedImageSources.map(normalizeImageSource));

  for (const source of firstRailSources) {
    if (excludedSources.has(source)) {
      throw new Error(
        `A first-rail full image source is shared with an excluded image: ${source}`,
      );
    }
  }

  return responses.filter((response) =>
    firstRailSources.has(normalizeImageSource(response.url)),
  );
}
