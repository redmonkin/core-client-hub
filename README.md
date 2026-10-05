<div align="center">

<img src="src/assets/clientra-dark.svg" alt="" width="72" height="72" />

# Clientra

**Open-source client management for freelancers and agencies.**

Clients, projects, proposals, contracts, invoices and a client portal, in one app you can use hosted or run yourself.

[Website](https://clientra.redmonk.in) · [Self-hosting](#self-hosting) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

[![CI](https://github.com/redmonkin/core-client-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/redmonkin/core-client-hub/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-0284C7.svg)](LICENSE)

</div>

![Clientra](public/og-image.png)

## Features

- **Clients & projects**: contacts, notes, files, tasks and history for every client.
- **Proposals & templates**: reusable rich-text templates, scope and pricing, PDF and Word export.
- **Contracts & e-signatures**: clients sign online. Renewal reminders go out before contracts expire.
- **Invoices & accounts**: recurring invoices and expenses, payments, TDS tracking, and a per-client ledger. Amounts are in ₹.
- **Tasks & timesheets**: track hours per project, import from CSV or Excel and export back.
- **Client portal**: share proposals, contracts and invoices through password-protected links that expire. Clients approve, request changes, sign and comment without creating an account.
- **Team workspace**: invite teammates with roles, including a separate permission for seeing financial figures.
- **Public portfolio**: showcase featured projects, with a "start a project" form that creates leads in your workspace.
- **Notifications**: in-app and email alerts when clients view or respond.

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, TipTap |
| Backend | [Supabase](https://supabase.com): Postgres with row-level security, Auth, Storage, Edge Functions (Deno) |
| Email | [Resend](https://resend.com) |
| Scheduling | `pg_cron` + `pg_net` for reminders and recurring invoices |

The browser talks to Supabase directly. Row-level security scopes every table to a workspace, and edge functions handle anything that needs the service role: sending email, the token-authenticated client portal, and scheduled jobs.

## Local development

Requirements: Node.js 20+ and a Supabase project (the free tier is fine). [Self-hosting](#self-hosting) below explains how to set the project up.

```sh
git clone https://github.com/redmonkin/core-client-hub.git clientra
cd clientra
npm install
cp .env.example .env   # fill in your Supabase URL and anon key
npm run dev            # http://localhost:8080
```

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript checks (Vite's build does not typecheck) |

CI runs lint, typecheck and build on every pull request.

## Self-hosting

Clientra runs on a single Supabase project plus any static hosting for the frontend. You'll need the [Supabase CLI](https://supabase.com/docs/guides/cli) and a [Resend](https://resend.com) account with a verified sending domain.

### 1. Create and link a Supabase project

```sh
supabase login
supabase link --project-ref <project-ref>
```

### 2. Add two Vault secrets (before running migrations)

The scheduled jobs (reminders, recurring invoices and expenses) call your edge functions using these. In the SQL editor:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<your service_role key>', 'service_role_key');
```

The migrations refuse to schedule the jobs until both secrets exist.

### 3. Apply the database migrations

```sh
supabase db push
```

This creates the schema, RLS policies, storage buckets, `pg_cron` / `pg_net` extensions and cron jobs.

### 4. Configure and deploy edge functions

```sh
cp supabase/functions/.env.example supabase/functions/.env   # fill it in
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy
```

`supabase/config.toml` marks the functions that must be publicly callable (`verify_jwt = false`). Each of those checks its caller itself: the client portal uses its access token, and cron functions require the service role key.

### 5. Configure Auth

In **Authentication → URL Configuration**, set the Site URL to your frontend's URL. Add `https://<your-domain>/dashboard` and `https://<your-domain>/reset-password` to the redirect URLs.

### 6. Optional: sign-up and team limits

`supabase db push` creates a single-row `app_settings` table with `max_workspaces = 10` and `max_members_per_workspace = 5` (the hosted free plan). For your own install, set either column to `NULL` in the Table Editor for no limit. Set `VITE_CONTACT_EMAIL` to show a contact link when sign-ups are full.

In **Authentication → Providers → Email**, set the minimum password length to 10 and require lowercase, uppercase and digits, to match the app's password rules.

### 7. Build and deploy the frontend

Set the variables from [`.env.example`](.env.example) in your hosting provider, then build:

```sh
npm run build   # outputs dist/
```

Serve `dist/` as a single-page app, rewriting every path to `/index.html`. `vercel.json` already does this on Vercel. Netlify, Cloudflare Pages and plain nginx work too.

## Project structure

```
src/
  pages/            Route components (thin; logic lives in hooks/components)
  components/       Feature components by domain, plus shadcn/ui in ui/
  hooks/            useAuth, useWorkspaceUser (workspace-scoped writes), ...
  lib/              PDF export, portal access tokens, invoice utils, ...
  integrations/     Generated Supabase client and database types
supabase/
  migrations/       SQL migrations, applied in timestamp order
  functions/        Deno edge functions (_shared/ holds common helpers)
docs/               Product requirements, roadmap and feature designs
```

[`CLAUDE.md`](CLAUDE.md) documents the architecture in more depth: the multi-tenant workspace model, token-based portal access and the security conventions every change must follow.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and see [docs/ROADMAP.md](docs/ROADMAP.md) for what's planned.

## Security

Please don't report vulnerabilities in public issues. See [SECURITY.md](SECURITY.md).

## License

Clientra is licensed under the [GNU Affero General Public License v3.0](LICENSE). You may use, modify and self-host it freely. If you run a modified version as a service for others, you must make your modified source code available to its users.
