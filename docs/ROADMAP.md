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

## To do: hosted instance and operations

Not features, but needed before the hosted instance (clientra.redmonk.in) grows. Status as of 2026-10-06.

- [ ] **Privacy policy and terms of service.** `/privacy` and `/terms` pages, linked from the footer and the sign-up form. Needed for India's DPDP Act 2023 (and GDPR for EU users). Draft, then have a lawyer review. Self-hosters should be able to point the links at their own documents (e.g. `VITE_PRIVACY_URL` / `VITE_TERMS_URL`).
- [ ] **Database backups.** The Supabase free plan has none. Move to Pro (daily backups, no pausing) or run `npx supabase db dump` on a schedule to private storage. Don't use GitHub Actions artifacts: on a public repository they can be downloaded by others.
- [ ] **Uptime and error monitoring.** A free uptime monitor (e.g. UptimeRobot) on the home page and one edge function; error tracking (e.g. Sentry) later, which needs a CSP update.
- [ ] **Branded auth emails.** Customise Supabase's sign-up confirmation and password-reset templates (Authentication → Emails → Templates) to match Clientra.
- [ ] **Free-plan pausing.** Supabase pauses free projects after about a week without activity; another reason to move to Pro.
- [ ] **Auth email delivery.** Confirm custom SMTP through Resend is on for the live project (Authentication → Emails → SMTP Settings); see [the guide](self-hosting.md#42-send-account-email-through-resend).
- [ ] **CAPTCHA.** Create a Cloudflare Turnstile widget, set `VITE_TURNSTILE_SITE_KEY` on Vercel and redeploy, then enable CAPTCHA in Supabase Auth, in that order ([guide](self-hosting.md#45-optional-captcha-against-bot-sign-ups)).
- [ ] **Remove the unused `LOVABLE_API_KEY`** edge function secret.

## Cross-area dependencies

- **F → A**: invoice RLS write policies and financial-figure access are built with F's `get_workspace_role`/`can_view_financials` from the start.
- **F → D**: comment-write RLS includes the viewer-block from the start.
- **A → D**: comments' `document_type` includes `'invoice'` from the start.

Each area is still independently shippable and testable — these are one-line additions, not hard blockers.
