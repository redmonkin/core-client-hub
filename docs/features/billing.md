# Revenue & Billing

Status: shipped (invoice CRUD, portal viewing, send-to-client, payment recording). Built second, after [Team & Permissions](permissions.md), per [ROADMAP.md](../ROADMAP.md).

## Scope shipped

Invoice data model, manual CRUD (`src/pages/Invoices.tsx`), "Generate Invoice" from a contract (`ContractDetail.tsx` → `/invoices?contractId=...` prefill), send-to-client via the existing token-based portal (`ClientPortal.tsx` renders a dedicated invoice view — view + PDF download, no approve/reject), manual "mark as paid," PDF export (`exportToPdf`). **Payment gateway integration is explicitly deferred** to a separate follow-up phase — no Razorpay/Stripe, no webhooks, no "Pay Now" button. Razorpay remains the recommendation for that phase (currency is hardcoded INR/`en-IN` throughout the app).

**2026-07-11 update**: added an atomic `record_invoice_payment()` RPC (full + `partial` payments, keeps `status`/`amount_paid` in sync — previously "Mark as Paid" flipped status without writing `amount_paid`, so paid invoices still showed a full balance due on PDF/portal), a real Void action, overdue-aware "Send" (picks the Payment Reminder email variant over "New Invoice"), an in-app preview modal, invoice-number collision validation in Settings, and manual "Generate Next Invoice" + billing history on AMC/retainer contracts.

**Not shipped in this pass** (scoped out, not yet built): revenue dashboard widgets, `invoice-payment-reminders` cron function, `notification_preferences` toggles for invoice events. Also deferred as originally planned: multi-currency, installments, recurring/subscription auto-charging, GST/tax compliance fields, credit notes/refunds.

**Simplification from the original plan**: invoices do NOT use the TipTap template/frozen-content-snapshot system that proposals/contracts use (no `content`/`template_id` columns). Invoices render from a fixed structured layout (client info, line items table via the shared `CostBreakdownTable`/`buildCostTableHtml`, total, due date, notes) — this was judged unnecessary scope for invoices, which don't need free-form document editing.

## Data model

`invoices` — `user_id` (workspace owner, via `workspaceUserId`), `client_id`, optional `project_id`/`contract_id`, `invoice_number` (app-generated `<prefix><padded-seq>`, derived from an atomically-incremented `invoice_settings.next_invoice_number` counter inside `create_invoice()` — the atomic increment is what prevents concurrent-creation collisions, not a retry), `status` (`draft|sent|partial|paid|void`; "overdue" is derived client-side from `due_date < today AND status IN ('sent','partial')`, not stored), `currency` (default `'INR'`), `cost_breakdown` (same JSON shape as proposals/contracts — reuses `buildCostTableHtml`/`getCostBreakdownTotal`), `due_date`, `issued_date`, `paid_at`, `payment_provider`/`payment_reference` (unused until the payment-gateway follow-up, present now to avoid a later migration).

`invoice_access_tokens` — mirrors `proposal_access_tokens`/`contract_access_tokens` exactly (opaque token, optional password, expiry).

**Financial-visibility boundary** (per [permissions.md](permissions.md)'s confirmed real-DB-level decision): `total_amount`/`amount_paid` live in a companion `invoice_amounts` table, with its own RLS policy additionally requiring `can_view_financials(auth.uid(), invoices.user_id)`. A restricted team member can see that an invoice exists (client, status, dates) but the amount genuinely never leaves Postgres for their session — `Invoices.tsx` fetches `invoice_amounts` as a separate query and simply gets fewer rows back, not a masked value.

## Edge functions

- **`client-portal`** — extended with `invoice` as a third `document_type` on both GET and PUT (password-verify) branches, following the existing proposal/contract token-resolution pattern (token always resolves the invoice server-side; never trusts a client-supplied ID). View + PDF only — no POST/approve-reject branch for invoices.
- **`send-notification-email`** — new `invoice_sent`/`invoice_overdue` types. Recipient email/name resolved server-side from the invoice's `client_id` (never trusted from the request body), and the existing viewer-role send-block (from Team & Permissions) applies.

## Follow-up phase (not this build)

Pick Razorpay or Stripe, build `create-payment-link` + `payment-webhook` (signature-verified) edge functions, add an `invoice_payment_events` audit table, add "Pay Now" to the portal. Also: dashboard revenue widgets and `invoice-payment-reminders` cron, deferred above.

**2026-07-12 update**: the two existing reminder crons (`contract-renewal-reminders`, `proposal-expiry-reminders`) had been silently 401ing since they were first scheduled — the migrations hardcoded an anon-role JWT as the bearer token, which never matches the functions' service-role check, so both were unscheduled entirely on 2026-04-27 rather than fixed. Migration `20260712100000_fix_reminder_cron_auth.sql` re-schedules both, sourcing the bearer token from Supabase Vault (`service_role_key` secret) at run time instead of a hardcoded key — verified via direct invocation returning 200s. This unblocks building `invoice-payment-reminders` on the same (now-correct) pattern whenever that's prioritized.

## Open items not yet decided

- Should invoice line items eventually need per-item tax codes (GST)?
- Should manually-marked-paid invoices be visually distinguished from (future) gateway-confirmed ones?
