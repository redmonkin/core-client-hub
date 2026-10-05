-- Free-plan limits for the hosted service:
--   * at most `max_workspaces` workspace owners can sign up. People invited to
--     an existing workspace can always sign up (they don't create a workspace);
--   * at most `max_members_per_workspace` people per workspace, counting the
--     owner plus active and pending invitations.
--
-- Both live in public.app_settings so they can be changed from the Table
-- Editor without a deploy. NULL means unlimited (e.g. for self-hosting).

CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  max_workspaces integer CHECK (max_workspaces IS NULL OR max_workspaces >= 0),
  max_members_per_workspace integer CHECK (max_members_per_workspace IS NULL OR max_members_per_workspace >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (id, max_workspaces, max_members_per_workspace)
VALUES (true, 10, 5)
ON CONFLICT (id) DO NOTHING;

-- Read and changed only from the dashboard / service role.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.app_settings TO service_role;

-- A workspace is an account that isn't an active member of someone else's.
CREATE OR REPLACE FUNCTION public.workspace_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.team_members t
    WHERE t.member_id = u.id AND t.status = 'active'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.workspace_count() FROM PUBLIC, anon, authenticated;

-- For the sign-up page: false once the free seats are taken. Says nothing
-- about any particular email address.
CREATE OR REPLACE FUNCTION public.free_signups_open()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT s.max_workspaces IS NULL OR public.workspace_count() < s.max_workspaces
     FROM public.app_settings s WHERE s.id),
    true
  )
$$;

REVOKE EXECUTE ON FUNCTION public.free_signups_open() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.free_signups_open() TO anon, authenticated;

-- Blocks new accounts once the workspace limit is reached, unless the email
-- has a pending invitation (that person joins an existing workspace).
CREATE OR REPLACE FUNCTION public.enforce_workspace_signup_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max integer;
BEGIN
  SELECT max_workspaces INTO _max FROM public.app_settings WHERE id;
  IF _max IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.team_members
    WHERE lower(invited_email) = lower(NEW.email) AND status = 'pending' AND member_id IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  -- Serialise concurrent sign-ups so two can't both take the last seat.
  PERFORM pg_advisory_xact_lock(hashtext('clientra_workspace_signup_limit'));
  IF public.workspace_count() >= _max THEN
    RAISE EXCEPTION 'signup_limit_reached: free workspaces are full'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_workspace_signup_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_workspace_signup_limit ON auth.users;
CREATE TRIGGER enforce_workspace_signup_limit
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_signup_limit();

-- Seats in a workspace: the owner plus every active or pending invitation.
CREATE OR REPLACE FUNCTION public.workspace_seats_used(_owner_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 1 + count(*)::integer
  FROM public.team_members
  WHERE owner_id = _owner_id AND status IN ('active', 'pending')
$$;

REVOKE EXECUTE ON FUNCTION public.workspace_seats_used(uuid) FROM PUBLIC, anon, authenticated;

-- Raises if the workspace has no free seat. SECURITY DEFINER because it is
-- called from guard_team_member_write, which runs as the inviting user, and
-- that user can't read app_settings.
CREATE OR REPLACE FUNCTION public.assert_workspace_seat_available(_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max integer;
BEGIN
  SELECT max_members_per_workspace INTO _max FROM public.app_settings WHERE id;
  IF _max IS NOT NULL AND public.workspace_seats_used(_owner_id) >= _max THEN
    RAISE EXCEPTION 'seat_limit_reached: a workspace can have up to % people', _max
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assert_workspace_seat_available(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_workspace_seat_available(uuid) TO authenticated;

-- For the team screen: the caller's workspace seat limit (NULL = unlimited)
-- and how many seats are used.
CREATE OR REPLACE FUNCTION public.my_workspace_seats()
RETURNS TABLE (seats_used integer, seat_limit integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.workspace_seats_used(public.get_owner_id(auth.uid())),
         (SELECT max_members_per_workspace FROM public.app_settings WHERE id)
  WHERE auth.uid() IS NOT NULL
$$;

REVOKE EXECUTE ON FUNCTION public.my_workspace_seats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_workspace_seats() TO authenticated;

-- Same rules as 20261004100000_security_hardening.sql, plus the seat limit on
-- new invitations.
CREATE OR REPLACE FUNCTION public.guard_team_member_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.member_id IS NOT NULL OR NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'Team members can only be added as pending invitations'
        USING ERRCODE = '42501';
    END IF;
    NEW.invited_email := lower(trim(NEW.invited_email));
    PERFORM public.assert_workspace_seat_available(NEW.owner_id);
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.member_id IS DISTINCT FROM OLD.member_id
     OR NEW.invited_email IS DISTINCT FROM OLD.invited_email THEN
    RAISE EXCEPTION 'Team membership identity cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'revoked' THEN
    RAISE EXCEPTION 'Invitations can only be accepted by the invitee'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
