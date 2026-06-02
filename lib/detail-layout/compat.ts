import type {
  AnyDetailLayoutConfig,
  AnyDetailLayoutValidationResult,
} from "./types";
import {
  cloneDetailLayout,
  validateDetailLayout,
} from "./validation";
import {
  cloneDetailLayoutV2,
  validateDetailLayoutV2,
} from "./version-2";

export function normalizeAnyDetailLayout(
  value: unknown,
): AnyDetailLayoutConfig {
  const result = validateAnyDetailLayout(value);

  return cloneAnyDetailLayout(result.layout);
}

export function validateAnyDetailLayout(
  value: unknown,
): AnyDetailLayoutValidationResult {
  if (isRecord(value) && value.version === 2) {
    const result = validateDetailLayoutV2(value);

    return {
      ok: result.ok,
      errors: result.errors,
      layout: result.ok
        ? result.layout
        : cloneDetailLayoutV2(result.layout),
    };
  }

  const result = validateDetailLayout(value);

  return {
    ok: result.ok,
    errors: result.errors,
    layout: result.layout,
  };
}

function cloneAnyDetailLayout(
  layout: AnyDetailLayoutConfig,
): AnyDetailLayoutConfig {
  return layout.version === 2
    ? cloneDetailLayoutV2(layout)
    : cloneDetailLayout(layout);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
