# Team & Permissions

Status: shipped, v2 (per-module CRUD matrix). See [ROADMAP.md](../ROADMAP.md).

## v1 → v2

v1 (2026-07-08) shipped three table-scoped roles (`admin`/`editor`/`viewer`) gating writes only — every active member, including `viewer`, could read everything. On 2026-07-09 this was reworked into a full per-module CRUD permission matrix at the explicit request of the product owner ("more flexible... predefined roles or... show all modules with create/read/update/delete permissions"), because the three fixed tiers couldn't express common real cases (e.g. a contractor who should log timesheets and update projects, but never see contracts or invoices).

## Design

**`team_member_permissions`** — one row per `(team_member_id, module)`, `module IN ('clients','projects','proposals','contracts','templates','timesheets','invoices','notes')`, with independent `can_create`/`can_read`/`can_update`/`can_delete` booleans. `client_contacts` is treated as a sub-resource of the `clients` module; `project_notes` maps to the `notes` module.

**`has_permission(_user_id, _owner_id, _module, _action)`** SECURITY DEFINER function replaces `get_workspace_role(...) IN (...)` as the RLS check everywhere. The workspace owner always returns `true`; a team member's access comes from their `team_member_permissions` row for that module. `get_workspace_role()` is kept, but now only for the one thing that's inherently a single yes/no gate rather than per-module: "can this person manage the team roster" (`team_members`' own RLS still checks `role = 'admin'`).

- **Reads are now permission-gated too** — this was a deliberate scope decision (confirmed via AskUserQuestion) to fully honor "show all modules with CRUD permissions," not just writes. A member with no `read` permission on a module gets zero rows back from that table, same mechanism as writes.
- **Role labels became presets, not the access-control primitive itself**: `admin` (full CRUD everywhere), `manager` (full CRUD everywhere, but can't manage the team — this is the old `editor` renamed 1:1, same access), `contributor` (read-only on clients/proposals/contracts/templates, full CRUD minus delete on projects/timesheets/notes, no invoice access at all), `viewer` (read-only everywhere), `custom` (whatever the owner/admin hand-picked; automatically applied when any single checkbox is edited outside a preset).
- **`can_view_financials` stays a separate, orthogonal toggle** on `team_members` (unchanged from v1) — a member can have `invoices.read = true` (sees that an invoice exists, its status, due date) but still be masked from the dollar amount if `can_view_financials = false`. `invoice_amounts` RLS requires both.
- **Sending documents (proposal/contract/invoice emails) is treated as an `update` action** on that module — `send-proposal-email` and `send-notification-email` now call `has_permission(module, 'update')` instead of the old `role !== 'viewer'` check, so a `contributor` (who has no `update` on proposals/contracts/invoices) is correctly blocked from triggering sends, not just a `viewer`.
- **`document_comments`** posting requires `update` on the commented-on document's module (mapped via a `CASE document_type` — `proposal→proposals`, `contract→contracts`, `invoice→invoices`); reading requires `read`.

## Migration-day backfill

Every existing active team member's old role (`admin`/`editor`→`manager`/`viewer`) was expanded into 8 `team_member_permissions` rows reproducing that role's *exact* prior effective access (full CRUD for admin/manager, read-only for viewer; `invoices.read` additionally respects each member's pre-existing `can_view_financials` value) — nobody's access changed on migration day, it just became representable as a matrix.

## Client-side

- `useWorkspaceUser.ts` fetches the caller's full `PermissionMatrix` (8 modules × 4 actions) alongside `role`/`canViewFinancials`/`workspaceUserId`, and exposes a `can(module, action)` helper.
- `src/components/shared/RequirePermission.tsx` (replaces the v1 `RequireRole.tsx`) — client-side UI gate keyed on `module`+`action` instead of a role tier.
- `src/components/shared/NoAccessState.tsx` — shown on `Clients`/`Projects`/`Proposals`/`Contracts`/`Templates`/`Invoices` list pages when the caller lacks `read` on that module (guards direct URL navigation, not just the hidden sidebar link).
- Sidebar nav items are filtered by `can(module, 'read')`.
- `TeamManagement.tsx`: a preset dropdown (Admin/Manager/Contributor/Viewer/Custom) pre-fills an 8×4 checkbox matrix on invite and per existing member; an expandable "Permissions" section lets an owner/admin hand-edit any member's matrix directly (auto-labels that member `custom`).

## Open items not yet decided

- Should demotion / narrowing a member's permissions be blocked while they have unsaved draft work?
- Should permission changes be audit-logged?
- Per-row (not just per-module) permissions — e.g. "can edit *this* client but not that one" — is a further step up in granularity not built here; the matrix is table/module-scoped, matching every other RLS policy in the app.
