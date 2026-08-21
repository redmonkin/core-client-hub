import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Loader2, Repeat, Pause, Play, FolderKanban } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { RequirePermission } from '@/components/shared/RequirePermission';
import { EmptyState } from '@/components/shared/EmptyState';
import { ProjectMultiSelect } from '@/components/shared/ProjectMultiSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { formatInvoiceCurrency } from '@/lib/invoice-utils';
import { EXPENSE_CATEGORIES, CATEGORY_LABELS } from '@/components/invoices/Expenses';
import { toast } from 'sonner';

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
] as const;
const FREQUENCY_LABELS: Record<string, string> = Object.fromEntries(FREQUENCIES.map((f) => [f.value, f.label]));

interface RecurringExpensesProps {
  projects: { id: string; project_name: string }[];
}

interface ScheduleFormState {
  category: string;
  vendor: string;
  description: string;
  amount: string;
  notes: string;
  projectIds: string[];
  frequency: string;
  day_of_month: string;
  start_date: string;
  end_date: string;
}

const todayIso = () => new Date().toISOString().split('T')[0];

// Mirrors computeFirstRunDate() in RecurringInvoices.tsx and advanceRunDate()
// in generate-recurring-expenses/index.ts, so the first run is anchored the
// same way every later one is.
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
  category: 'other',
  vendor: '',
  description: '',
  amount: '',
  notes: '',
  projectIds: [],
  frequency: 'monthly',
  day_of_month: String(new Date().getDate()),
  start_date: todayIso(),
  end_date: '',
};

export function RecurringExpenses({ projects }: RecurringExpensesProps) {
  const { workspaceUserId } = useWorkspaceUser();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleFormState>({ ...emptyForm });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['recurring-expenses', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*, recurring_expense_projects(project_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!workspaceUserId,
  });

  const getProjectName = (projectId: string) => projects.find((p) => p.id === projectId)?.project_name || 'Unknown Project';

  const resetForm = () => setForm({ ...emptyForm });

  const openCreateDialog = () => {
    setEditingId(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (schedule: any) => {
    setEditingId(schedule.id);
    setForm({
      category: schedule.category,
      vendor: schedule.vendor || '',
      description: schedule.description || '',
      amount: String(schedule.amount),
      notes: schedule.notes || '',
      projectIds: (schedule.recurring_expense_projects || []).map((p: { project_id: string }) => p.project_id),
      frequency: schedule.frequency,
      day_of_month: String(schedule.day_of_month),
      start_date: schedule.start_date,
      end_date: schedule.end_date || '',
    });
    setIsDialogOpen(true);
  };

  const syncProjectTags = async (recurringExpenseId: string, projectIds: string[]) => {
    const { error: clearError } = await supabase.from('recurring_expense_projects').delete().eq('recurring_expense_id', recurringExpenseId);
    if (clearError) throw clearError;
    if (projectIds.length > 0) {
      const { error: linkError } = await supabase
        .from('recurring_expense_projects')
        .insert(projectIds.map((projectId) => ({ recurring_expense_id: recurringExpenseId, project_id: projectId })));
      if (linkError) throw linkError;
    }
  };

  const createMutation = useMutation({
    mutationFn: async (f: ScheduleFormState) => {
      const amount = parseFloat(f.amount);
      if (!amount || amount <= 0) throw new Error('Enter an amount greater than zero');
      const dayOfMonth = parseInt(f.day_of_month, 10);
      const { data: inserted, error } = await supabase.from('recurring_expenses').insert({
        user_id: workspaceUserId,
        category: f.category,
        vendor: f.vendor.trim() || null,
        description: f.description.trim() || null,
        amount,
        notes: f.notes.trim() || null,
        frequency: f.frequency,
        day_of_month: dayOfMonth,
        start_date: f.start_date,
        next_run_date: computeFirstRunDate(f.start_date, f.frequency, dayOfMonth),
        end_date: f.end_date || null,
      }).select('id').single();
      if (error) throw error;
      await syncProjectTags(inserted.id, f.projectIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses', workspaceUserId] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Recurring expense scheduled');
    },
    onError: (error: Error) => toast.error('Failed to create schedule: ' + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: ScheduleFormState }) => {
      const amount = parseFloat(f.amount);
      if (!amount || amount <= 0) throw new Error('Enter an amount greater than zero');
      const dayOfMonth = parseInt(f.day_of_month, 10);

      const payload: Record<string, unknown> = {
        category: f.category,
        vendor: f.vendor.trim() || null,
        description: f.description.trim() || null,
        amount,
        notes: f.notes.trim() || null,
        frequency: f.frequency,
        day_of_month: dayOfMonth,
        start_date: f.start_date,
        end_date: f.end_date || null,
      };

      // Only safe to recompute the anchor date before the schedule has ever
      // actually fired -- once it has, next_run_date reflects real progress
      // the cron function owns from here on.
      const existing = schedules.find((s) => s.id === id);
      if (existing && !existing.last_generated_expense_id) {
        payload.next_run_date = computeFirstRunDate(f.start_date, f.frequency, dayOfMonth);
      }

      const { error } = await supabase.from('recurring_expenses').update(payload).eq('id', id);
      if (error) throw error;
      await syncProjectTags(id, f.projectIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses', workspaceUserId] });
      setIsDialogOpen(false);
      setEditingId(null);
      resetForm();
      toast.success('Schedule updated');
    },
    onError: (error: Error) => toast.error('Failed to update schedule: ' + error.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('recurring_expenses').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses', workspaceUserId] });
      toast.success(variables.is_active ? 'Schedule resumed' : 'Schedule paused');
    },
    onError: (error: Error) => toast.error('Failed to update schedule: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses', workspaceUserId] });
      setDeletingId(null);
      toast.success('Schedule deleted');
    },
    onError: (error: Error) => toast.error('Failed to delete schedule: ' + error.message),
  });

  const handleSubmit = () => {
    const day = parseInt(form.day_of_month, 10);
    if (!day || day < 1 || day > 31) {
      toast.error('Day of month must be between 1 and 31');
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error('Enter an amount greater than zero');
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
          Automatically log an expense on a fixed schedule — e.g. a monthly software subscription.
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
          title="No recurring expenses set up"
          description="Set up a schedule to auto-log a recurring cost like a subscription or retainer payment."
          actionLabel="New Schedule"
          onAction={openCreateDialog}
        />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedulesPagination.pageItems.map((schedule: any) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{CATEGORY_LABELS[schedule.category] || schedule.category}</TableCell>
                    <TableCell className="text-muted-foreground">{schedule.vendor || '—'}</TableCell>
                    <TableCell>
                      {(schedule.recurring_expense_projects || []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {schedule.recurring_expense_projects.map((p: { project_id: string }) => (
                            <Badge key={p.project_id} variant="secondary" className="gap-1 text-xs font-normal">
                              <FolderKanban className="h-3 w-3" />
                              {getProjectName(p.project_id)}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatInvoiceCurrency(schedule.amount)}</TableCell>
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Recurring Expense' : 'New Recurring Expense'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((prev) => ({ ...prev, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Label>Vendor</Label>
              <Input
                value={form.vendor}
                onChange={(e) => setForm((prev) => ({ ...prev, vendor: e.target.value }))}
                placeholder="e.g. AWS"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What is this for?"
              />
            </div>

            <div className="space-y-2">
              <Label>Projects</Label>
              <ProjectMultiSelect
                projects={projects}
                selectedIds={form.projectIds}
                onChange={(ids) => setForm((prev) => ({ ...prev, projectIds: ids }))}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="min-h-[70px]"
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
            <AlertDialogTitle>Delete Recurring Expense</AlertDialogTitle>
            <AlertDialogDescription>
              This stops future expenses from being generated on this schedule. Expenses already generated are not affected. This action cannot be undone.
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
