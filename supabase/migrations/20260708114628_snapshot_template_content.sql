-- Freeze the rendered template content on proposals/contracts once they're first sent,
-- so editing a template afterward no longer changes what an already-sent/approved
-- document shows to the client (or the owner's own preview).
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS content text;

-- Best-effort backfill for documents that were already sent/approved/etc before this
-- migration: snapshot today's template content, since the actual historical version
-- at time of send can't be recovered. New sends going forward snapshot correctly.
UPDATE public.proposals p
SET content = COALESCE(
  (SELECT t.content FROM public.templates t WHERE t.id = p.template_id),
  (SELECT t.content FROM public.templates t WHERE t.user_id = p.user_id AND t.type = 'proposal' ORDER BY t.updated_at DESC LIMIT 1)
)
WHERE p.status <> 'draft' AND p.content IS NULL;

UPDATE public.contracts c
SET content = COALESCE(
  (SELECT t.content FROM public.templates t WHERE t.id = c.template_id),
  (SELECT t.content FROM public.templates t WHERE t.user_id = c.user_id AND t.type = 'contract' ORDER BY t.updated_at DESC LIMIT 1)
)
WHERE c.status <> 'draft' AND c.content IS NULL;
