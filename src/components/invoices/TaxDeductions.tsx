import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, Landmark } from 'lucide-react';
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

type TaxSortKey = 'payment_date' | 'invoice_number' | 'client_name' | 'amount' | 'tax_deducted_amount' | 'reference_number';

interface TaxDeductionRow {
  id: string;
  payment_date: string;
  amount: number;
  tax_deducted_amount: number;
  reference_number: string | null;
  invoice_number: string;
  client_name: string;
}

export function TaxDeductions() {
  const { workspaceUserId, canViewFinancials } = useWorkspaceUser();
  const [range, setRange] = useState<RangeKey>('this_fy');
  const [customStart, setCustomStart] = useState(defaultCustomStart);
  const [customEnd, setCustomEnd] = useState(todayIso);
  const [sort, setSort] = useState<SortState<TaxSortKey>>({ key: 'payment_date', direction: 'desc' });

  const { start, end } = resolveRange(range, customStart, customEnd);
  const customRangeValid = customStart && customEnd && customStart <= customEnd;
  const startIso = toIso(start);
  const endIso = toIso(end);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['tax-deductions', workspaceUserId, startIso, endIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_payments')
        .select('id, payment_date, amount, tax_deducted_amount, reference_number, invoices(invoice_number, clients(client_name, company_name))')
        .gte('payment_date', startIso)
        .lte('payment_date', endIso)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return (data as {
        id: string; payment_date: string; amount: number; tax_deducted_amount: number; reference_number: string | null;
        invoices: { invoice_number: string; clients: { client_name: string | null; company_name: string | null } | null } | null;
      }[]).map((r): TaxDeductionRow => ({
        id: r.id,
        payment_date: r.payment_date,
        amount: r.amount,
        tax_deducted_amount: r.tax_deducted_amount,
        reference_number: r.reference_number,
        invoice_number: r.invoices?.invoice_number || '—',
        client_name: r.invoices?.clients?.client_name || r.invoices?.clients?.company_name || 'Unknown Client',
      }));
    },
    enabled: !!workspaceUserId && canViewFinancials,
  });

  const totalTaxDeducted = rows.reduce((acc, r) => acc + r.tax_deducted_amount, 0);
  const totalReceivedGross = rows.reduce((acc, r) => acc + r.amount + r.tax_deducted_amount, 0);
  const totalNetCash = totalReceivedGross - totalTaxDeducted;

  const taxSortValue = (r: TaxDeductionRow, key: TaxSortKey): string | number => {
    switch (key) {
      case 'payment_date': return r.payment_date;
      case 'invoice_number': return r.invoice_number;
      case 'client_name': return r.client_name;
      case 'amount': return r.amount;
      case 'tax_deducted_amount': return r.tax_deducted_amount;
      case 'reference_number': return r.reference_number || '';
    }
  };
  const sortedRows = [...rows].sort((a, b) => {
    const cmp = compareValues(taxSortValue(a, sort.key), taxSortValue(b, sort.key));
    return sort.direction === 'asc' ? cmp : -cmp;
  });
  const rowsPagination = usePagination(sortedRows, DEFAULT_PAGE_SIZE);

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

      <p className="text-xs text-muted-foreground">
        Every payment received this period, with any tax withheld by the client (TDS) broken out — the claimable amount when filing your ITR.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No payments in this period"
          description="Payments recorded against invoices will show up here, with any tax withheld (TDS) broken out."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Total Received (Gross)</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{formatInvoiceCurrency(totalReceivedGross)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Cash received + tax withheld</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Net Cash Received</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{formatInvoiceCurrency(totalNetCash)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Gross minus tax withheld</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Total Tax Deducted (Claimable)</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{formatInvoiceCurrency(totalTaxDeducted)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead label="Date" sortKey="payment_date" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="w-28" />
                    <SortableTableHead label="Invoice" sortKey="invoice_number" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} />
                    <SortableTableHead label="Client" sortKey="client_name" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} />
                    <SortableTableHead label="Amount Received" sortKey="amount" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="w-32 text-right" align="right" />
                    <SortableTableHead label="Tax Deducted" sortKey="tax_deducted_amount" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="w-32 text-right" align="right" />
                    <SortableTableHead label="Reference #" sortKey="reference_number" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="min-w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsPagination.pageItems.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">{format(new Date(r.payment_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="font-medium">{r.invoice_number}</TableCell>
                      <TableCell>{r.client_name}</TableCell>
                      <TableCell className="text-right">{formatInvoiceCurrency(r.amount)}</TableCell>
                      <TableCell className="text-right font-medium">{formatInvoiceCurrency(r.tax_deducted_amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{r.reference_number || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <TablePagination
              page={rowsPagination.page}
              pageCount={rowsPagination.pageCount}
              totalItems={rowsPagination.totalItems}
              pageSize={DEFAULT_PAGE_SIZE}
              onPageChange={rowsPagination.setPage}
            />
          </Card>
        </>
      )}
    </div>
  );
}
