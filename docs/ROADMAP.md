# Clientra Roadmap

Status: as of 2026-07-08. Approved build order — **F → A → D**. Nothing below is a permanent commitment; revisit if priorities shift.

1. **[Team & Permissions](features/permissions.md)** — role-based access (`admin`/`editor`/`viewer`) beyond today's all-or-nothing team model, plus a separate financial-visibility tier.
2. **[Revenue & Billing](features/billing.md)** — invoicing (manual CRUD + client-portal viewing first; payment gateway deferred to a follow-up phase).
3. **[Collaboration & Client Experience](features/collaboration.md)** — drawn e-signature capture, client-facing comments on proposals/contracts.

## Why this order

Team & Permissions ships first so its role model and financial-visibility tier exist before Billing is built — invoicing's RLS and financial-figure display are designed against that model from day one instead of needing a retrofit. Collaboration ships last since its comment feature extends naturally to whatever document types (proposal/contract/invoice) already exist.

## Deferred / not designed in depth

- Payment gateway integration (Razorpay/Stripe), webhooks, "Pay Now" in the client portal — separate follow-up phase after Billing's invoice CRUD ships.
- Per-resource ACLs (e.g. restricting a team member to specific clients) — role is table-scoped, not row-scoped; per-resource ACLs would need a much bigger architectural change with no signal they're actually needed.
- Multi-currency, partial payments/installments, GST/tax compliance fields, credit notes/refunds, recurring auto-charging, auto-renewal-draft.
- Global cross-entity search, notification digest mode — independent, low-effort additions that can land anytime; not part of this roadmap's three areas.

## Cross-area dependencies

- **F → A**: invoice RLS write policies and financial-figure access are built with F's `get_workspace_role`/`can_view_financials` from the start.
- **F → D**: comment-write RLS includes the viewer-block from the start.
- **A → D**: comments' `document_type` includes `'invoice'` from the start.

Each area is still independently shippable and testable — these are one-line additions, not hard blockers.
