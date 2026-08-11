import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc';
export interface SortState<T extends string> {
  key: T;
  direction: SortDirection;
}

/** Toggles: unsorted/other column -> asc -> desc -> asc ... */
export function toggleSort<T extends string>(current: SortState<T> | null, key: T): SortState<T> {
  if (current?.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  return { key, direction: 'asc' };
}

export function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

interface SortableTableHeadProps<T extends string> {
  label: string;
  sortKey: T;
  sort: SortState<T> | null;
  onSort: (key: T) => void;
  className?: string;
  align?: 'left' | 'right';
}

export function SortableTableHead<T extends string>({ label, sortKey, sort, onSort, className, align = 'left' }: SortableTableHeadProps<T>) {
  const isActive = sort?.key === sortKey;
  const Icon = isActive ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground transition-colors',
          isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
          align === 'right' && 'flex-row-reverse',
        )}
      >
        {label}
        <Icon className={cn('h-3.5 w-3.5', !isActive && 'opacity-40')} />
      </button>
    </TableHead>
  );
}
