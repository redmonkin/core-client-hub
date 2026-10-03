## What does this change?

<!-- A short description of the change and why it's needed. Link the issue if there is one: "Closes #123". -->

## How was it tested?

<!-- Steps you took to verify it. Screenshots or recordings for UI changes. -->

## Checklist

- [ ] `npm run lint`, `npm run typecheck` and `npm run build` pass
- [ ] New tables have RLS policies, and inserts use `workspaceUserId`
- [ ] Any new migration is a new file (released migrations aren't edited)
- [ ] User-supplied HTML is sanitized, and email HTML is escaped
