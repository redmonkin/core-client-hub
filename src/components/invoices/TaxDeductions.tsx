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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatInvoiceCurrency } from '@/lib/invoice-utils';
import { type RangeKey, RANGE_OPTIONS, toIso, resolveRange, defaultCustomStart, todayIso } from '@/lib/date-ranges';

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
        .gt('tax_deducted_amount', 0)
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

  if (!canViewFinancials) {
    return <NoAccessState moduleLabel="financial figures" />;
  }

  const totalTaxDeducted = rows.reduce((acc, r) => acc + r.tax_deducted_amount, 0);
  const totalGrossSettled = rows.reduce((acc, r) => acc + r.amount + r.tax_deducted_amount, 0);

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
        Tax withheld by clients at the time of payment (TDS) — the amount to claim as tax already paid when filing your ITR for this period.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No tax deductions in this period"
          description="Payments recorded with tax withheld (TDS) will show up here."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Total Tax Deducted (Claimable)</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{formatInvoiceCurrency(totalTaxDeducted)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Total Gross Settled</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{formatInvoiceCurrency(totalGrossSettled)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Date</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="w-32 text-right">Amount Received</TableHead>
                    <TableHead className="w-32 text-right">Tax Deducted</TableHead>
                    <TableHead className="min-w-[120px]">Reference #</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
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
          </Card>
        </>
      )}
    </div>
  );
}
