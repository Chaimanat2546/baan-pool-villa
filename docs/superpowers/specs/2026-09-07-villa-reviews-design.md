# Villa Reviews Design

**Status:** Approved design awaiting implementation-plan review

## Goal

Add immediately public, villa-specific customer reviews. A customer submits one 1–5-star review per booking code, with an optional comment and up to five images. The MVP stores the user-entered booking code but does not yet verify it against a booking system.

## Product Decisions

- Reviews appear on each villa detail page, after the main villa details and before contact actions.
- The review module follows the Google Maps pattern: average score, count, 5-to-1 star breakdown, review list, review images, sorting, and incremental loading.
- Show five newest reviews first. The user can choose newest (default), highest rating, or lowest rating, then load more with a button.
- Reviews publish immediately after a successful submission.
- The public identity is only a masked phone number in the form `xxx-xxxx-9854`; no name is collected or displayed.
- The form is a two-step modal: (1) booking code and phone number, (2) rating, optional comment, optional images, review, and submit.
- Thai phone input accepts `0812345678` and `+66812345678`.
- Comments are optional and limited to 1,000 characters.
- A review accepts at most five images. Each individual image must be JPG, PNG, or WebP and at most 5 MB. This is a per-file limit, not a 5 MB combined limit; five accepted images may total about 25 MB.
- A booking code is initially free-form because no booking-code format exists. It must nevertheless be globally unique: one booking code can create one review only.
- The same phone number may review multiple stays when each uses a distinct booking code.
- Time is shown publicly in relative form, such as “2 วันที่แล้ว”.
- Customers cannot edit reviews. Future admin tools may edit or delete reviews but are not included in this delivery.
- There is no CAPTCHA. The server rate-limits successful submissions to five per hour per IP; validation failures do not consume the quota.
- The review comment is rejected, not censored and saved, when `bad-words-thai` detects inappropriate Thai or English text. The response identifies the detected words for correction.

## Data Model and Privacy Boundary

Use a private source table for the full review record and a public database view as the sole read contract for public consumers.

### Private source records

- `villa_reviews` stores the review ID, villa ID, unique booking code, full normalized phone number, rating, optional comment, timestamps, and review state required by future administration.
- `villa_review_images` stores review ownership, object-storage path, public image URL or safe derived URL, MIME type, byte size, and deterministic display order.
- `villa_review_edit_logs` stores review ID, before and after snapshots, and timestamps. It supports a future admin editor and preserves the original customer post.

The database constrains the booking code to a unique value. The server/RPC uses the constraint as the final authority so concurrent requests cannot consume one code twice.

### Public view

`villa_reviews_public` exposes only the review ID, villa ID, rating, comment, created/updated times, masked phone number, and safe image metadata/URLs. It must never select or derive an unmasked phone number or booking code.

Anonymous browser access has no direct `SELECT` privilege on the private source tables. Public APIs and page helpers use the view only. Database functions that create the private records validate their inputs and return only the safe public projection.

## Submission Flow

1. The detail-page client modal locally validates the two form steps and retains its draft on failure.
2. `POST` receives multipart form data through a public Route Handler.
3. The server applies the IP rate limit, parses the payload, then validates phone number, rating, comment length, individual image count/type/extension/size, and prohibited terms. It does not trust browser validation.
4. The server reserves/inserts the review using the database’s unique booking-code constraint. A duplicate returns `409 Conflict` with the Thai duplicate-code message.
5. The server uploads only accepted images to review-specific object-storage paths, creates image records, and performs conservative best-effort cleanup if a later storage or database operation fails.
6. On success, the endpoint invalidates only that villa’s review cache tag and returns the safe public review contract. The open page prepends or otherwise reconciles the returned review so the submitter sees it immediately.
7. Later public readers receive fresh data through the invalidated villa-review cache; no broad route/path invalidation is used.

The storage bucket/policies allow server-controlled writes only. Public reads may expose only assets referenced by a public review; client-side direct upload is out of scope.

## Public Read Flow

- The villa detail page obtains review summary and the first five items from the public view through a focused review data helper.
- A public review endpoint supports one villa ID, the selected sort, and an opaque cursor. It returns safe rows plus a next cursor.
- Public summary/list responses use a dedicated, per-villa cache tag. Submission invalidation targets that tag only.
- No public review response may include booking code, full phone, raw storage administration data, or edit-log data.

## UI and Failure Behavior

- The detail review section uses existing site theme variables and retains mobile/desktop readability.
- The modal is keyboard accessible, labels all inputs, moves focus appropriately, and provides loading, success, and error feedback.
- A failed field is identified beside that field. Unsupported extension/MIME, files over 5 MB individually, and a sixth selected image fail before submission when possible and always fail server-side.
- The modal keeps the customer’s entered draft when validation or transport errors occur.
- Prohibited-language results are not persisted. The error names the detected terms without returning any private values.
- Upload failure does not publish a partially created review as successful. Cleanup is conservative and observable for future operations.

## Out of Scope

- Verifying booking code, villa ownership, guest identity, or completed-stay status.
- Customer review edits or deletion.
- Admin review-management UI.
- CAPTCHA and image-content moderation.
- Changing the existing homepage `customer_review_images` gallery, which remains independent from villa reviews.

## Verification Requirements

- Focused unit tests for Thai phone normalization/masking, review validation, comment length, profanity rejection, the 5-per-review and 5-MB-per-file rules, safe public projection, cursor pagination, sorting, relative time, duplicate booking-code behavior, upload cleanup, and rate limiting.
- Route-handler tests prove malformed requests and private fields never reach a public response.
- Migration tests or contract tests cover constraints, the public view, permissions, and supporting indexes.
- Component tests cover summary states, empty/loading/error states, modal navigation, draft preservation, and pagination.
- Render a real detail page at mobile and desktop widths, including long comments and image fallback states.
- Run targeted tests, `npm.cmd run lint`, and `npm.cmd run build` before marking implementation complete.

## Deferred Assumptions

- Free-form booking codes are treated as submitted text until a future booking system defines canonical validation and matches codes to a villa/customer.
- Future admin mutations create `villa_review_edit_logs` records and trigger the same narrow villa-review cache invalidation.
- The exact visual styling of the two-step modal is validated through implementation/browser review rather than further specification.
