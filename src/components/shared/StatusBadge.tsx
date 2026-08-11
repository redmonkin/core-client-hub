import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusType = 
  | 'active' | 'archived' 
  | 'proposal' | 'planned' | 'on-hold' | 'completed' | 'cancelled' | 'maintenance' | 'new-request'
  | 'draft' | 'sent' | 'approved' | 'rejected' | 'change_requested'
  | 'expired' | 'pending-renewal' | 'pending-review' | 'ended' | 'paid' | 'partial' | 'void' | 'overdue';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' }> = {
  active: { label: 'Active', variant: 'default' },
  archived: { label: 'Archived', variant: 'secondary' },
  proposal: { label: 'Proposal', variant: 'outline' },
  planned: { label: 'Planned', variant: 'outline' },
  'on-hold': { label: 'On Hold', variant: 'secondary' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  maintenance: { label: 'Maintenance', variant: 'secondary' },
  'new-request': { label: 'New Request', variant: 'outline' },
  draft: { label: 'Draft', variant: 'outline' },
  sent: { label: 'Sent', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  change_requested: { label: 'Change Requested', variant: 'secondary' },
  expired: { label: 'Expired', variant: 'destructive' },
  'pending-renewal': { label: 'Pending Renewal', variant: 'secondary' },
  'pending-review': { label: 'Pending Review', variant: 'outline' },
  ended: { label: 'Ended', variant: 'secondary' },
  paid: { label: 'Paid', variant: 'success' },
  partial: { label: 'Partially Paid', variant: 'secondary' },
  void: { label: 'Void', variant: 'outline' },
  overdue: { label: 'Overdue', variant: 'destructive' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: 'outline' as const };
  
  return (
    <Badge variant={config.variant} className={cn("capitalize", className)}>
      {config.label}
    </Badge>
  );
}
