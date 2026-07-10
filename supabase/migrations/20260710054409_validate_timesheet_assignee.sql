-- Code review on the assign/start/complete workflow flagged that
-- timesheets.assignee_user_id had no validation: a caller could set it to an
-- arbitrary uuid (not a member of their workspace), and the notify_timesheet_change()
-- trigger would write that arbitrary user a notification -- a cross-tenant
-- notification-injection vector. Close it by requiring assignee_user_id to
-- resolve to the workspace owner or an active team member at write time.

CREATE OR REPLACE FUNCTION public.is_valid_timesheet_assignee(_assignee uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _assignee = _owner_id
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.owner_id = _owner_id AND tm.member_id = _assignee AND tm.status = 'active'
    )
$$;

REVOKE EXECUTE ON FUNCTION public.is_valid_timesheet_assignee(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_valid_timesheet_assignee(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can create their own timesheets" ON public.timesheets;
CREATE POLICY "Users can create their own timesheets" ON public.timesheets
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.has_permission(auth.uid(), user_id, 'timesheets', 'create')
    AND (assignee_user_id IS NULL OR public.is_valid_timesheet_assignee(assignee_user_id, user_id))
  );

DROP POLICY IF EXISTS "Users can update their own timesheets" ON public.timesheets;
CREATE POLICY "Users can update their own timesheets" ON public.timesheets
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.has_permission(auth.uid(), user_id, 'timesheets', 'update')
  )
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.has_permission(auth.uid(), user_id, 'timesheets', 'update')
    AND (assignee_user_id IS NULL OR public.is_valid_timesheet_assignee(assignee_user_id, user_id))
  );

-- Defense in depth: even if a row somehow got an invalid assignee_user_id
-- (e.g. a future service-role path that bypasses RLS), never notify a
-- non-member.
CREATE OR REPLACE FUNCTION public.notify_timesheet_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_user_id IS NOT NULL
     AND NEW.assignee_user_id IS DISTINCT FROM auth.uid()
     AND public.is_valid_timesheet_assignee(NEW.assignee_user_id, NEW.user_id)
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
