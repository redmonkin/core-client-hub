# Changelog

All notable changes to Clientra are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). Versions aren't published as GitHub releases; `main` is always the latest.

When you update a self-hosted copy, read the **Upgrade notes** of every version since yours: they list new migrations, secrets and settings. The steps are in [Updating to a new version](docs/self-hosting.md#updating-to-a-new-version).

## Unreleased

## 0.1.0 - 2026-10-06

The first public version.

### Features

- **Clients and projects**: contacts, notes, attachments, tasks and history per client, with a per-client account ledger.
- **Proposals and templates**: reusable rich-text templates with scope and pricing; PDF and Word export.
- **Contracts**: online e-signatures, status history and renewal reminders.
- **Invoices and accounts**: invoice line items from a catalogue, recurring invoices (emailed with the PDF attached), payments with TDS and bank charges, expenses and recurring expenses tagged to projects, financial-year overviews, and an automatic payment reminder 3 days before an invoice is due. Amounts are in ₹.
- **Tasks and timesheets**: hours per project, with CSV and Excel import and export.
- **Client portal**: proposals, contracts and invoices shared through password-protected, expiring links; clients approve, request changes, sign and comment without an account.
- **Team workspaces**: invite teammates with roles and per-module permissions, including who can see financial figures.
- **Public portfolio**: featured projects on a public page with a "start a project" form that creates leads.
- **Notifications**: in-app and email alerts when clients view or respond.
- **Data export**: workspace owners can download every record as Excel or JSON from Settings.

### Security

- Workspace isolation enforced in the database with row-level security, including cross-workspace reference checks.
- Team invitations can only be accepted by the invitee.
- Hardened client-portal passwords and access tokens; rate-limited portfolio enquiries.
- Email functions take recipients from the database, allow only app links, cap CC lists, accept only PDF attachments and enforce a daily quota.
- New passwords must be at least 10 characters with upper- and lowercase letters and a number, and are checked against known breaches (k-anonymity); changing a password requires the current one.
- Optional Cloudflare Turnstile CAPTCHA on sign-in, sign-up and password reset.
- Free-plan sign-up and team-size limits, counted only for confirmed accounts.
- Strict Content Security Policy and security headers; fonts are bundled with the app instead of loaded from Google Fonts.
- Account deletion removes all of a user's data and files.

### Open source and self-hosting

- Licensed under AGPL-3.0, with contributing guidelines, a code of conduct and a security policy.
- Step-by-step [self-hosting guide](docs/self-hosting.md) for Supabase, Resend and any static host.
- Landing page pre-rendered for search engines and AI assistants, with structured data, `llms.txt` and per-route code splitting.

### Upgrade notes

For the upstream hosted instance, which ran earlier unreleased versions:

- Apply all migrations up to `20261006100000_signup_limit_counts_confirmed.sql`.
- Redeploy all edge functions. `APP_URL` must be set to the site's `https://` address.
- Optional: set `VITE_TURNSTILE_SITE_KEY` and enable CAPTCHA in Supabase Auth, in that order (see the [guide](docs/self-hosting.md#45-optional-captcha-against-bot-sign-ups)).
