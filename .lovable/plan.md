

## Problem

The Projects page links to `/projects/:id` (both from project name clicks and the "View Details" dropdown item), but there is no route defined for `/projects/:id` in `App.tsx` and no `ProjectDetail` page exists. This causes a 404.

After auditing all pages and routes, this is the **only missing detail page**. Clients (`/clients/:id`) already has both a route and a `ClientDetail.tsx` page. No other entity pages (proposals, contracts, templates) link to detail routes.

## Plan

### 1. Create `src/pages/ProjectDetail.tsx`

A detail page for a single project, following the same pattern as `ClientDetail.tsx`:

- **Header**: Back button to `/projects`, project name, status badge, project type badge
- **Info cards**: Client name (linked to `/clients/:id`), project type, start/end dates, status
- **Related data tabs**:
  - **Proposals** tab: List proposals linked to this project
  - **Contracts** tab: List contracts linked to this project
- Data fetched via `useQuery` from Supabase (`projects`, `clients`, `proposals`, `contracts` tables, filtered by project ID)

### 2. Add route in `App.tsx`

Add a protected route for `/projects/:id` rendering `ProjectDetail` inside `AppLayout`, placed after the `/projects` route (same pattern as `/clients/:id`).

