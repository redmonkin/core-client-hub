import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Package } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { INVOICE_UNITS, formatInvoiceCurrency } from '@/lib/invoice-utils';
import { toast } from 'sonner';

export interface InvoiceItem {
  id: string;
  user_id: string;
  title: string;
  unit: string;
  cost: number;
  description: string | null;
}

interface ItemFormState {
  title: string;
  unit: string;
  cost: string;
  description: string;
}

const emptyForm: ItemFormState = { title: '', unit: 'hr', cost: '', description: '' };

export function useInvoiceItems(workspaceUserId: string | undefined) {
  return useQuery({
    queryKey: ['invoice-items', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_items').select('*').order('title');
      if (error) throw error;
      return data as InvoiceItem[];
    },
    enabled: !!workspaceUserId,
  });
}

export function InvoiceItemsCatalog() {
  const { workspaceUserId } = useWorkspaceUser();
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useInvoiceItems(workspaceUserId);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>({ ...emptyForm });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['invoice-items', workspaceUserId] });

  const openCreateDialog = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: InvoiceItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      unit: item.unit,
      cost: String(item.cost),
      description: item.description || '',
    });
    setIsDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('Title is required');
      const row = {
        title: form.title.trim(),
        unit: form.unit,
        cost: parseFloat(form.cost) || 0,
        description: form.description.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from('invoice_items').update(row).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('invoice_items').insert({ ...row, user_id: workspaceUserId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      setIsDialogOpen(false);
      toast.success(editingId ? 'Item updated' : 'Item added');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoice_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setDeletingId(null);
      toast.success('Item deleted');
    },
    onError: (error: Error) => toast.error('Failed to delete: ' + error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <RequirePermission module="invoices" action="create">
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            New Item
          </Button>
        </RequirePermission>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No items yet"
          description="Save reusable billable items (title, cost, unit) so you can pick them into an invoice instead of retyping them each time."
        />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Title</TableHead>
                  <TableHead className="min-w-[200px]">Description</TableHead>
                  <TableHead className="w-24">Unit</TableHead>
                  <TableHead className="w-32 text-right">Cost</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">{item.description || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                    <TableCell className="text-right font-medium">{formatInvoiceCurrency(item.cost)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <RequirePermission module="invoices" action="update">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </RequirePermission>
                        <RequirePermission module="invoices" action="delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeletingId(item.id)}
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
            <DialogTitle>{editingId ? 'Edit Item' : 'New Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Senior Web Consultant"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={(value) => setForm((prev) => ({ ...prev, unit: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVOICE_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cost</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.cost}
                  onChange={(e) => setForm((prev) => ({ ...prev, cost: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional details shown on the invoice line item"
                className="min-h-[70px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title.trim()}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
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
