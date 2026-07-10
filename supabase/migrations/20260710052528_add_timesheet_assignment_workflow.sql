-- Timesheets pivot from "log hours already worked" to an assign -> start ->
-- complete workflow. Duration is now unknown at creation (work hasn't
-- happened yet) and status defaults to 'new' instead of 'pending'.
--
-- `owner` (display text) is kept as-is so existing table/export code doesn't
-- need to change, but a real `assignee_user_id` is added alongside it so the
-- app can notify a specific team member and (later) build an "assigned to
-- me" view -- a free-text label can't support either.

ALTER TABLE public.timesheets
  ALTER COLUMN duration DROP NOT NULL,
  ALTER COLUMN duration DROP DEFAULT;

ALTER TABLE public.timesheets
  ALTER COLUMN status SET DEFAULT 'new';

ALTER TABLE public.timesheets ADD COLUMN assignee_user_id uuid;
ALTER TABLE public.timesheets ADD COLUMN due_date date;

CREATE INDEX timesheets_assignee_user_id_idx ON public.timesheets(assignee_user_id);

-- Best-effort backfill: match each existing row's free-text `owner` against
-- the workspace's own roster (owner + active team members) by name or email.
UPDATE public.timesheets t
SET assignee_user_id = (
  SELECT u.id FROM auth.users u
  WHERE (
    u.id = t.user_id
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.owner_id = t.user_id AND tm.member_id = u.id AND tm.status = 'active'
    )
  )
  AND (
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) = t.owner
    OR u.email = t.owner
  )
  LIMIT 1
);

ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS task_assigned boolean NOT NULL DEFAULT true;
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS task_completed boolean NOT NULL DEFAULT true;

-- Notify the assignee when a task is (re)assigned to them, and notify the
-- workspace owner when an in-progress task is completed (status -> pending).
-- Runs SECURITY DEFINER so it can write a notification for a *different*
-- user than the caller without needing a client-writable INSERT policy on
-- notifications (matches how every other cross-user notification in this
-- app is written server-side rather than via a client-side RLS grant).
CREATE OR REPLACE FUNCTION public.notify_timesheet_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_user_id IS NOT NULL
     AND NEW.assignee_user_id IS DISTINCT FROM auth.uid()
     AND (TG_OP = 'INSERT' OR NEW.assignee_user_id IS DISTINCT FROM OLD.assignee_user_id) THEN
    IF COALESCE((SELECT task_assigned FROM public.notification_preferences WHERE user_id = NEW.assignee_user_id), true) THEN
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (NEW.assignee_user_id, 'task_assigned', 'New Task Assigned',
              'You were assigned: ' || NEW.task, NEW.id, 'timesheet');
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'pending' AND OLD.status = 'in-progress' THEN
    IF COALESCE((SELECT task_completed FROM public.notification_preferences WHERE user_id = NEW.user_id), true) THEN
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (NEW.user_id, 'task_completed', 'Task Completed',
              COALESCE(NEW.owner, 'Someone') || ' completed: ' || NEW.task, NEW.id, 'timesheet');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS timesheets_notify ON public.timesheets;
CREATE TRIGGER timesheets_notify
AFTER INSERT OR UPDATE ON public.timesheets
FOR EACH ROW EXECUTE FUNCTION public.notify_timesheet_change();
