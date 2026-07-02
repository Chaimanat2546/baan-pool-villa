import { getZoneLabel } from "./normalize";

export type VillaZoneOption = {
  label: string;
  value: string;
};

export const SEARCH_MIN_PRICE = 1000;
export const SEARCH_DEFAULT_MAX_PRICE = 13000;
export const SEARCH_MAX_PRICE = 100000;

const SEARCH_ZONE_VALUES = [
  "pattaya",
  "jomtien",
  "bangsaray",
  "sattahip",
  "bangsean",
  "rayong",
  "hua_hin",
  "khaoyai",
  "bangkok",
];

export const SEARCH_ZONE_OPTIONS: VillaZoneOption[] = SEARCH_ZONE_VALUES.map(
  (value) => ({
    label: getZoneLabel(value),
    value,
  }),
);

export const SEARCH_FACETS = {
  maxPrice: SEARCH_MAX_PRICE,
  zones: SEARCH_ZONE_OPTIONS,
};
