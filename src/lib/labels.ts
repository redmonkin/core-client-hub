// Display labels shared across pages. Keep new enum values here rather than
// in per-page maps, so lists, detail pages and the dashboard agree.

/** "change_requested" / "pending-renewal" -> "Change requested" / "Pending renewal". */
export const humanize = (value: string | null | undefined): string =>
  value ? value.replace(/[_-]+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase()) : '';

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  amc: 'Annual Maintenance Contract',
  fixed: 'Fixed Contract',
  retainer: 'Retainer Contract',
};

export const RENEWAL_LABELS: Record<string, string> = {
  '1-month': '1 Month',
  '3-months': '3 Months',
  '6-months': '6 Months',
  '1-year': '1 Year',
  '3-years': '3 Years',
  // Legacy values
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  'one-time': 'One-time',
  amc: 'AMC',
  retainer: 'Retainer',
  hourly: 'Hourly',
};

export const contractTypeLabel = (type: string | null | undefined) => CONTRACT_TYPE_LABELS[type ?? ''] ?? humanize(type);
export const renewalLabel = (frequency: string | null | undefined) => RENEWAL_LABELS[frequency ?? ''] ?? humanize(frequency);
export const projectTypeLabel = (type: string | null | undefined) => PROJECT_TYPE_LABELS[type ?? ''] ?? humanize(type);

/**
 * Contracts have no title column; name them by type plus what they're for,
 * so two "Fixed Contract" rows can be told apart.
 */
export const contractTitle = (type: string | null | undefined, context?: string | null) =>
  context ? `${contractTypeLabel(type)} · ${context}` : contractTypeLabel(type);
