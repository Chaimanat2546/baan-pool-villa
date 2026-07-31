# Manual rail house ordering

## Goal

Allow an admin to set the display order of houses in a homepage Villas rail
that uses the `manual` selection mode. The homepage must display that saved
order.

## Scope

- Keep the existing **บ้านพักในชุดนี้** selector, its selected-house chips,
  search, selection, and removal behavior unchanged.
- Add a **เรียงบ้าน** button beside that selector only for a `manual` rail
  that contains at least one selected house.
- The button opens a modal modelled on the card-image ordering dialog. It
  displays the selected houses in their current order, each with its ordinal
  number and left/right movement buttons.
- The first house cannot move left and the last house cannot move right.
- **ยกเลิก** closes the modal without applying its order. **เสร็จสิ้น**
  applies the modal order to the page draft. The existing page-level
  **บันทึก** action persists it.
- `near_sea` and `slice` rails do not render the ordering button or modal.

## Data flow

`AdminSectionsPage` remains the owner of the draft. The ordering dialog works
with the selected house-id sequence and, on confirmation, calls the existing
manual-selection update path with that sequence. The current save normalizer
assigns `position` from the item order, and the existing API, RPC, and homepage
resolver already persist and render manual items by `position`; no migration or
API contract change is needed.

## Accessibility and errors

Movement controls have Thai accessible names, are disabled at their respective
boundaries, and use normal buttons so keyboard users can make the same change.
The dialog continues to use the existing admin save/error flow; ordering itself
cannot introduce an invalid house id or duplicate a selected id.

## Tests and verification

- Component tests cover opening the dialog, left/right boundary controls,
  confirmation applying the new chip order, and cancellation preserving the
  original order.
- Page tests cover that a saved Manual rail sends the reordered ids and that
  automatic rails do not expose ordering controls.
- Existing resolver tests continue to assert manual items are rendered by
  `position`.
- Verify `/admin/sections` at desktop and mobile widths, then run focused
  component tests, lint, build, and the relevant home-section tests.
