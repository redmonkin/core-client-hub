import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

interface WorkspaceUserData {
  workspaceUserId: string;
  isTeamMember: boolean;
  ownerInfo: string | null;
  role: WorkspaceRole;
  canViewFinancials: boolean;
}

/**
 * Cached via react-query (keyed by user id) so the multiple call sites that
 * need this per page (e.g. a page's own canViewFinancials check plus a
 * <RequireRole> gate) share one fetch instead of each running their own
 * uncached effect.
 */
export function useWorkspaceUser() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['workspace-user', user?.id],
    queryFn: async (): Promise<WorkspaceUserData> => {
      const fallback: WorkspaceUserData = {
        workspaceUserId: user!.id,
        isTeamMember: false,
        ownerInfo: null,
        role: 'owner',
        canViewFinancials: true,
      };

      try {
        // Get the owner_id using the security definer function
        const { data: ownerData, error } = await supabase.rpc('get_owner_id', {
          _user_id: user!.id,
        });

        if (error) {
          console.error('Error fetching workspace user:', error);
          return fallback;
        }

        const ownerId = ownerData as string;
        const isMember = ownerId !== user!.id;

        if (!isMember) {
          return { ...fallback, workspaceUserId: ownerId };
        }

        // Fetch the owner's branding/company info, and this member's role +
        // financial-visibility tier (both live directly on the team_members
        // row — no need for a separate get_workspace_role() round-trip here
        // since we already know which membership row applies).
        const [{ data: branding }, { data: membership }] = await Promise.all([
          supabase.from('branding_settings').select('company_name, support_email').eq('user_id', ownerId).maybeSingle(),
          supabase.from('team_members').select('role, can_view_financials').eq('member_id', user!.id).eq('owner_id', ownerId).eq('status', 'active').maybeSingle(),
        ]);

        return {
          workspaceUserId: ownerId,
          isTeamMember: true,
          ownerInfo: branding?.support_email || branding?.company_name || null,
          role: (membership?.role as WorkspaceRole) || 'viewer',
          canViewFinancials: membership?.can_view_financials ?? true,
        };
      } catch (err) {
        console.error('Error in useWorkspaceUser:', err);
        return fallback;
      }
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  return {
    /** The user_id to use for all inserts — owner's ID if team member, own ID if owner */
    workspaceUserId: data?.workspaceUserId || user?.id || null,
    /** Whether the current user is a team member (not the owner) */
    isTeamMember: data?.isTeamMember ?? false,
    /** Owner's company name or email for display */
    ownerInfo: data?.ownerInfo ?? null,
    /** The caller's effective role within the workspace: 'owner' | 'admin' | 'editor' | 'viewer' */
    role: data?.role ?? 'owner',
    /** Whether the caller can see financial figures (contract value, invoice amounts, revenue widgets) */
    canViewFinancials: data?.canViewFinancials ?? true,
    loading: !!user && isLoading,
  };
}
