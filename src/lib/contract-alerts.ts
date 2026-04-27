import { differenceInCalendarDays } from 'date-fns';

export type ContractAlertKind = 'awaiting-approval' | 'renewal-due' | 'renewal-overdue';
export type ContractAlertInfo =
  | { kind: ContractAlertKind; severity: 'warning' | 'critical'; days: number; label: string }
  | null;

const APPROVAL_WINDOW_DAYS = 7;
const RENEWAL_WINDOW_DAYS = 60;

/**
 * Returns an alert descriptor for a contract based on its dates and status.
 *
 * - Awaiting approval (status: draft / sent / change_requested): triggers within
 *   {@link APPROVAL_WINDOW_DAYS} of the start_date — or after it has already passed.
 * - Renewal due / overdue (status: approved / active / pending-renewal): triggers
 *   within {@link RENEWAL_WINDOW_DAYS} of the end_date — or after it has already passed.
 * - Rejected and explicitly expired contracts never alert.
 */
export function getContractExpiryInfo(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  status: string,
): ContractAlertInfo {
  if (status === 'rejected' || status === 'expired') return null;

  const isUndecided = ['draft', 'sent', 'change_requested'].includes(status);
  const isLive = ['approved', 'active', 'pending-renewal'].includes(status);

  if (isUndecided && startDate) {
    const days = differenceInCalendarDays(new Date(startDate), new Date());
    if (days > APPROVAL_WINDOW_DAYS) return null;
    if (days < 0) {
      const abs = Math.abs(days);
      return {
        kind: 'awaiting-approval',
        severity: 'critical',
        days: abs,
        label: `Not yet approved — start date passed ${abs} day${abs === 1 ? '' : 's'} ago`,
      };
    }
    if (days === 0) {
      return {
        kind: 'awaiting-approval',
        severity: 'critical',
        days: 0,
        label: 'Not yet approved — starts today',
      };
    }
    return {
      kind: 'awaiting-approval',
      severity: 'warning',
      days,
      label: `Not yet approved — starts in ${days} day${days === 1 ? '' : 's'}`,
    };
  }

  if (isLive && endDate) {
    const days = differenceInCalendarDays(new Date(endDate), new Date());
    if (days > RENEWAL_WINDOW_DAYS) return null;
    if (days < 0) {
      const abs = Math.abs(days);
      return {
        kind: 'renewal-overdue',
        severity: 'critical',
        days: abs,
        label: `Renewal overdue by ${abs} day${abs === 1 ? '' : 's'}`,
      };
    }
    if (days === 0) {
      return { kind: 'renewal-due', severity: 'critical', days: 0, label: 'Renewal due today' };
    }
    return {
      kind: 'renewal-due',
      severity: 'warning',
      days,
      label: `Renewal due in ${days} day${days === 1 ? '' : 's'}`,
    };
  }

  return null;
}
