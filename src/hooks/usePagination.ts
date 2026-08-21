import { useMemo, useState } from 'react';

export const DEFAULT_PAGE_SIZE = 10;

// Clamping page to pageCount (rather than resetting on every render) means a
// shrinking filtered/sorted list never strands the user past the last page
// without needing an effect keyed to filter state.
export function usePagination<T>(items: T[], pageSize: number = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );
  return { page: safePage, pageCount, pageItems, setPage, totalItems: items.length };
}
