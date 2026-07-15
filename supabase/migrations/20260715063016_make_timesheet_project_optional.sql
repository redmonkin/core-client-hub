-- Tasks (stored in `timesheets`) previously required a project_id, which
-- meant every assignable task had to belong to a project. Drop that
-- constraint so generic, non-project tasks can be assigned and tracked
-- alongside project tasks in the new workspace-wide Task Master view.
ALTER TABLE public.timesheets ALTER COLUMN project_id DROP NOT NULL;
