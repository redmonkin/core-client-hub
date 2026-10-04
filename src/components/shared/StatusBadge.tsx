import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type StatusType = 
  | 'active' | 'archived' 
  | 'proposal' | 'planned' | 'on-hold' | 'completed' | 'cancelled' | 'maintenance' | 'new-request'
  | 'draft' | 'sent' | 'approved' | 'rejected' | 'change_requested'
  | 'expired' | 'pending-renewal' | 'pending-review' | 'ended' | 'paid' | 'partial' | 'void' | 'overdue';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; className?: string }> = {
  active: { label: 'Active', variant: 'default' },
  archived: { label: 'Archived', variant: 'secondary' },
  proposal: { label: 'Proposal', variant: 'outline' },
  planned: { label: 'Planned', variant: 'outline' },
  'on-hold': { label: 'On Hold', variant: 'secondary' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  maintenance: { label: 'Maintenance', variant: 'secondary' },
  'new-request': { label: 'New Request', variant: 'warning' },
  draft: { label: 'Draft', variant: 'outline' },
  sent: { label: 'Sent', variant: 'default' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  change_requested: { label: 'Changes Requested', variant: 'warning' },
  expired: { label: 'Expired', variant: 'destructive' },
  'pending-renewal': { label: 'Pending Renewal', variant: 'warning' },
  'pending-review': { label: 'Pending Review', variant: 'warning' },
  ended: { label: 'Ended', variant: 'secondary' },
  paid: { label: 'Paid', variant: 'success' },
  partial: { label: 'Partially Paid', variant: 'warning' },
  void: { label: 'Void', variant: 'secondary', className: 'line-through' },
  overdue: { label: 'Overdue', variant: 'destructive' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  // Unknown values still read as words ("change_requested" -> "change requested").
  const config = statusConfig[status] || { label: String(status).replace(/[_-]+/g, ' '), variant: 'outline' as const };

  return (
    <Badge variant={config.variant} className={cn("capitalize", config.className, className)}>
      {config.label}
    </Badge>
  );
}
