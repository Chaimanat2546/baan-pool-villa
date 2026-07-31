# Manual rail sortable-list UI

## Goal

Make the **เรียงลำดับบ้าน** dialog compact and familiar to admins. The current tall card layout wastes vertical space and separates the arrow controls from the house information.

## Approved design

Each selected villa is one sortable-list row, about 72 pixels high:

`#1  drag handle  cover  villa name · house ID  [previous] [next]`

- Show a rank badge, a 56 by 56 pixel cover image, the existing drag handle, villa name, and house ID in one horizontal row.
- Keep native HTML drag-and-drop; dragging any part of the row continues to work.
- Keep previous/next controls as a compact paired group aligned to the right, so keyboard and touch users retain a non-drag option.
- The first previous and last next buttons remain disabled.
- On narrow screens, preserve the single-row layout: house text truncates safely and the buttons remain at the right with an accessible touch target.
- Preserve the current cover-image and empty-image fallback behaviour, modal focus trapping, cancel, and confirm behaviour.

## Direction and house-id refinement

- Display the identifier as `DV-{id}`; for example, house `9` renders as `DV-9`.
- Replace the horizontal previous/next arrows with vertically oriented move-up and move-down arrows.
- Use Thai accessible labels **เลื่อนขึ้น** and **เลื่อนลง**. The first move-up and last move-down buttons remain disabled.

## Scope and verification

Only the presentation of `ManualHouseOrderDialog` changes. No API, selection, ordering payload, database, or public rail behaviour changes.

Update the focused component test if class/structure assertions need adjustment. Verify the dialog visually at desktop and mobile widths, then run the relevant component tests, lint, and production build.
