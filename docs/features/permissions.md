# Team & Permissions

Status: planned, build first (see [ROADMAP.md](../ROADMAP.md)).

## Problem

`team_members.role` exists but is unused (defaults to `'member'`) — every active team member currently has full read/write access to everything in the owner's workspace (per `get_accessible_user_ids()`). No way to grant a read-only or financial-restricted collaborator.

## Design

Three roles, table-scoped (not per-resource): `admin`, `editor`, `viewer`. The workspace owner is identified structurally (not a `team_members` row for themselves), resolved via a new `get_workspace_role(_user_id, _owner_id)` SECURITY DEFINER helper (mirrors `get_accessible_user_ids`/`get_owner_id`'s style).

- **`SELECT` policies are unchanged** — every role, including `viewer`, reads everything in the workspace, matching today's behavior.
- **`INSERT`/`UPDATE`/`DELETE` policies gain a role check**: `get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')` — `viewer` can't write. Applied to `clients`, `projects`, `proposals`, `contracts`, `templates`, `timesheets`, `project_notes`, `client_contacts`, and `invoices` once Billing ships.
- **`admin` can invite/remove team members** (not owner-exclusive) — confirmed decision. `team_members`' own RLS policy allows `auth.uid() = owner_id OR get_workspace_role(auth.uid(), owner_id) = 'admin'`.
- Edge functions (`send-proposal-email`, `send-notification-email`) get an explicit `get_workspace_role` check to block `viewer` from triggering sends — they use the service-role client and bypass RLS, so this can't be enforced by the database policy alone.

## Financial visibility

Separate from role — a `can_view_financials` boolean on `team_members` (default `true`, backfilled to `true` for existing active members so nobody's visibility silently changes on migration day).

**Confirmed as a real DB-level boundary, not just UI masking.** Since Postgres RLS is row-level and Supabase uses a single shared `authenticated` role, column-level differentiation needs a companion-table split: financial figures live in a separate table with its own RLS requiring `can_view_financials = true`. This is applied to the new `invoices` table (see [billing.md](billing.md)) since it has no existing consumers to break. `contracts.value` stays as a normal column for now — splitting it out would touch a large amount of already-working code (status alerts, sorting, dashboard) for a field that isn't the primary "revenue" concern; flagged as a possible follow-up if needed later, not built now.

## Client-side

- `useWorkspaceUser.ts` extended to also return role + `can_view_financials` (piggybacked on its existing `get_owner_id` RPC round-trip, not a second hook/network call).
- New `src/components/shared/RequireRole.tsx` gate, used across every page with mutating actions.
- `TeamManagement.tsx` gets a role selector + financial-visibility toggle on invite and on existing member rows.
- A visible "your role" indicator somewhere in the UI (sidebar/profile menu).

## Open items not yet decided

- Should demotion be blocked while a member has unsaved draft work?
- Should role/permission changes be audit-logged?
