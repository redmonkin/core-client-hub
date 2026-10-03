import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowDownCircle, ArrowUpCircle, Loader2, Search, Receipt as ReceiptIcon } from 'lucide-react';
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
import { CATEGORY_LABELS } from '@/components/invoices/Expenses';
import { type RangeKey, RANGE_OPTIONS, toIso, resolveRange, defaultCustomStart, todayIso } from '@/lib/date-ranges';

type TypeFilter = 'all' | 'payment' | 'expense';
type LedgerSortKey = 'date' | 'description' | 'amount' | 'balance';

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All Transactions' },
  { value: 'payment', label: 'Payments Received' },
  { value: 'expense', label: 'Expenses' },
];

interface TransactionRow {
  id: string;
  date: string;
  type: 'payment' | 'expense';
  description: string;
  amount: number; // signed: +received, -expense
}

export function TransactionsLedger() {
  const { workspaceUserId, canViewFinancials } = useWorkspaceUser();
  const [range, setRange] = useState<RangeKey>('this_fy');
  const [customStart, setCustomStart] = useState(defaultCustomStart);
  const [customEnd, setCustomEnd] = useState(todayIso);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState<LedgerSortKey>>({ key: 'date', direction: 'desc' });

  const { start, end } = resolveRange(range, customStart, customEnd);
  const customRangeValid = customStart && customEnd && customStart <= customEnd;
  const startIso = toIso(start);
  const endIso = toIso(end);

  const { data: paymentRows = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['ledger-payments', workspaceUserId, startIso, endIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_payments')
        .select('id, amount, payment_date, payment_mode, invoices(invoice_number, client_id, clients(client_name, company_name))')
        .gte('payment_date', startIso)
        .lte('payment_date', endIso);
      if (error) throw error;
      return data as {
        id: string; amount: number; payment_date: string; payment_mode: string | null;
        invoices: { invoice_number: string; client_id: string; clients: { client_name: string | null; company_name: string | null } | null } | null;
      }[];
    },
    enabled: !!workspaceUserId && canViewFinancials,
  });

  const { data: expenseRows = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['ledger-expenses', workspaceUserId, startIso, endIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, amount, expense_date, category, vendor, description')
        .gte('expense_date', startIso)
        .lte('expense_date', endIso);
      if (error) throw error;
      return data as { id: string; amount: number; expense_date: string; category: string; vendor: string | null; description: string | null }[];
    },
    enabled: !!workspaceUserId && canViewFinancials,
  });

  // The running "Balance" column must reflect the actual account balance,
  // not reset to zero at the start of whatever date filter is selected --
  // otherwise switching to "This Financial Year" makes every balance wrong
  // by the account's entire pre-FY history. Pull just the two sums needed
  // to seed it (everything strictly before the filtered window starts),
  // not full row data.
  const { data: openingBalance = 0, isLoading: loadingOpeningBalance } = useQuery({
    queryKey: ['ledger-opening-balance', workspaceUserId, startIso],
    queryFn: async () => {
      const [{ data: priorPayments, error: paymentsError }, { data: priorExpenses, error: expensesError }] = await Promise.all([
        supabase.from('invoice_payments').select('amount').lt('payment_date', startIso),
        supabase.from('expenses').select('amount').lt('expense_date', startIso),
      ]);
      if (paymentsError) throw paymentsError;
      if (expensesError) throw expensesError;
      const priorReceived = (priorPayments || []).reduce((acc, p) => acc + p.amount, 0);
      const priorSpent = (priorExpenses || []).reduce((acc, e) => acc + e.amount, 0);
      return priorReceived - priorSpent;
    },
    enabled: !!workspaceUserId && canViewFinancials,
  });

  const isLoading = loadingPayments || loadingExpenses || loadingOpeningBalance;

  const fromPayments: TransactionRow[] = paymentRows.map((p) => {
    const client = p.invoices?.clients;
    const clientName = client?.client_name || client?.company_name || 'Unknown Client';
    return {
      id: `payment-${p.id}`,
      date: p.payment_date,
      type: 'payment',
      // Cash actually received into the bank -- tax withheld by the client
      // never hit the account, so it's excluded here (it's tracked
      // separately on the Tax Deductions tab).
      description: `Payment received — Invoice ${p.invoices?.invoice_number || '—'} (${clientName})`,
      amount: p.amount,
    };
  });
  const fromExpenses: TransactionRow[] = expenseRows.map((e) => ({
    id: `expense-${e.id}`,
    date: e.expense_date,
    type: 'expense',
    description: `${CATEGORY_LABELS[e.category] || e.category} — ${e.vendor || e.description || 'Expense'}`,
    amount: -e.amount,
  }));
  // Ascending by date (ties broken by id for stability) so the running
  // balance accumulates in chronological order.
  const transactions = [...fromPayments, ...fromExpenses].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));

  let running = openingBalance;
  const withBalance = transactions.map((t) => {
    running += t.amount;
    return { ...t, balance: running };
  });

  const totalReceived = transactions.filter((t) => t.type === 'payment').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = -transactions.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  const ledgerSortValue = (t: (typeof withBalance)[number], key: LedgerSortKey): string | number => {
    switch (key) {
      case 'date': return t.date;
      case 'description': return t.description;
      case 'amount': return t.amount;
      case 'balance': return t.balance;
    }
  };

  const filtered = withBalance
    .filter((t) => typeFilter === 'all' || t.type === typeFilter)
    .filter((t) => !search.trim() || t.description.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      const cmp = compareValues(ledgerSortValue(a, sort.key), ledgerSortValue(b, sort.key));
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  const ledgerPagination = usePagination(filtered, DEFAULT_PAGE_SIZE);

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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11" />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
                <p className="text-sm font-medium text-muted-foreground">Total Received</p>
                <p className="mt-2 text-2xl font-bold text-green-700">{formatInvoiceCurrency(totalReceived)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                <p className="mt-2 text-2xl font-bold text-destructive">{formatInvoiceCurrency(totalExpenses)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Closing Balance</p>
                <p className="mt-2 text-2xl font-bold">{formatInvoiceCurrency(openingBalance + totalReceived - totalExpenses)}</p>
              </CardContent>
            </Card>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={ReceiptIcon}
              title="No transactions in this period"
              description="Payments received and expenses logged will show up here together as a statement."
            />
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead label="Date" sortKey="date" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="w-28" />
                      <SortableTableHead label="Description" sortKey="description" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} />
                      <SortableTableHead label="Amount" sortKey="amount" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="w-36 text-right" align="right" />
                      <SortableTableHead label="Balance" sortKey="balance" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="hidden w-36 text-right sm:table-cell" align="right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerPagination.pageItems.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(t.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {t.type === 'payment' ? (
                              <ArrowUpCircle className="h-4 w-4 shrink-0 text-green-600" />
                            ) : (
                              <ArrowDownCircle className="h-4 w-4 shrink-0 text-destructive" />
                            )}
                            <span className="truncate">{t.description}</span>
                          </div>
                        </TableCell>
                        <TableCell className={`whitespace-nowrap text-right font-medium tabular-nums ${t.type === 'payment' ? 'text-green-700' : 'text-destructive'}`}>
                          {t.type === 'payment' ? '+' : '-'}{formatInvoiceCurrency(Math.abs(t.amount))}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-right tabular-nums text-muted-foreground sm:table-cell">{formatInvoiceCurrency(t.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <TablePagination
                page={ledgerPagination.page}
                pageCount={ledgerPagination.pageCount}
                totalItems={ledgerPagination.totalItems}
                pageSize={DEFAULT_PAGE_SIZE}
                onPageChange={ledgerPagination.setPage}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
