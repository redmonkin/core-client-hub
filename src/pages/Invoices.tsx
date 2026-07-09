import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Plus, Search, MoreHorizontal, Loader2, Pencil, Trash2, Send, LinkIcon,
  CheckCircle2, Download, FileText,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { PageHeader } from '@/components/shared/PageHeader';
import { RequirePermission } from '@/components/shared/RequirePermission';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { NoAccessState } from '@/components/shared/NoAccessState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CostBreakdownTable } from '@/components/proposals/CostBreakdownTable';
import { buildCostTableHtml, getCostBreakdownTotal } from '@/lib/proposal-utils';
import { exportToPdf } from '@/lib/pdf-export';
import { getOrCreateInvoicePortalAccess } from '@/lib/invoice-portal-access';
import { toast } from 'sonner';

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);

interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  project_id: string | null;
  contract_id: string | null;
  invoice_number: string;
  status: string;
  currency: string;
  cost_breakdown: string | null;
  due_date: string | null;
  issued_date: string;
  paid_at: string | null;
  notes: string | null;
}

interface InvoiceFormState {
  client_id: string;
  project_id: string;
  contract_id: string;
  due_date: string;
  notes: string;
  cost_breakdown: string;
}

const emptyForm: InvoiceFormState = {
  client_id: '',
  project_id: '',
  contract_id: '',
  due_date: '',
  notes: '',
  cost_breakdown: '',
};

export default function Invoices() {
  const { user } = useAuth();
  const { workspaceUserId, canViewFinancials, can, loading: permLoading } = useWorkspaceUser();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InvoiceFormState>({ ...emptyForm });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingInvoice, setSendingInvoice] = useState<Invoice | null>(null);
  const [isSending, setIsSending] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!workspaceUserId,
  });

  // RLS naturally omits rows the caller doesn't have can_view_financials access
  // to — missing entries here mean "not permitted to see this amount", not "zero".
  const { data: amounts = [] } = useQuery({
    queryKey: ['invoice-amounts', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_amounts').select('*');
      if (error) throw error;
      return data as { invoice_id: string; total_amount: number; amount_paid: number }[];
    },
    enabled: !!workspaceUserId,
  });
  const amountsByInvoice = new Map(amounts.map((a) => [a.invoice_id, a]));

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, client_name, company_name').order('client_name');
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceUserId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, project_name, client_id').order('project_name');
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceUserId,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-list', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('contracts').select('id, contract_type, client_id, value').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceUserId,
  });

  const getClient = (clientId: string) => clients.find((c) => c.id === clientId);
  const getClientName = (clientId: string) => {
    const c = getClient(clientId);
    return c?.client_name || c?.company_name || 'Unknown Client';
  };

  const nextInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const thisYear = invoices.filter((inv) => inv.invoice_number.includes(String(year)));
    return `INV-${year}-${String(thisYear.length + 1).padStart(4, '0')}`;
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setIsDialogOpen(true);
  };

  const openEditDialog = (invoice: Invoice) => {
    setEditingId(invoice.id);
    setForm({
      client_id: invoice.client_id,
      project_id: invoice.project_id || '',
      contract_id: invoice.contract_id || '',
      due_date: invoice.due_date || '',
      notes: invoice.notes || '',
      cost_breakdown: invoice.cost_breakdown || '',
    });
    setIsDialogOpen(true);
  };

  const applyContractPrefill = (contractId: string) => {
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) {
      setForm((prev) => ({ ...prev, contract_id: '' }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      contract_id: contractId,
      client_id: contract.client_id,
      cost_breakdown: JSON.stringify({
        items: [{ description: `${contract.contract_type} contract`, quantity: 1, unitPrice: contract.value || 0, discount: 0 }],
        additionalDiscount: 0,
        taxRate: 0,
        notes: '',
      }),
    }));
  };

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const contractId = searchParams.get('contractId');
    if (contractId && contracts.length > 0) {
      setEditingId(null);
      setForm({ ...emptyForm });
      applyContractPrefill(contractId);
      setIsDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.client_id) throw new Error('Client is required');
      const numericTotal = getCostBreakdownTotal(form.cost_breakdown || '{}');

      if (editingId) {
        const { error } = await supabase.from('invoices').update({
          client_id: form.client_id,
          project_id: form.project_id || null,
          contract_id: form.contract_id || null,
          due_date: form.due_date || null,
          notes: form.notes || null,
          cost_breakdown: form.cost_breakdown || null,
        }).eq('id', editingId);
        if (error) throw error;

        if (canViewFinancials) {
          const { error: amountError } = await supabase.from('invoice_amounts').upsert({
            invoice_id: editingId,
            total_amount: numericTotal,
          });
          if (amountError) throw amountError;
        }
        return editingId;
      }

      // Retry on invoice_number collisions from concurrent creates by other
      // team members (nextInvoiceNumber() is derived from a client-cached
      // list, so it isn't guaranteed unique under concurrency).
      let inserted: { id: string } | null = null;
      for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
        const { data, error } = await supabase.from('invoices').insert({
          user_id: workspaceUserId!,
          client_id: form.client_id,
          project_id: form.project_id || null,
          contract_id: form.contract_id || null,
          invoice_number: `${nextInvoiceNumber()}${attempt > 0 ? `-${attempt}` : ''}`,
          due_date: form.due_date || null,
          notes: form.notes || null,
          cost_breakdown: form.cost_breakdown || null,
        }).select('id').single();
        if (error) {
          if (error.code === '23505' && attempt < 2) continue;
          throw error;
        }
        inserted = data;
      }
      if (!inserted) throw new Error('Failed to create invoice');

      if (canViewFinancials) {
        const { error: amountError } = await supabase.from('invoice_amounts').insert({
          invoice_id: inserted.id,
          total_amount: numericTotal,
        });
        if (amountError) throw amountError;
      }

      return inserted.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-amounts'] });
      setIsDialogOpen(false);
      toast.success(editingId ? 'Invoice updated' : 'Invoice created');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setDeletingId(null);
      toast.success('Invoice deleted');
    },
    onError: (error: Error) => toast.error('Failed to delete: ' + error.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice marked as paid');
    },
    onError: (error: Error) => toast.error('Failed to update: ' + error.message),
  });

  const handleSend = (invoice: Invoice) => setSendingInvoice(invoice);

  const confirmSend = async () => {
    if (!sendingInvoice) return;
    const client = getClient(sendingInvoice.client_id);
    if (!client) return;
    setIsSending(true);
    try {
      const portal = await getOrCreateInvoicePortalAccess(sendingInvoice.id, window.location.origin);
      const amount = amountsByInvoice.get(sendingInvoice.id);

      const { error } = await supabase.functions.invoke('send-notification-email', {
        body: {
          type: 'invoice_sent',
          recipientEmail: '',
          recipientName: '',
          data: {
            invoiceId: sendingInvoice.id,
            invoiceNumber: sendingInvoice.invoice_number,
            totalAmount: amount ? formatCurrency(amount.total_amount) : null,
            dueDate: sendingInvoice.due_date,
            portalLink: portal.link,
            portalPassword: portal.password,
            senderName: user?.user_metadata?.full_name || null,
          },
        },
      });
      if (error) throw error;

      if (sendingInvoice.status === 'draft') {
        await supabase.from('invoices').update({ status: 'sent' }).eq('id', sendingInvoice.id);
      }

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(`Invoice sent to ${client.client_name}`);
      setSendingInvoice(null);
    } catch (error: unknown) {
      toast.error('Failed to send invoice: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = async (invoice: Invoice) => {
    try {
      const portal = await getOrCreateInvoicePortalAccess(invoice.id, window.location.origin);
      await navigator.clipboard.writeText(portal.link);
      toast.success('Share link copied to clipboard');
    } catch {
      toast.error('Failed to generate share link');
    }
  };

  const handleDownloadPdf = (invoice: Invoice) => {
    const client = getClient(invoice.client_id);
    const amount = amountsByInvoice.get(invoice.id);
    const { tableHtml } = buildCostTableHtml(invoice.cost_breakdown || '{}');
    const html = `
      <div style="font-family: Poppins, sans-serif; padding: 32px; max-width: 700px;">
        <h1 style="font-size: 24px; margin-bottom: 4px;">Invoice ${invoice.invoice_number}</h1>
        <p style="color: #6b7280; margin-bottom: 24px;">Issued ${format(new Date(invoice.issued_date), 'MMMM d, yyyy')}${invoice.due_date ? ` &middot; Due ${format(new Date(invoice.due_date), 'MMMM d, yyyy')}` : ''}</p>
        <p style="font-weight: 600; margin-bottom: 4px;">Bill to</p>
        <p style="margin-bottom: 24px;">${client?.client_name || ''}${client?.company_name ? ` (${client.company_name})` : ''}</p>
        ${tableHtml}
        ${amount ? `<p style="text-align: right; font-size: 18px; font-weight: 700; margin-top: 16px;">Total: ${formatCurrency(amount.total_amount)}</p>` : ''}
        ${invoice.notes ? `<p style="margin-top: 24px; color: #6b7280;">${invoice.notes}</p>` : ''}
      </div>
    `;
    exportToPdf(html, `${invoice.invoice_number}.pdf`);
  };

  const filteredInvoices = invoices.filter((inv) => {
    const clientName = getClientName(inv.client_id).toLowerCase();
    const matchesSearch = clientName.includes(searchQuery.toLowerCase()) || inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const clientProjects = projects.filter((p) => p.client_id === form.client_id);
  const clientContracts = contracts.filter((c) => c.client_id === form.client_id || !form.client_id);

  if (permLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!can('invoices', 'read')) {
    return (
      <div className="space-y-6 p-4 sm:p-8">
        <PageHeader title="Invoices" description="Bill clients for approved contracts or ad-hoc work" />
        <NoAccessState moduleLabel="invoices" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <PageHeader
        title="Invoices"
        description="Bill clients for approved contracts or ad-hoc work"
        actions={
          <RequirePermission module="invoices" action="create">
            <Button size="lg" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </RequirePermission>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by invoice number or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="void">Void</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredInvoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Create your first invoice, or generate one from an approved contract."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const amount = amountsByInvoice.get(invoice.id);
                  const isOverdue = invoice.status === 'sent' && invoice.due_date && new Date(invoice.due_date) < new Date();
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <Link to={`/clients/${invoice.client_id}`} className="hover:text-primary hover:underline">
                          {getClientName(invoice.client_id)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={(isOverdue ? 'rejected' : invoice.status) as 'draft' | 'sent' | 'paid' | 'void' | 'rejected'} />
                        {isOverdue && <span className="ml-1 text-xs text-destructive">Overdue</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {canViewFinancials ? (amount ? formatCurrency(amount.total_amount) : '—') : '••••••'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownloadPdf(invoice)}>
                              <Download className="mr-2 h-4 w-4" />
                              Download PDF
                            </DropdownMenuItem>
                            <RequirePermission module="invoices" action="update">
                              <DropdownMenuItem onClick={() => openEditDialog(invoice)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSend(invoice)}>
                                <Send className="mr-2 h-4 w-4" />
                                Send to Client
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyLink(invoice)}>
                                <LinkIcon className="mr-2 h-4 w-4" />
                                Copy Share Link
                              </DropdownMenuItem>
                              {invoice.status !== 'paid' && (
                                <DropdownMenuItem onClick={() => markPaidMutation.mutate(invoice.id)}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Mark as Paid
                                </DropdownMenuItem>
                              )}
                            </RequirePermission>
                            <RequirePermission module="invoices" action="delete">
                              <DropdownMenuItem
                                onClick={() => setDeletingId(invoice.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </RequirePermission>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Invoice' : 'New Invoice'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={form.client_id} onValueChange={(value) => setForm((prev) => ({ ...prev, client_id: value, project_id: '', contract_id: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.client_name || c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={form.project_id} onValueChange={(value) => setForm((prev) => ({ ...prev, project_id: value }))}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {clientProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Generate from contract</Label>
              <Select value={form.contract_id} onValueChange={applyContractPrefill}>
                <SelectTrigger><SelectValue placeholder="Optional — pre-fills line items from a contract" /></SelectTrigger>
                <SelectContent>
                  {clientContracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.contract_type} contract</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Line Items</Label>
              <CostBreakdownTable
                value={form.cost_breakdown}
                onChange={(value) => setForm((prev) => ({ ...prev, cost_breakdown: value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Payment terms, bank details, etc."
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.client_id}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
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

      {/* Send Confirmation */}
      <AlertDialog open={!!sendingInvoice} onOpenChange={() => setSendingInvoice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Invoice to Client</AlertDialogTitle>
            <AlertDialogDescription>
              This emails a secure link to view and download the invoice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSend} disabled={isSending}>
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
