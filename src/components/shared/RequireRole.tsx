import { ReactNode } from 'react';
import { useWorkspaceUser, WorkspaceRole } from '@/hooks/useWorkspaceUser';

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

interface RequireRoleProps {
  /** Minimum role required to render children (e.g. "editor" also allows admin/owner). */
  atLeast: WorkspaceRole;
  children: ReactNode;
  /** Optional fallback to render when the role requirement isn't met (defaults to nothing). */
  fallback?: ReactNode;
}

/**
 * Client-side convenience gate for mutating UI (buttons, menu items, forms).
 * This is NOT the security boundary — RLS enforces the actual permission check
 * server-side. This component only avoids showing controls a viewer/editor
 * can't successfully use.
 */
export function RequireRole({ atLeast, children, fallback = null }: RequireRoleProps) {
  const { role, loading } = useWorkspaceUser();

  if (loading) return null;
  if (ROLE_RANK[role] < ROLE_RANK[atLeast]) return <>{fallback}</>;

  return <>{children}</>;
}
