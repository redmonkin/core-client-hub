# Clientra — Product & Feature Reference (PRD)

This document is the reference for existing product behavior. It exists so that upcoming security fixes (see repo TODOs — authorization checks on the email-sending edge functions) can be implemented **without breaking any of the flows described below**. Anyone changing `supabase/functions/send-proposal-email`, `supabase/functions/send-notification-email`, `supabase/functions/client-portal`, or RLS policies should re-read the relevant section here before and after the change.

Status: describes behavior as of 2026-07-08 (main branch, commit `e336fb5`). Update this doc whenever a described flow changes.

---

## 1. Product summary

Clientra is a client-management platform for freelancers/agencies: manage clients, projects, proposals, contracts, templates, timesheets, and notes; send proposals/contracts to clients for e-signature/approval via a token-based client portal; publish a public portfolio; invite team members into a shared workspace.

Stack: Vite + React + TypeScript SPA, Supabase (Postgres + Auth + Storage + Edge Functions), Resend for transactional email.

## 2. Core entities and workspace scoping

Every core table (`clients`, `projects`, `proposals`, `contracts`, `templates`, `timesheets`, `project_notes`, `client_contacts`, `branding_settings`, `notification_preferences`, `proposal_access_tokens`, `contract_access_tokens`, `proposal_status_history`, `contract_status_history`, `notifications`) has a `user_id` column that is the **workspace owner's** ID — not necessarily the ID of the person who created the row.

### Team workspace model
- `team_members` table: `id, owner_id, member_id, role, status (pending|active|revoked), invited_email, created_at, updated_at`.
- `get_accessible_user_ids(_user_id uuid)` (SECURITY DEFINER): returns the caller's own ID plus any `owner_id` where the caller is an `active` team member. Used in **every** RLS `SELECT`/`UPDATE`/`DELETE` policy as `user_id IN (SELECT get_accessible_user_ids(auth.uid()))`.
- `get_owner_id(_user_id uuid)` (SECURITY DEFINER): returns the workspace owner's ID for a given user (their own ID if they're an owner, or the `owner_id` of the team they belong to). Used **client-side only**, via the `useWorkspaceUser()` hook, to decide what `user_id` to stamp on new INSERTs so a team member's writes land in the owner's workspace instead of creating an orphaned record under their own ID.
- Both functions derive everything from `auth.uid()` / a caller-supplied `_user_id` that's cross-checked server-side — **RLS never trusts a client-supplied user_id directly**, so this is not a place to introduce IDOR when touching related code.
- Invitation flow: owner invites by email → row created with `status='pending'`, `member_id=NULL`. On sign-in (`useAuth.tsx`), any pending invite matching the signed-in user's email is flipped to `status='active'`, `member_id=<new user's id>`. Team members get **full read/write** access to all of the owner's data (no per-resource ACLs — it's all-or-nothing at the workspace level today).

**Constraint for future changes:** any authorization check added for security purposes (e.g. "does this user own this proposal") must account for team members — checking `proposal.user_id === auth.uid()` directly would incorrectly lock out legitimate team members. Use `proposal.user_id IN get_accessible_user_ids(auth.uid())` (or equivalent) instead.

## 3. Proposals

- Created/edited in-app (`src/pages/Proposals.tsx`, `ProposalDetail.tsx`) with a TipTap rich-text editor, cost breakdown JSON, validity date, client link.
- **Send proposal to client** (`Proposals.tsx:520`, `ProposalDetail.tsx:260`): calls the `send-proposal-email` edge function with `{ proposalId, clientEmail, clientName, proposalTitle, customerGoals, totalAmount, validityDate, portalLink, portalPassword, senderName, senderCompany, supportEmail, ccEmails, customSubject, customIntro, isReminder }`. `proposalId` is currently accepted but **not used** by the function to look anything up — see Security Fix Constraints below.
- **Portal access**: sharing a proposal creates/uses a row in `proposal_access_tokens` (opaque token, optional password, expiry). The client-facing link (`portalLink` in the email) points to `/portal?token=...`, resolved by `src/pages/ClientPortal.tsx` + the `client-portal` edge function (see §6).
- **Status updates notify the owner**: when a client approves/rejects/requests changes via the portal, `send-notification-email` is invoked (from the `client-portal` function or from status-change handlers) with `type: proposal_approved|proposal_rejected|proposal_change_requested`.
- Reminders: `proposal-expiry-reminders` edge function (cron via `pg_cron`) emails owners as proposals approach their validity date.

## 4. Contracts

- Similar lifecycle to proposals: create/edit (`Contracts.tsx`, `ContractDetail.tsx`), `contract_access_tokens` for portal access, e-signature capture via the client portal.
- **Send contract to client**: `ContractDetail.tsx:351` and `Contracts.tsx:489` call `send-notification-email` with `type: contract_created|contract_sent` and a `data` object containing `contractType, contractTitle, startDate, endDate, totalAmount/value, renewalFrequency, portalLink, portalPassword, senderName, senderCompany, supportEmail, customIntro, customSubject, isReminder`.
- Renewal frequency and duration constraints are validated client-side (see `.lovable/memory/features/contracts.md` reference in `.lovable/memory/index.md` if present).
- Reminders: `contract-renewal-reminders` edge function (cron) emails owners as contracts approach renewal/expiry.

## 5. Team invitations

- `src/components/settings/TeamManagement.tsx` (Settings page): owner enters an email, a `team_members` row is created (`status='pending'`), and `send-notification-email` is called with `type: 'team_invite'`, `data: { inviterName, appUrl, senderCompany }`.
- Recipient signs up/logs in with that email → auto-activated per §2.

## 6. Client Portal (token-based, unauthenticated)

- Route: `/portal?token=...` (`src/pages/ClientPortal.tsx`), no Supabase auth session — access is entirely via the opaque token in `proposal_access_tokens`/`contract_access_tokens`.
- Backed by the `client-portal` edge function (`verify_jwt = false`, uses the service-role key internally). It:
  - Resolves the token to a proposal or contract via `proposal_access_tokens`/`contract_access_tokens` (service-role query, not client-filtered).
  - Enforces the optional password gate on both GET (view) and POST (approve/reject/sign) actions.
  - Never trusts a client-supplied proposal/contract ID directly — the ID comes from the token lookup, not from the request body. **This is the pattern to replicate when fixing the email-sending functions' ownership checks** (§8).
- Rendered content is sanitized with DOMPurify before `dangerouslySetInnerHTML` (`ClientPortal.tsx:435,448`).

## 7. Public Portfolio

- Route: `/portfolio/:userId` (`src/pages/Portfolio.tsx`), public, unauthenticated.
- Backed by `portfolio-onboard` (lead capture / project inquiry from a visitor) and `portfolio-image-url` (signed/public image URL resolution) edge functions.
- `user_id` in these functions is validated against a real `branding_settings` row before use; no path traversal or SSRF surface (see security review below).

## 8. Transactional email — architecture and known gap

Two edge functions send all outbound email via Resend, from `noreply@notifications.redmonk.in`:

| Function | Triggers | Auth today |
|---|---|---|
| `send-proposal-email` | Send/resend a proposal to a client | Requires a valid Supabase session (`Authorization: Bearer <jwt>`), but **does not verify the caller owns the `proposalId`** they're sending about |
| `send-notification-email` | Contract send/reminder, proposal status change, team invite | Same — valid session required, **no ownership check** on the referenced proposal/contract/team |
| `contract-renewal-reminders` / `proposal-expiry-reminders` | pg_cron only | Service-role bearer token match (not user-invocable) |

**Known security gap (tracked in TODO, being fixed next):** because ownership isn't verified, any authenticated user (including a user with no relationship to a given proposal/contract) can currently cause either function to send an arbitrary-content, brand-styled email to an arbitrary recipient. The fix must add a DB lookup (using the service-role client inside the edge function) that resolves the referenced `proposalId`/contract/team row and checks `user_id IN get_accessible_user_ids(auth.uid())` — mirroring the `client-portal` function's pattern of resolving identity server-side rather than trusting the request body.

**Do not break when fixing:**
1. **Team members must still be able to send** proposals/contracts belonging to their workspace owner — the fix must check `get_accessible_user_ids`, not `auth.uid() = user_id`.
2. **Reminders (`isReminder: true`) reuse the same functions** with the same payload shape plus a flag — the ownership check must apply uniformly, not just to the "first send" path.
3. **`customSubject`/`customIntro` free-text fields are legitimate, user-authored content** (the sender editing their own outgoing email) — do not remove or over-restrict these while adding the ownership check; only add a check that the *proposal/contract being referenced* belongs to the caller's workspace.
4. **CC recipients (`ccEmails`)** are an existing intentional feature (CC additional stakeholders) — do not conflate "arbitrary recipient" concerns for `to` with the `cc` feature, which is expected to allow arbitrary addresses chosen by the sender.
5. Both functions currently escape all interpolated values via a local `escapeHtml()` helper — **except** `recipientName` in `send-notification-email:82`, which is a separate, smaller fix (see TODO) and should be done in the same change since it touches the same function.
6. **`send-proposal-email` already validates `portalLink`/`clientEmail`-adjacent URLs via `isSafeHttpUrl()`** — preserve this when refactoring.

**Status: fixed.** Both functions now resolve the recipient server-side via the RLS-scoped client rather than trusting the request body — `send-proposal-email` requires `proposalId` and looks up the client email through the proposal; `send-notification-email` requires `data.contractId` (contract types) or `data.proposalId` (proposal-status types, which self-notify the caller) and validates `team_invite` against an existing pending `team_members` row. `recipientName` in `send-notification-email` is now escaped.

## 9. Settings & Profile

- `Settings.tsx`: branding (logo, colors), team management, notification preferences, client portal password defaults.
- `Profile.tsx`: user profile, avatar upload, account deletion (`delete-account` edge function — derives identity solely from the caller's own JWT, never a body-supplied user id; do not change this pattern).

## 10. Reference

- Full feature-level design notes (design decisions, rules) live in `.lovable/memory/` — see `.lovable/memory/index.md`.
- Architecture/build commands: `CLAUDE.md` at repo root.
- Security review findings and remediation tracked as TODOs (see task list); this PRD is the pre-read for that work, not a replacement for it.
- `.github/workflows/check-migrations.yml` fails PRs that introduce a `USING (true)` RLS policy in `supabase/migrations/`, to stop the "ship permissive, tighten later" pattern seen historically in this repo's migration history from recurring.
