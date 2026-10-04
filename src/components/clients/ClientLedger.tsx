import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle, Loader2, Receipt as ReceiptIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { NoAccessState } from '@/components/shared/NoAccessState';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead, toggleSort, compareValues, type SortState } from '@/components/shared/SortableTableHead';
import { TablePagination } from '@/components/shared/TablePagination';
import { usePagination, DEFAULT_PAGE_SIZE } from '@/hooks/usePagination';
import { formatInvoiceCurrency } from '@/lib/invoice-utils';
import { type RangeKey, RANGE_OPTIONS, toIso, resolveRange, defaultCustomStart, todayIso } from '@/lib/date-ranges';

type LedgerSortKey = 'date' | 'description' | 'debit' | 'credit' | 'balance';

interface LedgerEntry {
  id: string;
  date: string;
  type: 'invoice' | 'payment';
  description: string;
  href?: string;
  debit: number; // amount invoiced
  credit: number; // amount settled (cash + tax withheld)
}

interface ClientLedgerProps {
  clientId: string;
}

export function ClientLedger({ clientId }: ClientLedgerProps) {
  const { canViewFinancials } = useWorkspaceUser();
  const [range, setRange] = useState<RangeKey>('this_fy');
  const [customStart, setCustomStart] = useState(defaultCustomStart);
  const [customEnd, setCustomEnd] = useState(todayIso);
  const [sort, setSort] = useState<SortState<LedgerSortKey>>({ key: 'date', direction: 'desc' });

  const { start, end } = resolveRange(range, customStart, customEnd);
  const customRangeValid = customStart && customEnd && customStart <= customEnd;
  const startIso = toIso(start);
  const endIso = toIso(end);

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['client-ledger-invoices', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, issued_date, invoice_amounts(total_amount)')
        .eq('client_id', clientId)
        .not('status', 'in', '(void,draft)');
      if (error) throw error;
      return data as { id: string; invoice_number: string; issued_date: string; invoice_amounts: { total_amount: number } | { total_amount: number }[] | null }[];
    },
    enabled: !!clientId && canViewFinancials,
  });

  const invoiceIds = invoices.map((i) => i.id);
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['client-ledger-payments', clientId, invoiceIds.join(',')],
    queryFn: async () => {
      if (invoiceIds.length === 0) return [];
      const { data, error } = await supabase
        .from('invoice_payments')
        .select('id, amount, tax_deducted_amount, payment_date, invoice_id')
        .in('invoice_id', invoiceIds);
      if (error) throw error;
      return data as { id: string; amount: number; tax_deducted_amount: number; payment_date: string; invoice_id: string }[];
    },
    enabled: invoiceIds.length > 0 && canViewFinancials,
  });

  const isLoading = loadingInvoices || loadingPayments;

  const invoiceAmount = (inv: (typeof invoices)[number]): number => {
    const a = inv.invoice_amounts;
    if (!a) return 0;
    return Array.isArray(a) ? (a[0]?.total_amount ?? 0) : a.total_amount;
  };

  const allEntries: LedgerEntry[] = [
    ...invoices.map((inv): LedgerEntry => ({
      id: `invoice-${inv.id}`,
      date: inv.issued_date,
      type: 'invoice',
      description: `Invoice ${inv.invoice_number}`,
      href: '/accounts',
      debit: invoiceAmount(inv),
      credit: 0,
    })),
    // Settled by the full amount the invoice was credited for (cash received
    // + tax withheld), not just cash -- the withheld portion still reduces
    // what the client owes, same convention record_invoice_payment() uses.
    ...payments.map((p): LedgerEntry => ({
      id: `payment-${p.id}`,
      date: p.payment_date,
      type: 'payment',
      description: `Payment — ${invoiceById.get(p.invoice_id)?.invoice_number || 'Invoice'}`,
      debit: 0,
      credit: p.amount + p.tax_deducted_amount,
    })),
  ].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));

  const openingBalance = allEntries
    .filter((e) => e.date < startIso)
    .reduce((acc, e) => acc + e.debit - e.credit, 0);

  const periodEntries = allEntries.filter((e) => e.date >= startIso && e.date <= endIso);

  let running = openingBalance;
  const withBalance = periodEntries.map((e) => {
    running += e.debit - e.credit;
    return { ...e, balance: running };
  });

  const totalInvoiced = periodEntries.reduce((acc, e) => acc + e.debit, 0);
  const totalReceived = periodEntries.reduce((acc, e) => acc + e.credit, 0);
  const closingBalance = openingBalance + totalInvoiced - totalReceived;

  const ledgerSortValue = (e: (typeof withBalance)[number], key: LedgerSortKey): string | number => {
    switch (key) {
      case 'date': return e.date;
      case 'description': return e.description;
      case 'debit': return e.debit;
      case 'credit': return e.credit;
      case 'balance': return e.balance;
    }
  };
  const sortedEntries = [...withBalance].sort((a, b) => {
    const cmp = compareValues(ledgerSortValue(a, sort.key), ledgerSortValue(b, sort.key));
    return sort.direction === 'asc' ? cmp : -cmp;
  });
  const entriesPagination = usePagination(sortedEntries, DEFAULT_PAGE_SIZE);

  if (!canViewFinancials) {
    return <NoAccessState moduleLabel="financial figures" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {format(start, 'MMM d, yyyy')} – {format(end, 'MMM d, yyyy')}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {range === 'custom' && (
            <>
              <Input type="date" value={customStart} max={customEnd || undefined} onChange={(e) => setCustomStart(e.target.value)} className="w-40" />
              <span className="text-sm text-muted-foreground">to</span>
              <Input type="date" value={customEnd} min={customStart || undefined} onChange={(e) => setCustomEnd(e.target.value)} className="w-40" />
            </>
          )}
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {range === 'custom' && !customRangeValid && (
        <p className="text-sm text-destructive">Start date must be on or before the end date.</p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Opening Balance</p>
                <p className="mt-2 text-2xl font-bold">{formatInvoiceCurrency(openingBalance)}</p>
                <p className="mt-1 text-xs text-muted-foreground">as of {format(start, 'MMM d, yyyy')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Invoiced</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{formatInvoiceCurrency(totalInvoiced)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Received</p>
                <p className="mt-2 text-2xl font-bold text-green-700">{formatInvoiceCurrency(totalReceived)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Outstanding Balance</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{formatInvoiceCurrency(closingBalance)}</p>
                <p className="mt-1 text-xs text-muted-foreground">as of {format(end, 'MMM d, yyyy')}</p>
              </CardContent>
            </Card>
          </div>

          {periodEntries.length === 0 ? (
            <EmptyState
              icon={ReceiptIcon}
              title="No activity in this period"
              description="Invoices issued and payments received for this client will show up here together as a statement."
            />
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead label="Date" sortKey="date" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="w-28" />
                      <SortableTableHead label="Description" sortKey="description" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} />
                      <SortableTableHead label="Invoiced" sortKey="debit" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="w-32 text-right" align="right" />
                      <SortableTableHead label="Received" sortKey="credit" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="w-32 text-right" align="right" />
                      <SortableTableHead label="Balance" sortKey="balance" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="w-36 text-right" align="right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesPagination.pageItems.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(e.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {e.type === 'invoice' ? (
                              <ArrowUpCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ArrowDownCircle className="h-4 w-4 shrink-0 text-green-600" />
                            )}
                            {e.href ? (
                              <Link to={e.href} className="truncate hover:text-primary hover:underline">{e.description}</Link>
                            ) : (
                              <span className="truncate">{e.description}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{e.debit > 0 ? formatInvoiceCurrency(e.debit) : '—'}</TableCell>
                        <TableCell className="text-right font-medium text-green-700">{e.credit > 0 ? formatInvoiceCurrency(e.credit) : '—'}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatInvoiceCurrency(e.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <TablePagination
                page={entriesPagination.page}
                pageCount={entriesPagination.pageCount}
                totalItems={entriesPagination.totalItems}
                pageSize={DEFAULT_PAGE_SIZE}
                onPageChange={entriesPagination.setPage}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
