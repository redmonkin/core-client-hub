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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatInvoiceCurrency } from '@/lib/invoice-utils';
import { CATEGORY_LABELS } from '@/components/invoices/Expenses';
import { type RangeKey, RANGE_OPTIONS, toIso, resolveRange, defaultCustomStart, todayIso } from '@/lib/date-ranges';

type TypeFilter = 'all' | 'payment' | 'expense';

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
  const [range, setRange] = useState<RangeKey>('all_time');
  const [customStart, setCustomStart] = useState(defaultCustomStart);
  const [customEnd, setCustomEnd] = useState(todayIso);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');

  const { start, end } = resolveRange(range, customStart, customEnd);
  const customRangeValid = customStart && customEnd && customStart <= customEnd;
  const startIso = toIso(start);
  const endIso = toIso(end);

  const { data: paymentRows = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['ledger-payments', workspaceUserId, startIso, endIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_payments')
        .select('id, amount, tax_deducted_amount, payment_date, payment_mode, invoices(invoice_number, client_id, clients(client_name, company_name))')
        .gte('payment_date', startIso)
        .lte('payment_date', endIso);
      if (error) throw error;
      return data as {
        id: string; amount: number; tax_deducted_amount: number; payment_date: string; payment_mode: string | null;
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

  if (!canViewFinancials) {
    return <NoAccessState moduleLabel="financial figures" />;
  }

  const isLoading = loadingPayments || loadingExpenses;

  const fromPayments: TransactionRow[] = paymentRows.map((p) => {
    const client = p.invoices?.clients;
    const clientName = client?.client_name || client?.company_name || 'Unknown Client';
    const settled = p.amount + (p.tax_deducted_amount || 0);
    return {
      id: `payment-${p.id}`,
      date: p.payment_date,
      type: 'payment',
      description: `Payment received — Invoice ${p.invoices?.invoice_number || '—'} (${clientName})`,
      amount: settled,
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

  let running = 0;
  const withBalance = transactions.map((t) => {
    running += t.amount;
    return { ...t, balance: running };
  });

  const totalReceived = transactions.filter((t) => t.type === 'payment').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = -transactions.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  const filtered = withBalance
    .filter((t) => typeFilter === 'all' || t.type === typeFilter)
    .filter((t) => !search.trim() || t.description.toLowerCase().includes(search.trim().toLowerCase()))
    .reverse(); // most recent first, balance still reflects chronological position

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Total Received</p>
                <p className="mt-2 text-2xl font-bold text-green-600">{formatInvoiceCurrency(totalReceived)}</p>
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
                <p className="text-sm font-medium text-muted-foreground">Net</p>
                <p className="mt-2 text-2xl font-bold">{formatInvoiceCurrency(totalReceived - totalExpenses)}</p>
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
                      <TableHead className="w-28">Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-36 text-right">Amount</TableHead>
                      <TableHead className="w-36 text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-muted-foreground">{format(new Date(t.date), 'MMM d, yyyy')}</TableCell>
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
                        <TableCell className={`text-right font-medium ${t.type === 'payment' ? 'text-green-600' : 'text-destructive'}`}>
                          {t.type === 'payment' ? '+' : '-'}{formatInvoiceCurrency(Math.abs(t.amount))}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatInvoiceCurrency(t.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
