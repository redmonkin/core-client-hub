# Project Memory

## Core
Design: Poppins font, primary #0284C5. Rupee (₹), en-IN locale. Headerless sidebar layout.
DB/Auth: Supabase with RLS. Background jobs via Edge Functions + pg_cron.
Security: Sanitize HTML via DOMPurify. Escape HTML in emails. Handle CORS OPTIONS for PUT.
Emails: Resend via 'notifications.redmonk.in'. CC admin on outgoing.
PDFs: Single-canvas jsPDF/html2canvas, use non-breaking spaces for text.
Team: useWorkspaceUser hook for inserts. RLS uses get_accessible_user_ids().

## Memories
- [Visual Identity](mem://style/visual-identity) — Brand colors, typography, currency, and theming
- [Navigation Structure](mem://style/navigation-structure) — Sidebar UI constraints and route interconnectivity
- [Client Portal](mem://features/client-portal) — Secure token-based access, actions, and portal rendering
- [User Management](mem://features/user-management) — Profile details, avatars, and deletion workflow
- [Client Management](mem://features/client-management) — Client record fields, contact management, and UI specifics
- [PDF Generation](mem://features/pdf-generation) — jsPDF/html2canvas setup and text rendering bug fixes
- [Proposals and Templates](mem://features/proposals-and-templates) — TipTap editor integration, placeholders, and rules
- [Project Management](mem://features/project-management) — Status rules, timesheet tracking, and project files
- [Contracts](mem://features/contracts) — Duration constraints, renewal frequencies, signatures
- [Email Service](mem://integrations/email-service) — Resend integration, sender branding, and CC rules
- [Automated Reminders](mem://features/automated-reminders) — pg_cron scheduling and expiry/renewal urgency rules
- [Security Standards](mem://security/implementation-standards) — JWT, RLS, Edge Function CORS, and File storage rules
- [Public Portfolio](mem://features/public-portfolio) — Public views and Lead capture workflow
- [Team Management](mem://features/team-management) — Workspace scoping, invitation flow, shared data access
