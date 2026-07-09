import { Lock } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export function NoAccessState({ moduleLabel }: { moduleLabel: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="Access restricted"
      description={`You don't have permission to view ${moduleLabel}. Ask your workspace owner or an admin to grant access.`}
    />
  );
}
