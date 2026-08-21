import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Loader2, Repeat, Pause, Play, Mail, MailX } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { RequirePermission } from '@/components/shared/RequirePermission';
import { EmptyState } from '@/components/shared/EmptyState';
import { InvoiceLineItems } from '@/components/invoices/InvoiceLineItems';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/shared/TablePagination';
import { usePagination, DEFAULT_PAGE_SIZE } from '@/hooks/usePagination';
import { toast } from 'sonner';

const PAYMENT_TERMS = [
  { value: 'net15', label: 'Net 15' },
  { value: 'net30', label: 'Net 30' },
  { value: 'net45', label: 'Net 45' },
  { value: 'net60', label: 'Net 60' },
  { value: 'custom', label: 'Custom' },
] as const;

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
] as const;
const FREQUENCY_LABELS: Record<string, string> = Object.fromEntries(FREQUENCIES.map((f) => [f.value, f.label]));

interface RecurringInvoicesProps {
  clients: { id: string; client_name: string; company_name: string | null }[];
  projects: { id: string; project_name: string; client_id: string }[];
}

interface ScheduleFormState {
  client_id: string;
  project_id: string;
  frequency: string;
  day_of_month: string;
  start_date: string;
  end_date: string;
  payment_terms: string;
  cost_breakdown: string;
  notes: string;
  auto_send: boolean;
}

const todayIso = () => new Date().toISOString().split('T')[0];

// The first run should land on the next occurrence of `dayOfMonth` on or
// after `startDate` -- not `startDate` itself, which is almost never the
// same day of the month the schedule is meant to fire on. Mirrors the month
// arithmetic in generate-recurring-invoices/index.ts's advanceRunDate() so
// the very first run is anchored the same way every later one is.
function computeFirstRunDate(startDate: string, frequency: string, dayOfMonth: number): string {
  const start = new Date(`${startDate}T00:00:00Z`);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const lastDayThisMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const candidate = new Date(Date.UTC(year, month, Math.min(dayOfMonth, lastDayThisMonth)));
  if (candidate >= start) {
    return candidate.toISOString().split('T')[0];
  }

  const monthsToAdd = frequency === 'yearly' ? 12 : frequency === 'quarterly' ? 3 : 1;
  const targetMonthIndex = year * 12 + month + monthsToAdd;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDayTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(dayOfMonth, lastDayTargetMonth);
  return new Date(Date.UTC(targetYear, targetMonth, day)).toISOString().split('T')[0];
}

const emptyForm: ScheduleFormState = {
  client_id: '',
  project_id: '',
  frequency: 'monthly',
  day_of_month: String(new Date().getDate()),
  start_date: todayIso(),
  end_date: '',
  payment_terms: 'net30',
  cost_breakdown: '',
  notes: '',
  auto_send: true,
};

export function RecurringInvoices({ clients, projects }: RecurringInvoicesProps) {
  const { workspaceUserId } = useWorkspaceUser();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleFormState>({ ...emptyForm });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['recurring-invoices', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_invoices')
        .select('*')
        .order('created_at', { ascending: false });
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
  const getProjectName = (projectId: string | null) => projects.find((p) => p.id === projectId)?.project_name;
  const clientProjects = projects.filter((p) => p.client_id === form.client_id);

  const resetForm = () => setForm({ ...emptyForm });

  const openCreateDialog = () => {
    setEditingId(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (schedule: any) => {
    setEditingId(schedule.id);
    setForm({
      client_id: schedule.client_id,
      project_id: schedule.project_id || '',
      frequency: schedule.frequency,
      day_of_month: String(schedule.day_of_month),
      start_date: schedule.start_date,
      end_date: schedule.end_date || '',
      payment_terms: schedule.payment_terms || 'net30',
      cost_breakdown: schedule.cost_breakdown || '',
      notes: schedule.notes || '',
      auto_send: schedule.auto_send,
    });
    setIsDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (f: ScheduleFormState) => {
      const { error } = await supabase.from('recurring_invoices').insert({
        user_id: workspaceUserId,
        client_id: f.client_id,
        project_id: f.project_id || null,
        frequency: f.frequency,
        day_of_month: parseInt(f.day_of_month, 10),
        start_date: f.start_date,
        next_run_date: computeFirstRunDate(f.start_date, f.frequency, parseInt(f.day_of_month, 10)),
        end_date: f.end_date || null,
        payment_terms: f.payment_terms,
        cost_breakdown: f.cost_breakdown || null,
        notes: f.notes || null,
        auto_send: f.auto_send,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices', workspaceUserId] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Recurring invoice scheduled');
    },
    onError: (error: Error) => toast.error('Failed to create schedule: ' + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: ScheduleFormState }) => {
      const payload: Record<string, unknown> = {
        client_id: f.client_id,
        project_id: f.project_id || null,
        frequency: f.frequency,
        day_of_month: parseInt(f.day_of_month, 10),
        start_date: f.start_date,
        end_date: f.end_date || null,
        payment_terms: f.payment_terms,
        cost_breakdown: f.cost_breakdown || null,
        notes: f.notes || null,
        auto_send: f.auto_send,
      };

      // Only safe to recompute the anchor date before the schedule has ever
      // actually fired -- once it has, next_run_date reflects real progress
      // that advanceRunDate() in the cron function owns from here on, and
      // recomputing it from start_date here would re-anchor to the past.
      const existing = schedules.find((s) => s.id === id);
      if (existing && !existing.last_generated_invoice_id) {
        payload.next_run_date = computeFirstRunDate(f.start_date, f.frequency, parseInt(f.day_of_month, 10));
      }

      const { error } = await supabase.from('recurring_invoices').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices', workspaceUserId] });
      setIsDialogOpen(false);
      setEditingId(null);
      resetForm();
      toast.success('Schedule updated');
    },
    onError: (error: Error) => toast.error('Failed to update schedule: ' + error.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('recurring_invoices').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices', workspaceUserId] });
      toast.success(variables.is_active ? 'Schedule resumed' : 'Schedule paused');
    },
    onError: (error: Error) => toast.error('Failed to update schedule: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_invoices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices', workspaceUserId] });
      setDeletingId(null);
      toast.success('Schedule deleted');
    },
    onError: (error: Error) => toast.error('Failed to delete schedule: ' + error.message),
  });

  const handleSubmit = () => {
    if (!form.client_id) {
      toast.error('Please select a client');
      return;
    }
    const day = parseInt(form.day_of_month, 10);
    if (!day || day < 1 || day > 31) {
      toast.error('Day of month must be between 1 and 31');
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, f: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const schedulesPagination = usePagination(schedules, DEFAULT_PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Automatically generate (and optionally send) an invoice on a fixed schedule — e.g. a monthly retainer.
        </p>
        <RequirePermission module="invoices" action="create">
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            New Schedule
          </Button>
        </RequirePermission>
      </div>

      {schedules.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring invoices set up"
          description="Set up a schedule to auto-generate invoices for a retainer or ongoing project."
          actionLabel="New Schedule"
          onAction={openCreateDialog}
        />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Auto-send</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedulesPagination.pageItems.map((schedule: any) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">
                      <Link to={`/clients/${schedule.client_id}`} className="hover:text-primary hover:underline">
                        {getClientName(schedule.client_id)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {schedule.project_id ? (
                        <Link to={`/projects/${schedule.project_id}`} className="hover:underline">
                          {getProjectName(schedule.project_id) || 'Unknown Project'}
                        </Link>
                      ) : (
                        <Badge variant="outline" className="text-xs">General</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {FREQUENCY_LABELS[schedule.frequency] || schedule.frequency} · Day {schedule.day_of_month}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(schedule.next_run_date), 'MMM d, yyyy')}
                      {schedule.end_date && (
                        <div className="text-xs text-muted-foreground/80">Ends {format(new Date(schedule.end_date), 'MMM d, yyyy')}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {schedule.auto_send ? (
                        <Badge variant="secondary" className="text-xs gap-1"><Mail className="h-3 w-3" /> Auto-send</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs gap-1"><MailX className="h-3 w-3" /> Draft only</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={schedule.is_active ? 'secondary' : 'outline'} className="text-xs">
                        {schedule.is_active ? 'Active' : 'Paused'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <RequirePermission module="invoices" action="update">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleActiveMutation.mutate({ id: schedule.id, is_active: !schedule.is_active })}
                            aria-label={schedule.is_active ? 'Pause schedule' : 'Resume schedule'}
                            title={schedule.is_active ? 'Pause' : 'Resume'}
                          >
                            {schedule.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(schedule)}
                            aria-label="Edit schedule"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </RequirePermission>
                        <RequirePermission module="invoices" action="delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeletingId(schedule.id)}
                            aria-label="Delete schedule"
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
          <TablePagination
            page={schedulesPagination.page}
            pageCount={schedulesPagination.pageCount}
            totalItems={schedulesPagination.totalItems}
            pageSize={DEFAULT_PAGE_SIZE}
            onPageChange={schedulesPagination.setPage}
          />
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl xl:max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Recurring Invoice' : 'New Recurring Invoice'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select
                  value={form.client_id}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, client_id: v, project_id: '' }))}
                >
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
                <Select
                  value={form.project_id || '__none__'}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, project_id: v === '__none__' ? '' : v }))}
                  disabled={!form.client_id}
                >
                  <SelectTrigger><SelectValue placeholder="No project (general)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No project (general)</SelectItem>
                    {clientProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm((prev) => ({ ...prev, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Day of Month</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.day_of_month}
                  onChange={(e) => setForm((prev) => ({ ...prev, day_of_month: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Select value={form.payment_terms} onValueChange={(v) => setForm((prev) => ({ ...prev, payment_terms: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                  disabled={!!editingId}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date (optional)</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Line Items</Label>
              <InvoiceLineItems
                value={form.cost_breakdown}
                onChange={(v) => setForm((prev) => ({ ...prev, cost_breakdown: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes carried onto each generated invoice"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Auto-send to client</p>
                <p className="text-xs text-muted-foreground">
                  When on, each generated invoice is emailed to the client automatically. When off, it's created as a draft for you to review and send.
                </p>
              </div>
              <Switch
                checked={form.auto_send}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, auto_send: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingId ? 'Save Changes' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              This stops future invoices from being generated on this schedule. Invoices already generated are not affected. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
