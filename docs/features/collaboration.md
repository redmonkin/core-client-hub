# Collaboration & Client Experience

Status: planned, builds third (see [ROADMAP.md](../ROADMAP.md)), after [Team & Permissions](permissions.md) and [Revenue & Billing](billing.md).

## 1. E-signature capture

Replaces (well — augments) the typed-name-only `contracts.client_signature` with a drawn signature via `react-signature-canvas` (new dependency), stored as a PNG in a new private `signatures` Storage bucket (folder-per-user RLS, same pattern as the existing `contract-files` bucket).

**Typed name stays required alongside the drawn signature** (confirmed decision) — used for the fallback text rendering on historical contracts that only have a typed name, and as a searchable/auditable field.

The unauthenticated client-portal visitor has no Supabase session, so the signature image upload goes through `client-portal`'s existing `POST` handler (service-role client), not a direct client-side Storage upload.

New columns: `contracts.client_signature_image_url`, `contracts.client_signature_captured_at` (additive, non-breaking). `replacePlaceholders()` in `proposal-utils.ts` renders `{{clientSignature}}` as an image when present, falling back to the existing cursive-text typed-name rendering otherwise.

## 2. Client comments

A single `document_comments` table (`document_type IN ('proposal','contract','invoice')`, polymorphic `document_id`) rather than per-type tables — comments are identical in shape across document types, so one table avoids tripling the maintenance cost.

**Append-only** (confirmed decision) — no edit/delete, matching the existing audit-trail-style history tables (`proposal_status_history`/`contract_status_history`) and keeping RLS simple (no `UPDATE`/`DELETE` policy needed).

RLS: owner/team-member `SELECT`/`INSERT` via the standard `get_accessible_user_ids()` check, with the Team & Permissions viewer-block (`get_workspace_role(...) != 'viewer'`) on insert. **No RLS policy allows client-side anonymous inserts** — client comments go through `client-portal`'s `POST` handler (service-role client), same as approve/reject/request-changes, so the token-resolution/password-gate logic isn't duplicated or bypassable. The document being commented on is always resolved from the **token**, never a client-supplied ID.

Rendered as plain text (not `dangerouslySetInnerHTML`, even sanitized) — comments are user-authored text from an unauthenticated source with no legitimate need for markup, so the simplest safe choice is to never treat them as HTML at all.

New `notification_preferences.comment_added` toggle; new `send-notification-email` `comment_added` type.

## Explicitly out of scope for this build

Global cross-entity search and notification digest mode were mentioned alongside this area but are independent, lower-effort items — not designed here, can land anytime without dependency on the above.

## Open items not yet decided

- Should the owner's own contract signature (`mySignature`) also become drawn, for parity?
- Should clients be required to type a name before posting a comment?
- Worth building unread-comment indicators now, or defer?
