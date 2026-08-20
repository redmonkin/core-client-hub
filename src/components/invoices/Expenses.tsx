import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Receipt, Paperclip, FileIcon, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { RequirePermission } from '@/components/shared/RequirePermission';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SortableTableHead, toggleSort, compareValues, type SortState } from '@/components/shared/SortableTableHead';
import { formatInvoiceCurrency } from '@/lib/invoice-utils';
import { toast } from 'sonner';

type ExpenseSortKey = 'expense_date' | 'category' | 'vendor' | 'description' | 'amount';

export const EXPENSE_CATEGORIES = [
  'software', 'travel', 'office', 'marketing', 'contractor', 'taxes', 'other',
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  software: 'Software', travel: 'Travel', office: 'Office', marketing: 'Marketing',
  contractor: 'Contractor', taxes: 'Taxes', other: 'Other',
};

interface Expense {
  id: string;
  user_id: string;
  expense_date: string;
  category: string;
  vendor: string | null;
  description: string | null;
  amount: number;
  notes: string | null;
  receipt_url: string | null;
  receipt_name: string | null;
}

interface ExpenseFormState {
  expense_date: string;
  category: string;
  vendor: string;
  description: string;
  amount: string;
  notes: string;
}

const todayIso = () => new Date().toISOString().split('T')[0];

const emptyForm = (): ExpenseFormState => ({
  expense_date: todayIso(),
  category: 'other',
  vendor: '',
  description: '',
  amount: '',
  notes: '',
});

export function Expenses() {
  const { workspaceUserId } = useWorkspaceUser();
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!workspaceUserId,
  });

  // Bucket is private -- resolve short-lived signed URLs for whichever
  // receipts are currently in view.
  const [signedReceiptUrls, setSignedReceiptUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = expenses.map((e) => e.receipt_url).filter((p): p is string => !!p);
    if (paths.length === 0) return;
    supabase.storage.from('expense-receipts').createSignedUrls(paths, 3600).then(({ data }) => {
      if (!data) return;
      const map: Record<string, string> = {};
      data.forEach((item) => { if (item.signedUrl) map[item.path!] = item.signedUrl; });
      setSignedReceiptUrls(map);
    });
  }, [expenses]);

  const [sort, setSort] = useState<SortState<ExpenseSortKey>>({ key: 'expense_date', direction: 'desc' });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(emptyForm());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [existingReceipt, setExistingReceipt] = useState<{ url: string; name: string } | null>(null);
  const [removeExistingReceipt, setRemoveExistingReceipt] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['expenses', workspaceUserId] });

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm());
    setReceiptFile(null);
    setExistingReceipt(null);
    setRemoveExistingReceipt(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (expense: Expense) => {
    setEditingId(expense.id);
    setForm({
      expense_date: expense.expense_date,
      category: expense.category,
      vendor: expense.vendor || '',
      description: expense.description || '',
      amount: String(expense.amount),
      notes: expense.notes || '',
    });
    setReceiptFile(null);
    setExistingReceipt(expense.receipt_url ? { url: expense.receipt_url, name: expense.receipt_name || 'receipt' } : null);
    setRemoveExistingReceipt(false);
    setIsDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(form.amount);
      if (!amount || amount <= 0) throw new Error('Enter an amount greater than zero');

      let receiptUrl: string | null | undefined = removeExistingReceipt ? null : undefined;
      let receiptName: string | null | undefined = removeExistingReceipt ? null : undefined;

      if (receiptFile) {
        const ext = receiptFile.name.split('.').pop();
        // Path must start with the workspace owner's id to satisfy RLS folder check
        const path = `${workspaceUserId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('expense-receipts').upload(path, receiptFile);
        if (uploadError) throw uploadError;
        receiptUrl = path;
        receiptName = receiptFile.name;
      }

      const row = {
        expense_date: form.expense_date || todayIso(),
        category: form.category,
        vendor: form.vendor.trim() || null,
        description: form.description.trim() || null,
        amount,
        notes: form.notes.trim() || null,
        ...(receiptUrl !== undefined ? { receipt_url: receiptUrl, receipt_name: receiptName } : {}),
      };
      if (editingId) {
        const { error } = await supabase.from('expenses').update(row).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('expenses').insert({ ...row, user_id: workspaceUserId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      setIsDialogOpen(false);
      toast.success(editingId ? 'Expense updated' : 'Expense added');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setDeletingId(null);
      toast.success('Expense deleted');
    },
    onError: (error: Error) => toast.error('Failed to delete: ' + error.message),
  });

  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

  const expenseSortValue = (e: Expense, key: ExpenseSortKey): string | number => {
    switch (key) {
      case 'expense_date': return e.expense_date;
      case 'category': return CATEGORY_LABELS[e.category] || e.category;
      case 'vendor': return e.vendor || '';
      case 'description': return e.description || '';
      case 'amount': return e.amount;
    }
  };
  const sortedExpenses = [...expenses].sort((a, b) => {
    const cmp = compareValues(expenseSortValue(a, sort.key), expenseSortValue(b, sort.key));
    return sort.direction === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {expenses.length > 0 && <>Total logged: <span className="font-semibold text-foreground">{formatInvoiceCurrency(totalExpenses)}</span></>}
        </p>
        <RequirePermission module="invoices" action="create">
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </RequirePermission>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses yet"
          description="Log business spend like software, travel, or contractor costs to keep a record alongside your invoices."
        />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Date" sortKey="expense_date" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="w-28" />
                  <SortableTableHead label="Category" sortKey="category" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="w-32" />
                  <SortableTableHead label="Vendor" sortKey="vendor" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="min-w-[160px]" />
                  <SortableTableHead label="Description" sortKey="description" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="min-w-[200px]" />
                  <SortableTableHead label="Amount" sortKey="amount" sort={sort} onSort={(key) => setSort((prev) => toggleSort(prev, key))} className="w-32 text-right" align="right" />
                  <TableHead className="w-16" />
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-muted-foreground">{format(new Date(expense.expense_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{CATEGORY_LABELS[expense.category] || expense.category}</TableCell>
                    <TableCell>{expense.vendor || '—'}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">{expense.description || '—'}</TableCell>
                    <TableCell className="text-right font-medium">{formatInvoiceCurrency(expense.amount)}</TableCell>
                    <TableCell>
                      {expense.receipt_url && signedReceiptUrls[expense.receipt_url] && (
                        <a
                          href={signedReceiptUrls[expense.receipt_url]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          title={expense.receipt_name || 'Receipt'}
                        >
                          <Paperclip className="h-4 w-4" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <RequirePermission module="invoices" action="update">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(expense)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </RequirePermission>
                        <RequirePermission module="invoices" action="delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeletingId(expense.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </RequirePermission>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, expense_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input
                  value={form.vendor}
                  onChange={(e) => setForm((prev) => ({ ...prev, vendor: e.target.value }))}
                  placeholder="e.g. AWS"
                />
              </div>
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What was this for?"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="min-h-[70px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Receipt</Label>
              {!receiptFile && !(existingReceipt && !removeExistingReceipt) && (
                <Button variant="outline" size="sm" type="button" asChild>
                  <label className="cursor-pointer">
                    <Paperclip className="mr-2 h-4 w-4" />
                    Attach Receipt
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="sr-only"
                      onChange={(e) => {
                        setReceiptFile(e.target.files?.[0] || null);
                        setRemoveExistingReceipt(false);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </Button>
              )}
              {receiptFile && (
                <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground w-fit">
                  <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="max-w-[200px] truncate">{receiptFile.name}</span>
                  <button onClick={() => setReceiptFile(null)} className="ml-1 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {!receiptFile && existingReceipt && !removeExistingReceipt && (
                <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground w-fit">
                  <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="max-w-[200px] truncate">{existingReceipt.name}</span>
                  <button onClick={() => setRemoveExistingReceipt(true)} className="ml-1 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.amount}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? 'Save Changes' : 'Add Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
