# Home Rail Auto-Scroll Design

## Goal

Allow an administrator to enable or disable continuous auto-scroll independently for each homepage villa rail.

## Scope

- Persist one Boolean setting per `public.home_sections` row.
- Expose that setting in the existing admin group **วิธีเลือกและจำนวนบ้าน**.
- Pass the resolved setting through the existing home-section data flow to `VillaRail`.
- Auto-scroll only when enabled, pause for user interaction, and respect reduced-motion preferences.

## Recommended approach

Extend the existing horizontal `ScrollRail` behavior through `VillaRail` with a client-side `requestAnimationFrame` loop. It gives smooth, low-speed scrolling and reliable pause/resume control without introducing a carousel dependency.

## Data model and migration

Add `auto_scroll_enabled boolean not null default false` to `public.home_sections` in a source-controlled Supabase migration. The default preserves current production behavior for every existing rail.

The field is represented as `autoScrollEnabled` in TypeScript. It must be parsed defensively from database/API responses, validated as a Boolean in save payloads, and included in the existing snapshot-save RPC payload.

## Admin experience

Add a Boolean switch labelled **เลื่อนอัตโนมัติ** below the house-count setting in `SectionConfigForm`. Supporting copy states that the rail scrolls continuously and pauses while visitors interact with it. The switch changes only the selected rail draft and persists through the existing Save action.

## Public behavior

When `autoScrollEnabled` is true and the rail contains enough scrollable content:

- scroll horizontally at a slow continuous rate;
- pause during pointer hover, keyboard focus, pointer drag, touch interaction, and when the document is hidden;
- resume after interaction ends, without overriding the visitor's manual scroll position;
- do not auto-scroll when `prefers-reduced-motion: reduce` is enabled;
- avoid running work for rails outside the viewport and clean up animation/listeners on unmount.

When disabled, the rail remains exactly as it behaves today.

## Error handling and compatibility

Database or legacy responses that omit the new field resolve to `false`. The admin save API rejects malformed Boolean values using its existing structured validation errors. Public rendering must remain usable if client-side animation is unavailable.

## Tests and verification

- Unit tests for validation, normalization, response mapping, and persistence payloads of `autoScrollEnabled`.
- Component tests confirming the admin switch maps to the correct draft field and `VillaRail` passes the behavior to the scroll component.
- Browser verification at desktop and mobile widths for enabled and disabled rails, including hover/touch pause and reduced motion.
- Run targeted tests, `npm.cmd run lint`, and `npm.cmd run build` before completion.

## Documentation

Update `docs/ai/structure.html` to record the persisted per-rail auto-scroll setting and its client rendering behavior.
