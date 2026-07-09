import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

export function useWorkspaceUser() {
  const { user } = useAuth();
  const [workspaceUserId, setWorkspaceUserId] = useState<string | null>(null);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>('owner');
  const [canViewFinancials, setCanViewFinancials] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setWorkspaceUserId(null);
      setIsTeamMember(false);
      setOwnerEmail(null);
      setRole('owner');
      setCanViewFinancials(true);
      setLoading(false);
      return;
    }

    const fetchWorkspaceUser = async () => {
      try {
        // Get the owner_id using the security definer function
        const { data, error } = await supabase.rpc('get_owner_id', {
          _user_id: user.id,
        });

        if (error) {
          console.error('Error fetching workspace user:', error);
          setWorkspaceUserId(user.id);
          setIsTeamMember(false);
          setRole('owner');
          setCanViewFinancials(true);
        } else {
          const ownerId = data as string;
          const isMember = ownerId !== user.id;
          setWorkspaceUserId(ownerId);
          setIsTeamMember(isMember);

          if (isMember) {
            // Fetch the owner's branding/company info, and this member's role +
            // financial-visibility tier in the same pass.
            const [{ data: branding }, { data: membership }, { data: roleData }] = await Promise.all([
              supabase.from('branding_settings').select('company_name, support_email').eq('user_id', ownerId).maybeSingle(),
              supabase.from('team_members').select('can_view_financials').eq('member_id', user.id).eq('owner_id', ownerId).eq('status', 'active').maybeSingle(),
              supabase.rpc('get_workspace_role', { _user_id: user.id, _owner_id: ownerId }),
            ]);
            setOwnerEmail(branding?.support_email || branding?.company_name || null);
            setCanViewFinancials(membership?.can_view_financials ?? true);
            setRole((roleData as WorkspaceRole) || 'viewer');
          } else {
            setRole('owner');
            setCanViewFinancials(true);
          }
        }
      } catch (err) {
        console.error('Error in useWorkspaceUser:', err);
        setWorkspaceUserId(user.id);
        setIsTeamMember(false);
        setRole('owner');
        setCanViewFinancials(true);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaceUser();
  }, [user]);

  return {
    /** The user_id to use for all inserts — owner's ID if team member, own ID if owner */
    workspaceUserId: workspaceUserId || user?.id || null,
    /** Whether the current user is a team member (not the owner) */
    isTeamMember,
    /** Owner's company name or email for display */
    ownerInfo: ownerEmail,
    /** The caller's effective role within the workspace: 'owner' | 'admin' | 'editor' | 'viewer' */
    role,
    /** Whether the caller can see financial figures (contract value, invoice amounts, revenue widgets) */
    canViewFinancials,
    loading,
  };
}
