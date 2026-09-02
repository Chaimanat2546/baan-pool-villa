# Detail Layout Unified Drag and Drop

## Goal

Replace the native HTML drag-and-drop behavior in `/admin/detail-layout` with one accessible `@dnd-kit` interaction model. Administrators can reorder rows, move existing blocks between compatible Canvas slots, and drag new block types from the Block Library; clicking a library block remains supported.

## Architecture

`AdminDetailLayoutPage` will provide one DnD boundary around the Block Library and `LayoutCanvas`. A single `SortableContext` owns all Canvas drag IDs so its interaction feels continuous. IDs encode their role and location: wide and narrow rows, wide slots, narrow slots, existing blocks, and library block types.

The drag-end router parses only those internal ID forms. It delegates mutations to the existing `moveDetailLayoutV2*` and `putDetailLayoutV2*` helpers through the existing page callbacks; it does not mutate saved settings directly. Invalid source/target combinations are ignored.

## Interaction

- Rows and existing blocks have 44px drag handles with `touchAction: none`.
- Mouse, Touch, and Keyboard sensors use activation constraints and `sortableKeyboardCoordinates`.
- The library produces a copy operation; a dropped block is inserted into the compatible selected slot, while its existing click-to-add path remains unchanged.
- Drop slots receive a visible valid-target state only for compatible sources.
- Screen-reader announcements describe drag start, moving over a target, drop, and cancellation in Thai.
- The page remains draft-first: its existing Save action runs validation and persists the whole layout.

## Error Handling

Unrecognized IDs, missing targets, disabled rows, occupied/incompatible slots, and no-op drops leave the draft unchanged. The existing validation and error-localization flow remains the final authority before the page save.

## Tests

- Unit tests for ID parsing and source/target routing.
- Canvas tests for wide/narrow row reordering, block moves within and across zones, and library copy drops.
- Accessibility assertions for the handles, touch-action behavior, keyboard sensor configuration, and announcements.
- Existing detail-layout helper and page-save tests remain required.
