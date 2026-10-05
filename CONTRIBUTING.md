# Contributing to Clientra

Thanks for helping improve Clientra. This guide covers how to get set up and what a good pull request looks like.

## Before you start

- **Bugs**: search existing issues first, then open one using the bug report template.
- **Features**: open an issue to discuss the idea before writing a lot of code, and check [docs/ROADMAP.md](docs/ROADMAP.md) to see if it's already planned.
- **Security issues**: don't open a public issue. Follow [SECURITY.md](SECURITY.md).

## Development setup

Follow [Local development](README.md#local-development) in the README. You'll need your own Supabase project. The [self-hosting guide](docs/self-hosting.md) covers applying the migrations and deploying the edge functions to it.

## Making changes

1. Fork the repo and create a branch from `main`.
2. Keep each pull request focused on one change.
3. Run the same checks CI runs before pushing:

   ```sh
   npm run lint
   npm run typecheck
   npm run build
   ```

4. Open a pull request and fill in the template. Include screenshots for UI changes.

## Conventions

[CLAUDE.md](CLAUDE.md) describes the architecture in detail. The rules that matter most:

- **Workspace scoping.** Every workspace table has a `user_id` column enforced by RLS. Read policies use `get_accessible_user_ids(auth.uid())` so team members are covered. Client-side inserts use `workspaceUserId` from `useWorkspaceUser()`, never `user.id`.
- **New tables ship with RLS.** Enable row-level security and add policies in the same migration. Never rely on client-side filtering. CI rejects migrations containing `USING (true)`.
- **Migrations are append-only.** Add a new timestamped file in `supabase/migrations/` rather than editing one that has already been released.
- **User HTML is untrusted.** Sanitize with DOMPurify before rendering, and escape values interpolated into email HTML in edge functions.
- **Edge functions** handle CORS `OPTIONS` preflight explicitly. If a function is public (`verify_jwt = false`), it must authenticate the caller itself.
- **UI** uses the shadcn/ui components in `src/components/ui/` and Tailwind tokens from `src/index.css`. Don't hardcode colors.

## Commit messages

Write a short imperative subject line (e.g. "Add expense categories to ledger export"), followed by a body explaining *why* when it isn't obvious.

## License

By contributing, you agree that your contributions are licensed under the [AGPL-3.0](LICENSE), the same license as the project.
