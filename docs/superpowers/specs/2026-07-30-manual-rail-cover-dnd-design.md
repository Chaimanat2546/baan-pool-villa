# Manual rail cover images and drag ordering

The Manual-house ordering dialog will render a cover-image card for each selected house. The existing authenticated homes endpoint returns each house's title and resolved cover URL, preferring the custom Card Images cover and falling back to the legacy listing cover; an absent URL renders a neutral placeholder.

The dialog keeps its existing Thai labels, focus behavior, confirmation, cancel action, and left/right movement buttons. It adds native HTML Drag & Drop: dragging a card over another immediately moves the dragged id into that target position, and drag end clears transient drag state. No dependency or database/API mutation contract is added.

Tests cover custom-over-legacy resolution, legacy fallback, absent-image placeholder, drag reordering, retained arrow behavior, and existing Manual-only scope. The admin homes response remains authenticated and only returns the minimal display fields needed by the dialog.
