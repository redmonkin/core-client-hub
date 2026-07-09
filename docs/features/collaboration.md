# Collaboration & Client Experience

Status: shipped (drawn signature capture, append-only comments). Built third, after [Team & Permissions](permissions.md) and [Revenue & Billing](billing.md), per [ROADMAP.md](../ROADMAP.md).

## 1. E-signature capture

Augments the typed-name-only `contracts.client_signature` with a drawn signature via `react-signature-canvas`, captured in `ClientPortal.tsx`'s approve dialog and stored as a PNG in a private `signatures` Storage bucket (folder-per-owner RLS, same pattern as `contract-files`).

**Typed name stays required alongside the drawn signature** (confirmed decision) — the drawn signature is optional; approving without drawing still records the typed name as before.

The unauthenticated client-portal visitor has no Supabase session, so the signature image upload goes through `client-portal`'s `POST` handler's `approve` action (service-role client) as a base64 `signature_image` data URL, capped at ~1MB decoded, decode/upload wrapped in its own try/catch so a malformed image never fails the approve action itself.

New columns: `contracts.client_signature_image_url` (stores a Storage **path**, not a URL — a fresh signed URL is generated on every read, both server-side in `client-portal`'s GET/PUT responses and client-side in `ContractDetail.tsx` via `supabase.storage.from('signatures').createSignedUrl()`) and `client_signature_captured_at`. `replacePlaceholders()` in `proposal-utils.ts` renders `{{clientSignature}}` as an `<img>` when `clientSignatureImageUrl` is present (attribute-escaped), falling back to the existing cursive-text typed-name rendering otherwise.

## 2. Client comments

A single `document_comments` table (`document_type IN ('proposal','contract','invoice')`, polymorphic `document_id`) rather than per-type tables.

**Append-only** (confirmed decision) — no edit/delete, matching `proposal_status_history`/`contract_status_history`; no `UPDATE`/`DELETE` RLS policy exists at all.

RLS: owner/team-member `SELECT`/`INSERT` via `get_accessible_user_ids()`, INSERT additionally requires `get_workspace_role(...) IN ('owner','admin','editor')` (viewer-blocked). **No RLS policy allows anonymous inserts** — client comments go through `client-portal`'s `POST` handler's new `comment` action (service-role client, works for all three document types including invoices, which have no approve/reject flow). The document being commented on is always resolved from the **token**, never a client-supplied ID.

Rendered as plain text via React (never `dangerouslySetInnerHTML`) on both the owner side (`CommentThread.tsx`, used in `ProposalDetail.tsx`/`ContractDetail.tsx`) and the portal side (`ClientPortal.tsx`'s `renderCommentsSection`).

Shipped: `notification_preferences.comment_added` toggle (in-app notification only, matching the existing `proposal_viewed` precedent — no separate email type). Comment-count indicators on list views were **not** built (deferred, see open items).

## Not shipped in this pass (scoped out)

- Comments UI on `Invoices.tsx` — invoices use a list+dialog page rather than a dedicated detail page (see [billing.md](billing.md)'s simplification note), so there's no natural place for an inline comment thread yet. The `client-portal` API already supports posting/viewing invoice comments end-to-end; only the owner-side UI surface is missing.
- Comment-count indicators on list views.

## Explicitly out of scope for this build

Global cross-entity search and notification digest mode were mentioned alongside this area but are independent, lower-effort items — not designed here, can land anytime without dependency on the above.

## Open items not yet decided

- Should the owner's own contract signature (`mySignature`) also become drawn, for parity?
- Should clients be required to type a name before posting a comment? (Currently optional — falls back to the client's name on record.)
- Worth building unread-comment indicators / invoice comment UI now, or defer further?
