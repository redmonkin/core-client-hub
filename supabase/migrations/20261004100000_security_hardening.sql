-- Security hardening ahead of open-sourcing.
--
-- 1. team_members: an owner/admin could insert or update a row with any
--    member_id and status = 'active', silently making another user a member of
--    their workspace. get_owner_id() would then send that user's new records
--    (and invoices with the attacker's bank details) into the attacker's
--    workspace. Users may now only create *pending* invitations with no member,
--    and only the invitee themselves can bind to one (after confirming their
--    email) via accept_team_invitations() or the auth.users trigger.
-- 2. Cross-workspace references: proposals/contracts/invoices/projects/... could
--    point at another workspace's client/project/contract by id. The portal and
--    portfolio (which read with elevated rights) then exposed that other
--    workspace's client details. Referenced rows must now share the user_id.
-- 3. Per-user daily quota for user-triggered emails.
-- 4. Trigger-only SECURITY DEFINER functions are no longer callable over RPC.

-- ---------------------------------------------------------------------------
-- 1. team_members
-- ---------------------------------------------------------------------------

-- Requests made over the API run as anon/authenticated; SECURITY DEFINER
-- functions (accept_team_invitations, the auth trigger) run as their owner and
-- are allowed through.
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

DROP TRIGGER IF EXISTS guard_team_member_write ON public.team_members;
CREATE TRIGGER guard_team_member_write
  BEFORE INSERT OR UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_team_member_write();

-- Bind pending invitations only once the email address is confirmed, so
-- someone who registers an invitee's address first can't claim the invite.
CREATE OR REPLACE FUNCTION public.activate_pending_team_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL OR NEW.email IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.team_members
  SET member_id = NEW.id, status = 'active', updated_at = now()
  WHERE lower(invited_email) = lower(NEW.email)
    AND status = 'pending'
    AND member_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed_activate_team ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_activate_team
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.activate_pending_team_invitations();

-- Called by the app on sign-in (replaces a direct table update that RLS
-- already rejected). Binds only invitations addressed to the caller's own
-- confirmed email.
CREATE OR REPLACE FUNCTION public.accept_team_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _count integer;
BEGIN
  SELECT lower(email) INTO _email
  FROM auth.users
  WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;

  IF _email IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.team_members
  SET member_id = auth.uid(), status = 'active', updated_at = now()
  WHERE lower(invited_email) = _email
    AND status = 'pending'
    AND member_id IS NULL
    AND owner_id <> auth.uid();
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_team_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invitations() TO authenticated;

-- Deterministic when a user belongs to more than one workspace.
CREATE OR REPLACE FUNCTION public.get_owner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.team_members
     WHERE member_id = _user_id AND status = 'active'
     ORDER BY created_at, id
     LIMIT 1),
    _user_id
  )
$$;

-- ---------------------------------------------------------------------------
-- 2. Referenced records must belong to the same workspace
-- ---------------------------------------------------------------------------

-- TG_ARGV holds pairs of (column, referenced table). SECURITY DEFINER so the
-- check sees the referenced row even when RLS would hide it from the caller.
CREATE OR REPLACE FUNCTION public.enforce_same_workspace_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row jsonb := to_jsonb(NEW);
  _i integer := 0;
  _ref_id uuid;
  _ref_owner uuid;
BEGIN
  WHILE _i < TG_NARGS LOOP
    _ref_id := (_row ->> TG_ARGV[_i])::uuid;
    IF _ref_id IS NOT NULL THEN
      EXECUTE format('SELECT user_id FROM public.%I WHERE id = $1', TG_ARGV[_i + 1])
        INTO _ref_owner USING _ref_id;
      IF _ref_owner IS NOT NULL AND _ref_owner IS DISTINCT FROM NEW.user_id THEN
        RAISE EXCEPTION '% does not belong to this workspace', TG_ARGV[_i]
          USING ERRCODE = '42501';
      END IF;
    END IF;
    _i := _i + 2;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_same_workspace_refs() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_same_workspace_refs ON public.projects;
CREATE TRIGGER enforce_same_workspace_refs
  BEFORE INSERT OR UPDATE OF user_id, client_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_workspace_refs('client_id', 'clients');

DROP TRIGGER IF EXISTS enforce_same_workspace_refs ON public.client_contacts;
CREATE TRIGGER enforce_same_workspace_refs
  BEFORE INSERT OR UPDATE OF user_id, client_id ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_workspace_refs('client_id', 'clients');

DROP TRIGGER IF EXISTS enforce_same_workspace_refs ON public.proposals;
CREATE TRIGGER enforce_same_workspace_refs
  BEFORE INSERT OR UPDATE OF user_id, client_id, project_id ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_workspace_refs('client_id', 'clients', 'project_id', 'projects');

DROP TRIGGER IF EXISTS enforce_same_workspace_refs ON public.contracts;
CREATE TRIGGER enforce_same_workspace_refs
  BEFORE INSERT OR UPDATE OF user_id, client_id, project_id ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_workspace_refs('client_id', 'clients', 'project_id', 'projects');

DROP TRIGGER IF EXISTS enforce_same_workspace_refs ON public.invoices;
CREATE TRIGGER enforce_same_workspace_refs
  BEFORE INSERT OR UPDATE OF user_id, client_id, project_id, contract_id ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_workspace_refs('client_id', 'clients', 'project_id', 'projects', 'contract_id', 'contracts');

DROP TRIGGER IF EXISTS enforce_same_workspace_refs ON public.recurring_invoices;
CREATE TRIGGER enforce_same_workspace_refs
  BEFORE INSERT OR UPDATE OF user_id, client_id, project_id ON public.recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_workspace_refs('client_id', 'clients', 'project_id', 'projects');

DROP TRIGGER IF EXISTS enforce_same_workspace_refs ON public.project_notes;
CREATE TRIGGER enforce_same_workspace_refs
  BEFORE INSERT OR UPDATE OF user_id, project_id ON public.project_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_workspace_refs('project_id', 'projects');

DROP TRIGGER IF EXISTS enforce_same_workspace_refs ON public.timesheets;
CREATE TRIGGER enforce_same_workspace_refs
  BEFORE INSERT OR UPDATE OF user_id, project_id ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_workspace_refs('project_id', 'projects');

-- ---------------------------------------------------------------------------
-- 3. Daily quota for user-triggered email
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.email_send_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_send_events_user_created_idx
  ON public.email_send_events (user_id, created_at);

-- Service role only: RLS on with no policies, and no grants to API roles.
ALTER TABLE public.email_send_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_send_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.email_send_events TO service_role;
GRANT USAGE ON SEQUENCE public.email_send_events_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.claim_email_send_quota(p_user_id uuid, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recent integer;
BEGIN
  -- Serialise concurrent sends from the same user.
  PERFORM pg_advisory_xact_lock(hashtextextended('email_quota:' || p_user_id::text, 0));

  DELETE FROM public.email_send_events
  WHERE user_id = p_user_id AND created_at < now() - interval '2 days';

  SELECT count(*) INTO _recent
  FROM public.email_send_events
  WHERE user_id = p_user_id AND created_at > now() - interval '24 hours';

  IF _recent >= p_limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.email_send_events (user_id) VALUES (p_user_id);
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_email_send_quota(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_send_quota(uuid, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Trigger functions are not RPC endpoints
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.activate_pending_team_invitations() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_timesheet_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_team_member_write() FROM PUBLIC, anon, authenticated;
