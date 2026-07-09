import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'contributor' | 'viewer' | 'custom';
export type PermissionModule = 'clients' | 'projects' | 'proposals' | 'contracts' | 'templates' | 'timesheets' | 'invoices' | 'notes';
export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

export const PERMISSION_MODULES: PermissionModule[] = ['clients', 'projects', 'proposals', 'contracts', 'templates', 'timesheets', 'invoices', 'notes'];
export const PERMISSION_ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete'];

export type PermissionMatrix = Record<PermissionModule, Record<PermissionAction, boolean>>;

export const fullAccessMatrix = (): PermissionMatrix =>
  Object.fromEntries(
    PERMISSION_MODULES.map((m) => [m, { create: true, read: true, update: true, delete: true }])
  ) as PermissionMatrix;

export const noAccessMatrix = (): PermissionMatrix =>
  Object.fromEntries(
    PERMISSION_MODULES.map((m) => [m, { create: false, read: false, update: false, delete: false }])
  ) as PermissionMatrix;

export const readOnlyMatrix = (): PermissionMatrix =>
  Object.fromEntries(
    PERMISSION_MODULES.map((m) => [m, { create: false, read: true, update: false, delete: false }])
  ) as PermissionMatrix;

interface WorkspaceUserData {
  workspaceUserId: string;
  isTeamMember: boolean;
  ownerInfo: string | null;
  role: WorkspaceRole;
  canViewFinancials: boolean;
  permissions: PermissionMatrix;
}

/**
 * Cached via react-query (keyed by user id) so the multiple call sites that
 * need this per page (e.g. a page's own canViewFinancials check plus a
 * <RequirePermission> gate) share one fetch instead of each running their own
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
        permissions: fullAccessMatrix(),
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
        // financial-visibility tier + id (to look up their permission matrix).
        const [{ data: branding }, { data: membership }] = await Promise.all([
          supabase.from('branding_settings').select('company_name, support_email').eq('user_id', ownerId).maybeSingle(),
          supabase.from('team_members').select('id, role, can_view_financials').eq('member_id', user!.id).eq('owner_id', ownerId).eq('status', 'active').maybeSingle(),
        ]);

        const permissions = noAccessMatrix();
        if (membership?.id) {
          const { data: rows } = await supabase
            .from('team_member_permissions')
            .select('module, can_create, can_read, can_update, can_delete')
            .eq('team_member_id', membership.id);
          for (const row of rows || []) {
            const mod = row.module as PermissionModule;
            if (!PERMISSION_MODULES.includes(mod)) continue;
            permissions[mod] = {
              create: row.can_create,
              read: row.can_read,
              update: row.can_update,
              delete: row.can_delete,
            };
          }
        }

        return {
          workspaceUserId: ownerId,
          isTeamMember: true,
          ownerInfo: branding?.support_email || branding?.company_name || null,
          role: (membership?.role as WorkspaceRole) || 'viewer',
          canViewFinancials: membership?.can_view_financials ?? true,
          permissions,
        };
      } catch (err) {
        console.error('Error in useWorkspaceUser:', err);
        return fallback;
      }
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Fail closed while the query is loading (and for the brief window before an
  // owner's fullAccessMatrix() resolves) rather than defaulting to full access —
  // otherwise a restricted team member briefly appears to have every permission
  // on first render, before their real matrix arrives.
  const permissions = data?.permissions ?? noAccessMatrix();

  return {
    /** The user_id to use for all inserts — owner's ID if team member, own ID if owner */
    workspaceUserId: data?.workspaceUserId || user?.id || null,
    /** Whether the current user is a team member (not the owner) */
    isTeamMember: data?.isTeamMember ?? false,
    /** Owner's company name or email for display */
    ownerInfo: data?.ownerInfo ?? null,
    /** The caller's role/preset label: 'owner' | 'admin' | 'manager' | 'contributor' | 'viewer' | 'custom' */
    role: data?.role ?? 'owner',
    /** Whether the caller can see financial figures (contract value, invoice amounts, revenue widgets) */
    canViewFinancials: data?.canViewFinancials ?? true,
    /** Full per-module CRUD matrix for the caller */
    permissions,
    /** Convenience check: does the caller have `action` on `module`? */
    can: (module: PermissionModule, action: PermissionAction) => permissions[module]?.[action] ?? false,
    loading: !!user && isLoading,
  };
}
