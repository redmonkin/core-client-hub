# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Clientra — an open-source client management platform for freelancers and agencies (clients, projects, proposals, contracts, templates, timesheets, notes, client portal, public portfolio). Originally scaffolded via Lovable; a Vite + React + TypeScript SPA backed by Supabase (Postgres + Auth + Storage + Edge Functions).

## Commands

- `npm run dev` — start the Vite dev server (port 8080). Runs `predev` first, which regenerates `public/sitemap.xml` via `scripts/generate-sitemap.ts`.
- `npm run build` — production build (also regenerates the sitemap via `prebuild`).
- `npm run build:dev` — build in development mode.
- `npm run lint` — run ESLint over the repo.
- `npm run typecheck` — TypeScript checks for app and node configs (`vite build` does not typecheck). CI (`.github/workflows/ci.yml`) runs lint, typecheck and build on every PR.
- `npm run preview` — preview a production build locally.

There is no test suite configured in this repo.

Package manager: both `bun.lockb`/`bun.lock` and `package-lock.json` are present; `predev`/`prebuild` scripts explicitly invoke `bunx`, so prefer `bun` for scripts that shell out, but either `npm` or `bun` works for install/dev/build.

Supabase CLI (`supabase/`) manages migrations and edge functions for the linked project (`supabase link --project-ref <ref>`; the upstream deployment is `jizouqjrdyfshhztqucd`). Migration files live in `supabase/migrations/` (timestamp-prefixed SQL, applied in order) and edge functions live in `supabase/functions/<name>/index.ts` (Deno, using `https://esm.sh` / `https://deno.land/std` imports, not npm).

## Architecture

**Routing (`src/App.tsx`)**: `react-router-dom` with two route classes — public (`/`, `/auth`, `/portal`, `/portfolio/:userId`) and protected app routes wrapped in `ProtectedRoute` + `AppLayout` (dashboard, clients, projects, proposals, contracts, templates, settings, profile, briefs). Auth state comes from `useAuth()` (src/hooks/useAuth.tsx), which wraps Supabase's session/user state.

**Data layer**: All data access goes through the Supabase client at `src/integrations/supabase/client.ts` (auto-generated, do not hand-edit) using `src/integrations/supabase/types.ts` for generated DB types. Data fetching/mutations use TanStack Query. There is no separate REST/API layer — client code talks to Supabase (Postgres via PostgREST, RLS-enforced) directly, or invokes edge functions for privileged/server-side work (email sending, PDF generation, token-based portal access, scheduled reminders).

**Multi-tenant workspace model (team management)**: Every core table is scoped by a `user_id` column enforced via Postgres RLS. Team members can be invited by an account owner and get full read/write access to the owner's data. Key pieces:
- `team_members` table (`owner_id`, `member_id`, `status: pending|active|revoked`).
- Security-definer SQL functions `get_accessible_user_ids(uuid)` (used in RLS policies — resolves to the user's own id plus any owner ids they're an active team member of) and `get_owner_id(uuid)` (used client-side for inserts — resolves to the workspace owner's id).
- Client-side, use the `useWorkspaceUser()` hook (`src/hooks/useWorkspaceUser.ts`) to get `workspaceUserId` and write all new records with that id (not `user.id` directly), so team members' writes land in the owner's workspace.
- `useAuth` auto-activates pending team invitations by email on sign-in.
- When adding a new table that should be workspace-scoped, follow this same pattern: RLS policy using `get_accessible_user_ids(auth.uid())`, and client inserts using `workspaceUserId` from `useWorkspaceUser()`.

**Token-based public access**: Client portal (`/portal`) and public portfolio (`/portfolio/:userId`) pages, plus proposal/contract "share" links, use signed access tokens (`proposal_access_tokens`, `contract_access_tokens` tables and `src/lib/proposal-portal-access.ts` / `contract-portal-access.ts`) rather than Supabase auth sessions. The `client-portal` edge function is the token-authenticated entry point for external (non-authenticated) actions like approving/rejecting a proposal or signing a contract.

**Edge functions** (`supabase/functions/*/index.ts`, Deno runtime): handle anything requiring the service role key or third-party APIs — `send-proposal-email` / `send-notification-email` (Resend; sender comes from the `EMAIL_FROM_ADDRESS` secret via `_shared/email.ts`; HTML must be escaped), `generate-proposal-pdf`, `portfolio-onboard`, `portfolio-image-url`, `delete-account`, `client-portal`, and cron-triggered `contract-renewal-reminders` / `proposal-expiry-reminders` / `generate-recurring-invoices` / `generate-recurring-expenses` (scheduled via `pg_cron`, which reads the function base URL and service role key from the Vault secrets `project_url` and `service_role_key` — never hardcode a project URL in a migration; see `supabase/config.toml` for `verify_jwt = false` functions that must be publicly invokable). All edge functions must handle CORS `OPTIONS` preflight explicitly, including for `PUT` requests. Shared Deno helpers live in `supabase/functions/_shared/`. Required secrets are listed in `supabase/functions/.env.example`; frontend env vars in `.env.example`.

**UI stack**: shadcn/ui components (`src/components/ui/`, configured via `components.json`) on top of Radix primitives, Tailwind CSS (`tailwind.config.ts`), `lucide-react` icons. Feature components are grouped by domain under `src/components/{clients,contracts,dashboard,layout,notes,notifications,proposals,settings,shared,templates,timesheets}`. Pages live in `src/pages/` and are thin — most logic lives in hooks/components.

**Editors & exports**: Proposal/contract/template rich text uses TipTap (`@tiptap/react` + extensions). PDF export (`src/lib/pdf-export.ts`) uses a single-canvas `html2canvas` + `jsPDF` approach — use non-breaking spaces where plain spaces get collapsed/dropped in the rendered text. `.docx` export uses `html-docx-js-typescript`.

**Design system conventions**: Inter for UI text (Tailwind `font-sans`; Poppins only in generated invoice/PDF HTML, Hurricane for signatures), primary color `#0284C5`, currency is Rupee (₹) formatted with `en-IN` locale, headerless sidebar layout (`AppLayout`).

## Security conventions

- Sanitize any user-supplied HTML before rendering with DOMPurify (`dompurify` dep).
- Escape HTML manually when building email bodies in edge functions (see `escapeHtml` helper pattern in `supabase/functions/*/index.ts`).
- New tables must ship with RLS policies from the start — never rely on client-side filtering alone. Use `get_accessible_user_ids()` for read policies so team members are covered.
- Inserts must use the workspace owner's id (`useWorkspaceUser`), not `auth.uid()`/`user.id` directly, or team-member writes will be misattributed/invisible to the owner.

## Project memory

This repo (originally built with Lovable) keeps feature-level design notes under `.lovable/memory/` — `.lovable/memory/index.md` is an index into per-feature notes (client portal, PDF generation, proposals/templates, contracts, email service, automated reminders, security standards, public portfolio, team management, etc.). Check there for prior design decisions before re-deriving them from code.
