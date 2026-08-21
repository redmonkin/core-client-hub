-- Task status "pending" (set when a task is marked complete) is renamed to
-- "completed" for clarity -- "pending" read as "not started yet" to users,
-- when it actually meant "done, awaiting billing".

UPDATE public.timesheets SET status = 'completed' WHERE status = 'pending';

-- Update the completion-notification trigger to match the renamed status.
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

  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status = 'in-progress' THEN
    IF COALESCE((SELECT task_completed FROM public.notification_preferences WHERE user_id = NEW.user_id), true) THEN
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (NEW.user_id, 'task_completed', 'Task Completed',
              COALESCE(NEW.owner, 'Someone') || ' completed: ' || NEW.task, NEW.id, 'timesheet');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
