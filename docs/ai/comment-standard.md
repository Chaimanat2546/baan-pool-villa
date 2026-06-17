# Comment Standard

This document defines the comment standard for the Baan Pool Villa repository.
Use it to keep comments helpful, compact, and consistent across Next.js, React,
TypeScript, route handlers, shared helpers, and admin code.

## Goal

Comments should help the next reader understand:

- why the code exists
- why it is implemented this way
- what constraint, fallback, or trade-off must be preserved

Comments should not repeat what a clear function name, variable name, type, or
small code block already says.

## Core Rules

1. Write self-explanatory code first.
   Rename unclear variables, split large functions, and extract helpers before
   adding comments.

2. Prefer explaining `why` over `what`.
   Good comments capture reasoning, constraints, request-budget decisions,
   upstream API quirks, cache behavior, auth boundaries, and non-obvious UX
   choices.

3. Keep comments short and specific.
   Prefer 1-2 lines. Use longer comments only when documenting a shared
   contract or a multi-step constraint that would otherwise be easy to break.

4. Do not narrate obvious code.
   Avoid comments that simply restate the next line or restate a clear function
   name.

5. Keep comments true after edits.
   If behavior changes, update or delete the comment in the same change.

6. Use JSDoc selectively.
   Add JSDoc to shared helpers, public utility functions, route-facing helpers,
   and other exported functions whose contract matters to multiple callers.
   When a function is reused across modules or has validation/business rules,
   prefer fuller JSDoc that explains the contract and documents parameters and
   return values. Skip JSDoc for small local helpers unless the contract is
   non-obvious.

7. Prefer comments at the narrowest useful scope.
   Put the comment directly above the function, guard, fallback, transform, or
   block it explains.

8. Do not use comments as a substitute for deleted or stale code.
   Remove commented-out code instead of leaving it in place, unless the user
   explicitly asks to keep it for comparison.

## When Comments Are Expected

Comments are usually worth adding in these cases:

- shared normalization or validation helpers in `lib/`
- cache and revalidation behavior
- request-budget and performance trade-offs
- defensive handling of incomplete or inconsistent upstream data
- auth and authorization boundaries
- route handler input validation and allowlist decisions
- non-obvious UI fallback behavior
- temporary workarounds with a clear reason and removal condition

## When Comments Are Usually Unnecessary

Comments are usually not needed for:

- simple JSX rendering
- straightforward variable assignments
- obvious loops, filters, maps, and conditionals
- code whose function and variable names already explain the behavior
- tiny local helpers that are clearer than their explanation would be

## Preferred Formats

### 1. Short block comment for reasoning

Use for local constraints or non-obvious decisions.

```ts
// Keep gallery loading off the critical render path so the detail page can
// show core content before the full image set is requested.
```

### 2. JSDoc for shared contracts

Use for exported helpers or functions reused across route, component, and data
layers.

```ts
/**
 * Normalizes raw villa API data into the stable shape used by public pages and
 * route handlers.
 */
export function normalizeVillaSummary(raw: RawVillaSummary): VillaSummary {
  // ...
}
```

When the function contract matters, a fuller JSDoc style is preferred:

```ts
/**
 * Checks whether an image URL belongs to the villa's resolved image set.
 *
 * @param imageUrl - The normalized image URL to verify.
 * @param images - The resolved villa images allowed for this villa.
 * @returns `true` when the URL matches one of the villa's known images.
 */
```

### 3. Guard or fallback comment

Use when the fallback behavior is a product or stability decision.

```ts
// Treat missing gallery rows as optional data so villa detail rendering does
// not fail when Supabase image content is incomplete.
if (!rows.length) {
  return [];
}
```

## Repo-Specific Guidance

### `lib/`

- Favor JSDoc on exported normalization, validation, pricing, cache, SEO, and
  route-support helpers.
- Add short comments near non-obvious transforms, fallback rules, and source of
  truth constraints.

### `app/.../route.ts`

- Comment only the parts that explain allowlists, validation, cache policy, or
  why a response is intentionally strict or intentionally tolerant.

### `components/`

- Keep comments rare.
- Add them only for UI behavior that would be surprising without context, such
  as deferred fetching, hydration-safe fallbacks, or accessibility workarounds.

### `components/admin/`

- Comment data-shaping helpers, preview mapping, upload lifecycle behavior, and
  auth or persistence edge cases.
- Do not comment ordinary form fields or straightforward local state updates.

## Examples

### Good

```ts
/**
 * Resolves public site settings with safe defaults so route metadata and UI
 * can render even when CMS reads fail.
 */
export async function getResolvedSiteSettings() {
  // ...
}
```

```ts
// Reuse the shared cache policy here so the page route and JSON endpoint stay
// aligned on the same public request budget.
const cachePolicy = getVillaListingCachePolicy();
```

```ts
// Reject unknown transform values early to keep this proxy limited to the
// image sizes we are prepared to cache at the edge.
if (!ALLOWED_WIDTHS.has(width)) {
  return badRequest("Unsupported width");
}
```

### Avoid

```ts
// Fetch villa data
const villa = await fetchVillaData(id);
```

```ts
// Loop through the images
for (const image of images) {
  // ...
}
```

```ts
// Set loading to true
setLoading(true);
```

## Review Checklist

Before keeping a comment, ask:

1. Would a better name or smaller helper remove the need for this comment?
2. Does this comment explain reasoning, constraints, or a non-obvious choice?
3. Is this still true after the current code change?
4. Is the comment placed at the narrowest useful scope?
5. Would removing this comment make the code meaningfully harder to maintain?

If the answer to `2` or `5` is no, delete the comment.
