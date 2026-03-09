

## Missing Features & Gaps

After auditing all pages, routes, and cross-linking, here are the issues found:

### 1. ClientDetail: Items not clickable
- **Projects tab**: Project names are plain text (`<p>`) instead of links to `/projects/:id`
- **Proposals tab**: Proposal titles are plain text, not actionable
- **Contracts tab**: Contract items are plain text, not actionable

### 2. ProjectDetail: Items not clickable
- **Proposals tab**: Proposal titles are plain text
- **Contracts tab**: Contract items are plain text

### 3. Dashboard: Items not clickable
- **Recent Proposals** list items are not links -- clicking does nothing
- **Upcoming Renewals** cards are not linked to anything
- **Stat cards** (Active Clients, Active Projects, etc.) don't link to their respective pages

### 4. Dashboard: No "Recent Projects" or "Recent Activity" section
- The dashboard shows renewals and proposals but has no projects summary

### 5. Missing back button on ClientDetail
- ClientDetail has no back/navigation button to return to the Clients list (ProjectDetail has one)

---

## Plan

### Fix 1: Add links in ClientDetail
- Project names become `<Link to={/projects/${id}}>` 
- Proposal titles become clickable (no dedicated detail page exists, so link to `/proposals` or open preview -- linking to `/proposals` is simplest)
- Contract items similarly

### Fix 2: Add links in ProjectDetail
- Same pattern for proposals and contracts listed in tabs

### Fix 3: Make Dashboard items clickable
- Stat cards: wrap each in a `<Link>` to `/clients`, `/projects`, `/proposals`, `/contracts`
- Recent Proposals: wrap each item in a `<Link>` to `/proposals`
- Renewal cards: make clickable linking to `/contracts`

### Fix 4: Add back button to ClientDetail
- Add a back arrow button linking to `/clients`, matching ProjectDetail's pattern

### Fix 5: Add "View All" links on dashboard cards
- Add "View All →" links in the card headers pointing to `/proposals` and `/contracts`

**Files to modify**: `ClientDetail.tsx`, `ProjectDetail.tsx`, `Dashboard.tsx`, `StatCard.tsx`, `RenewalCard.tsx`

