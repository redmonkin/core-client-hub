-- Add missing column grants for anon on projects to support portfolio queries
GRANT SELECT (project_type, status) ON public.projects TO anon;