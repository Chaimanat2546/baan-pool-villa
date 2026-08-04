# Scroll Rail Hover Pause Design

## Outcome

Pause homepage rail auto-scroll while a pointer hovers over a rail, then resume it four seconds after the pointer leaves.

## Scope

- Change only the shared client-side `ScrollRail` behavior when `autoScroll` is enabled.
- On mouse enter, call the Auto Scroll plugin `stop()` method.
- On mouse leave, call the plugin `play(4_000)` method.
- Preserve the existing four-second resume behavior after manual arrow controls and drag release.
- Preserve static rails, touch behavior, reduced-motion behavior, and existing nested-gallery drag protection.

## Implementation Ownership

`components/ui/scroll-rail.tsx` owns Embla plugin controls. The existing restart callback will be reused for mouse leave so one four-second resume policy applies to arrows, drag release, and hover exit. The Embla viewport receives mouse handlers only when auto-scroll is enabled.

## Verification

Add a focused jsdom regression test that renders an auto-scrolling rail, dispatches mouse enter and mouse leave on the rail viewport, and asserts one `stop()` call followed by `play(4_000)`. Run the focused rail tests, lint, production build, and render the homepage rail on desktop and mobile to verify that hover pauses desktop only without affecting touch scrolling.

