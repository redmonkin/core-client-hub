import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { FileText, Wallet, Receipt as ReceiptIcon, TrendingUp, Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { NoAccessState } from '@/components/shared/NoAccessState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { formatInvoiceCurrency } from '@/lib/invoice-utils';
import { CATEGORY_LABELS } from '@/components/invoices/Expenses';

type RangeKey = '7d' | 'month' | 'year' | 'fy';

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: 'month', label: 'Last Month' },
  { value: 'year', label: 'Last Year' },
  { value: 'fy', label: 'Financial Year' },
];

const toIso = (d: Date) => d.toISOString().split('T')[0];

function getRange(range: RangeKey): { start: Date; end: Date; bucket: 'day' | 'month' } {
  const end = new Date();
  const start = new Date();
  switch (range) {
    case '7d':
      start.setDate(start.getDate() - 6);
      return { start, end, bucket: 'day' };
    case 'month':
      start.setDate(start.getDate() - 29);
      return { start, end, bucket: 'day' };
    case 'year':
      start.setDate(start.getDate() - 364);
      return { start, end, bucket: 'month' };
    case 'fy': {
      // India financial year: April 1 - March 31.
      const fyStartYear = end.getMonth() >= 3 ? end.getFullYear() : end.getFullYear() - 1;
      return { start: new Date(fyStartYear, 3, 1), end, bucket: 'month' };
    }
  }
}

function enumerateBuckets(start: Date, end: Date, bucket: 'day' | 'month'): string[] {
  const keys: string[] = [];
  const cur = new Date(start);
  if (bucket === 'day') {
    while (cur <= end) {
      keys.push(toIso(cur));
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    cur.setDate(1);
    while (cur <= end) {
      keys.push(toIso(cur).slice(0, 7));
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  return keys;
}

const CATEGORY_COLORS = ['#0284C5', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

const chartConfig: ChartConfig = {
  invoiced: { label: 'Invoiced', color: '#0284C5' },
  collected: { label: 'Collected', color: '#16a34a' },
  expenses: { label: 'Expenses', color: '#dc2626' },
};

export function AccountsOverview() {
  const [range, setRange] = useState<RangeKey>('month');
  const { workspaceUserId, canViewFinancials } = useWorkspaceUser();
  const { start, end, bucket } = getRange(range);
  const startIso = toIso(start);
  const endIso = toIso(end);

  const bucketKey = (dateStr: string) => (bucket === 'day' ? dateStr : dateStr.slice(0, 7));
  const bucketLabel = (key: string) => (bucket === 'day' ? format(new Date(key), 'MMM d') : format(new Date(`${key}-01`), 'MMM yyyy'));

  const { data: invoiceRows = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['overview-invoices', workspaceUserId, startIso, endIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, issued_date, status, invoice_amounts(total_amount)')
        .gte('issued_date', startIso)
        .lte('issued_date', endIso)
        .neq('status', 'void');
      if (error) throw error;
      return data as { id: string; issued_date: string; status: string; invoice_amounts: { total_amount: number } | { total_amount: number }[] | null }[];
    },
    enabled: !!workspaceUserId && canViewFinancials,
  });

  const { data: paymentRows = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['overview-payments', workspaceUserId, startIso, endIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_payments')
        .select('amount, tax_deducted_amount, payment_date')
        .gte('payment_date', startIso)
        .lte('payment_date', endIso);
      if (error) throw error;
      return data as { amount: number; tax_deducted_amount: number; payment_date: string }[];
    },
    enabled: !!workspaceUserId && canViewFinancials,
  });

  const { data: expenseRows = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['overview-expenses', workspaceUserId, startIso, endIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount, category, expense_date')
        .gte('expense_date', startIso)
        .lte('expense_date', endIso);
      if (error) throw error;
      return data as { amount: number; category: string; expense_date: string }[];
    },
    enabled: !!workspaceUserId && canViewFinancials,
  });

  if (!canViewFinancials) {
    return <NoAccessState moduleLabel="financial figures" />;
  }

  const isLoading = loadingInvoices || loadingPayments || loadingExpenses;

  const invoiceAmount = (inv: (typeof invoiceRows)[number]): number => {
    const a = inv.invoice_amounts;
    if (!a) return 0;
    return Array.isArray(a) ? (a[0]?.total_amount ?? 0) : a.total_amount;
  };

  const invoicedByBucket = new Map<string, number>();
  invoiceRows.forEach((inv) => {
    const amt = invoiceAmount(inv);
    if (!amt) return;
    const key = bucketKey(inv.issued_date);
    invoicedByBucket.set(key, (invoicedByBucket.get(key) || 0) + amt);
  });

  const collectedByBucket = new Map<string, number>();
  paymentRows.forEach((p) => {
    const key = bucketKey(p.payment_date);
    collectedByBucket.set(key, (collectedByBucket.get(key) || 0) + p.amount + (p.tax_deducted_amount || 0));
  });

  const expensesByBucket = new Map<string, number>();
  const expensesByCategory = new Map<string, number>();
  expenseRows.forEach((e) => {
    const key = bucketKey(e.expense_date);
    expensesByBucket.set(key, (expensesByBucket.get(key) || 0) + e.amount);
    expensesByCategory.set(e.category, (expensesByCategory.get(e.category) || 0) + e.amount);
  });

  const chartData = enumerateBuckets(start, end, bucket).map((key) => ({
    key,
    label: bucketLabel(key),
    invoiced: invoicedByBucket.get(key) || 0,
    collected: collectedByBucket.get(key) || 0,
    expenses: expensesByBucket.get(key) || 0,
  }));

  const totalInvoiced = invoiceRows.reduce((acc, inv) => acc + invoiceAmount(inv), 0);
  const totalCollected = paymentRows.reduce((acc, p) => acc + p.amount + (p.tax_deducted_amount || 0), 0);
  const totalExpenses = expenseRows.reduce((acc, e) => acc + e.amount, 0);
  const netCashFlow = totalCollected - totalExpenses;

  const categoryData = Array.from(expensesByCategory.entries())
    .map(([category, value]) => ({ name: CATEGORY_LABELS[category] || category, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {format(start, 'MMM d, yyyy')} – {format(end, 'MMM d, yyyy')}
        </p>
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => (
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
            <StatCard title="Invoiced" value={formatInvoiceCurrency(totalInvoiced)} icon={FileText} />
            <StatCard title="Collected" value={formatInvoiceCurrency(totalCollected)} icon={Wallet} />
            <StatCard title="Expenses" value={formatInvoiceCurrency(totalExpenses)} icon={ReceiptIcon} />
            <StatCard
              title="Net Cash Flow"
              value={formatInvoiceCurrency(netCashFlow)}
              icon={TrendingUp}
              description={netCashFlow >= 0 ? 'Collected exceeds expenses' : 'Expenses exceed collected'}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoiced, Collected &amp; Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.every((d) => d.invoiced === 0 && d.collected === 0 && d.expenses === 0) ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No activity in this period.</p>
              ) : (
                <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
                  <BarChart data={chartData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} width={60} tickFormatter={(v) => formatInvoiceCurrency(v).replace(/\.00$/, '')} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="invoiced" fill="var(--color-invoiced)" radius={2} />
                    <Bar dataKey="collected" fill="var(--color-collected)" radius={2} />
                    <Bar dataKey="expenses" fill="var(--color-expenses)" radius={2} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <EmptyState icon={ReceiptIcon} title="No expenses in this period" description="Logged expenses will show up here broken down by category." />
              ) : (
                <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                    <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} strokeWidth={2}>
                      {categoryData.map((entry, index) => (
                        <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
