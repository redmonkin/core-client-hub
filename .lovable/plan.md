

# Team Management — Full Access for Team Members

## Overview
Add the ability for account owners to invite team members (by email) who get full access to all the owner's data — clients, projects, proposals, contracts, templates, timesheets, and notes. Team members operate within the owner's workspace seamlessly.

## Current Architecture
Every table uses `user_id` to scope data. All RLS policies use `auth.uid() = user_id`. All client-side inserts set `user_id: user.id`. There are ~12 files inserting data and all queries rely on RLS for filtering.

## Plan

### Step 1: Database Migration

Create a `team_members` table and a security-definer helper function:

```text
team_members table:
  id          uuid PK
  owner_id    uuid NOT NULL (the account owner)
  member_id   uuid NOT NULL (the invited user, refs auth.users)
  role        text NOT NULL DEFAULT 'member'
  status      text NOT NULL DEFAULT 'pending' (pending | active | revoked)
  invited_email text NOT NULL
  created_at  timestamptz
  updated_at  timestamptz
  UNIQUE(owner_id, member_id)
```

Create a `get_accessible_user_ids(uuid)` security-definer function that returns:
- The user's own ID
- Any owner_id where the user is an active team member

Create a `get_owner_id(uuid)` function that returns:
- The owner_id if the user is a team member, otherwise the user's own ID (used for inserts so all data stays under the owner's user_id)

### Step 2: Update All RLS Policies

Replace `auth.uid() = user_id` with `user_id IN (SELECT get_accessible_user_ids(auth.uid()))` on all tables:
- clients, projects, proposals, contracts, templates, timesheets, project_notes, client_contacts, branding_settings, notification_preferences, proposal_access_tokens, contract_access_tokens, proposal_status_history, contract_status_history, notifications

This is done in a single migration file covering all tables.

### Step 3: Update Client-Side Code — Insert Logic

All inserts currently use `user_id: user.id`. Team members need to insert with the **owner's** user_id so data stays in the owner's workspace. 

Create a `useWorkspaceUser` hook that:
- Checks if the current user is a team member of someone
- Returns `workspaceUserId` (owner_id if team member, own id if owner)
- All insert operations use `workspaceUserId` instead of `user.id`

Files to update (~12 files):
- `Clients.tsx`, `Projects.tsx`, `Proposals.tsx`, `Contracts.tsx`
- `ProposalDetail.tsx`, `ContractDetail.tsx`
- `ClientContacts.tsx`, `ProjectNotes.tsx`, `ProjectTimesheets.tsx`
- `useTemplates.ts`, `Settings.tsx`

### Step 4: Team Management UI

Add a "Team" section to `Settings.tsx`:
- List current team members with status (pending/active)
- Invite form: email input + invite button
- Remove/revoke team members
- Show team role badge

### Step 5: Invitation Flow

When an owner invites by email:
1. Insert into `team_members` with `status: 'pending'` and `invited_email`
2. If the invited email already has an account, set `member_id` and activate
3. If not, the invitation activates when they sign up with that email (handled via a trigger or checked on login)

Add a trigger/check in `useAuth` or a post-login hook: on login, check if the user's email exists in `team_members` as pending, and if so, set `member_id` and activate.

### Step 6: Sidebar and Navigation Updates

- Add a visual indicator when operating in a team workspace (e.g., show owner's name/company)
- No new routes needed — team members use the same pages

## Technical Details

- **Security**: `get_accessible_user_ids` is `SECURITY DEFINER` to avoid RLS recursion
- **Data isolation**: Team member data lives under the owner's `user_id` — no data duplication
- **Settings**: Team members share branding but have their own notification preferences and profile
- **No foreign keys to auth.users**: `member_id` stored as uuid without FK (per project convention)

