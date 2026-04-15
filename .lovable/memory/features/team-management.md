---
name: Team Management
description: Team member invitation, workspace scoping, and shared data access via get_accessible_user_ids
type: feature
---

## Architecture
- `team_members` table: owner_id, member_id, invited_email, role, status (pending/active/revoked)
- `get_accessible_user_ids(uuid)` — SECURITY DEFINER function returning user's own ID + any owner IDs where active member
- `get_owner_id(uuid)` — returns owner_id for team members, own ID for owners (used for inserts)
- All RLS policies updated to use `user_id IN (SELECT get_accessible_user_ids(auth.uid()))`

## Client-Side
- `useWorkspaceUser` hook: returns `workspaceUserId` (for inserts), `isTeamMember` flag, `ownerInfo`
- All insert operations across 8+ files use `workspaceUserId` instead of `user.id`
- Status history inserts still use `user?.id` (auth.uid()) since RLS requires the acting user
- Team management UI in `src/components/settings/TeamManagement.tsx`, rendered in Settings page

## Invitation Flow
1. Owner invites by email → inserts pending row
2. On sign-in, `useAuth` activates pending invitations matching the user's email
3. DB trigger `on_auth_user_created_activate_team` also activates on new signups
4. Team members see owner's data, insert under owner's user_id

## Rules
- Only owners can manage team members (invite/remove)
- Team members get full CRUD access to owner's workspace data
- Team members cannot manage the team (shown read-only message)
- Branding/notification_preferences are shared via workspace owner's user_id
