// Shared accounting-period presets used across the Accounts page's Overview,
// Transactions, and Tax Deductions tabs, so "This Financial Year" etc. mean
// the same thing everywhere.

export type RangeKey = 'this_month' | 'last_3_months' | 'this_fy' | 'last_fy' | 'all_time' | 'custom';

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'this_fy', label: 'This Financial Year' },
  { value: 'last_fy', label: 'Last Financial Year' },
  { value: 'all_time', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

// Formats using the Date's local calendar fields, not toISOString()'s UTC
// conversion -- every Date here (new Date(y, m, 1), new Date(), etc.) is
// constructed in local time, and for any timezone ahead of UTC (e.g. IST,
// UTC+5:30), converting local midnight to UTC rolls it back to the previous
// day. That silently shifted every range boundary back by a day, which at a
// month boundary (like the April 1 financial-year start) turned into a
// whole month off -- the Overview chart showed Mar-Feb instead of Apr-Mar.
export const toIso = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// India financial year: April 1 - March 31. Returns the calendar year the
// financial year containing `d` started in.
export const fyStartYear = (d: Date) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);

// Stand-in for "the beginning of time" for the All Time preset -- a fixed
// date well before this app could have any data, rather than needing to
// query for the earliest record.
const EARLIEST = new Date(2000, 0, 1);

export function getPresetRange(range: Exclude<RangeKey, 'custom'>): { start: Date; end: Date } {
  const end = new Date();
  switch (range) {
    case 'this_month':
      return { start: new Date(end.getFullYear(), end.getMonth(), 1), end };
    case 'last_3_months':
      return { start: new Date(end.getFullYear(), end.getMonth() - 2, 1), end };
    case 'this_fy': {
      const y = fyStartYear(end);
      return { start: new Date(y, 3, 1), end };
    }
    case 'last_fy': {
      const y = fyStartYear(end) - 1;
      return { start: new Date(y, 3, 1), end: new Date(y + 1, 2, 31) };
    }
    case 'all_time':
      return { start: EARLIEST, end };
  }
}

const todayIso = () => toIso(new Date());
const defaultCustomStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return toIso(d);
};

/** Resolves the active {start, end} Date range for a RangeKey, given the
 * custom start/end iso-date strings (used only when range === 'custom'). */
export function resolveRange(range: RangeKey, customStart: string, customEnd: string): { start: Date; end: Date } {
  if (range !== 'custom') return getPresetRange(range);
  const valid = customStart && customEnd && customStart <= customEnd;
  return valid ? { start: new Date(customStart), end: new Date(customEnd) } : { start: new Date(defaultCustomStart()), end: new Date(todayIso()) };
}

export { todayIso, defaultCustomStart };
