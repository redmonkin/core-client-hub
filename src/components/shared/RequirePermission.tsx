import { ReactNode } from 'react';
import { useWorkspaceUser, PermissionModule, PermissionAction } from '@/hooks/useWorkspaceUser';

interface RequirePermissionProps {
  module: PermissionModule;
  action: PermissionAction;
  children: ReactNode;
  /** Optional fallback to render when the permission isn't held (defaults to nothing). */
  fallback?: ReactNode;
}

/**
 * Client-side convenience gate for mutating UI (buttons, menu items, forms).
 * This is NOT the security boundary — RLS enforces the actual permission check
 * server-side via has_permission(). This component only avoids showing
 * controls a team member's permission matrix doesn't let them successfully use.
 */
export function RequirePermission({ module, action, children, fallback = null }: RequirePermissionProps) {
  const { can, loading } = useWorkspaceUser();

  if (loading) return null;
  if (!can(module, action)) return <>{fallback}</>;

  return <>{children}</>;
}
