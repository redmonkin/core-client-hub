ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_project_type_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_project_type_check
  CHECK (project_type IN ('one-time', 'amc', 'retainer', 'hourly'));