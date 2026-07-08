# Revenue & Billing

Status: planned, builds second (see [ROADMAP.md](../ROADMAP.md)), after [Team & Permissions](permissions.md).

## Scope for this phase

Ship: invoice data model, manual CRUD, generate-from-contract, send-to-client via the existing token-based portal, manual "mark as paid," PDF export, dashboard revenue widgets, due-date payment reminders. **Payment gateway integration is explicitly deferred** to a separate follow-up phase — no Razorpay/Stripe, no webhooks, no "Pay Now" button in this build. Razorpay is the recommendation when that phase happens (currency is hardcoded INR/`en-IN` throughout the app; Razorpay fits UPI/netbanking better than Stripe for an India-based client base).

Also deferred: multi-currency (the `currency` column defaults `'INR'` now so it isn't a later breaking change), partial payments/installments, recurring/subscription auto-charging, GST/tax compliance fields, credit notes/refunds, auto-renewal-draft.

## Data model

`invoices` — `user_id` (workspace owner, via `workspaceUserId`), `client_id`, optional `project_id`/`contract_id`, `invoice_number` (app-generated, unique per `user_id`, not global — avoids leaking volume across workspaces), `status` (`draft|sent|paid|void`; `overdue` is derived from `due_date < today AND status != 'paid'`, not stored), `currency` (default `'INR'`), `cost_breakdown` (same JSON shape as proposals/contracts — reuses `buildCostTableHtml`), `total_amount`, `due_date`, `content`/`template_id` (frozen-template-snapshot pattern, same as contracts/proposals).

`invoice_access_tokens` — mirrors `proposal_access_tokens`/`contract_access_tokens` exactly (opaque token, optional password, expiry).

**Financial-visibility boundary** (per [permissions.md](permissions.md)'s confirmed real-DB-level decision): `total_amount`/`amount_paid` live in a companion `invoice_amounts` table, with its own RLS policy additionally requiring `team_members.can_view_financials = true`. A restricted team member can see that an invoice exists (client, status, dates) but the amount genuinely never leaves Postgres for their session.

## Edge functions

- **`client-portal`** — extended with `invoice` as a third `document_type`, same GET/PUT branching pattern as proposal/contract. View + PDF download only in this phase.
- **`send-notification-email`** — new `invoice_sent`/`invoice_overdue` types, same server-side ownership-resolution pattern as existing types (PRD §8), plus the viewer-send-block from Team & Permissions.
- **New `invoice-payment-reminders`** cron function — mirrors `contract-renewal-reminders`/`proposal-expiry-reminders`.

## Follow-up phase (not this build)

Pick Razorpay or Stripe, build `create-payment-link` + `payment-webhook` (signature-verified) edge functions, add an `invoice_payment_events` audit table, add "Pay Now" to the portal.

## Open items not yet decided

- Should invoice line items eventually need per-item tax codes (GST)?
- Should manually-marked-paid invoices be visually distinguished from (future) gateway-confirmed ones?
