import { useState } from 'react';
import { Plus, Upload, Trash2, Clock, Loader2, FileSpreadsheet, Pencil, Download, Play, CheckCircle2, CalendarClock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { RequirePermission } from '@/components/shared/RequirePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { TimesheetImportDialog } from './TimesheetImportDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

const TIMESHEET_STATUSES = ['new', 'in-progress', 'wont-do', 'pending', 'non-billable', 'billed'] as const;
type TimesheetStatus = typeof TIMESHEET_STATUSES[number];

const STATUS_STYLES: Record<TimesheetStatus, string> = {
  new: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
  'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'wont-do': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'non-billable': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  billed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

const STATUS_LABELS: Record<TimesheetStatus, string> = {
  new: 'New',
  'in-progress': 'In Progress',
  'wont-do': "Won't Do",
  pending: 'Pending',
  'non-billable': 'Non Billable',
  billed: 'Billed',
};

interface ProjectTimesheetsProps {
  projectId: string;
}

// Supabase/PostgREST doesn't error on an UPDATE/DELETE that RLS silently
// filters down to zero rows -- it just returns success with nothing changed.
// Without this check, a user lacking the `timesheets` permission would see a
// false "success" toast while nothing actually happened server-side.
const PERMISSION_DENIED_MESSAGE = "You don't have permission to do that.";
function assertRowAffected<T>(data: T[] | null): void {
  if (!data || data.length === 0) {
    throw new Error(PERMISSION_DENIED_MESSAGE);
  }
}

interface TimesheetEntry {
  task: string;
  owner: string;
  assigneeUserId: string;
  duration: string;
  date: string;
  dueDate: string;
  notes: string;
  status?: TimesheetStatus;
}

const emptyEntry: TimesheetEntry = {
  task: '',
  owner: '',
  assigneeUserId: '',
  duration: '',
  date: new Date().toISOString().split('T')[0],
  dueDate: '',
  notes: '',
  status: 'new',
};

export function ProjectTimesheets({ projectId }: ProjectTimesheetsProps) {
  const { user } = useAuth();
  const { workspaceUserId, can } = useWorkspaceUser();
  const queryClient = useQueryClient();

  const userFirstName = (() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, any>;
    const fullName: string =
      meta.first_name ||
      meta.full_name ||
      meta.name ||
      user?.email?.split('@')[0] ||
      '';
    const first = String(fullName).trim().split(/\s+/)[0] ?? '';
    return first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
  })();

  // Roster of users linked to this workspace (the account owner plus any active team
  // members), so the assignee is picked from a dropdown instead of typed freely.
  const { data: teamRoster = [] } = useQuery({
    queryKey: ['team-roster', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_team_roster');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const currentUserRosterLabel =
    teamRoster.find((m) => m.user_id === user?.id)?.full_name || userFirstName;

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [entry, setEntry] = useState<TimesheetEntry>({ ...emptyEntry });
  const [editId, setEditId] = useState<string | null>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [completeDuration, setCompleteDuration] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');

  const setAssignee = (rosterLabel: string) => {
    const member = teamRoster.find((m) => (m.full_name || m.email) === rosterLabel);
    setEntry((prev) => ({ ...prev, owner: rosterLabel, assigneeUserId: member?.user_id || '' }));
  };

  const openAssignDialog = () => {
    setEditId(null);
    setEntry({ ...emptyEntry });
    setIsAssignOpen(true);
  };

  const openEditDialog = (ts: any) => {
    setEditId(ts.id);
    setEntry({
      task: ts.task ?? '',
      owner: ts.owner ?? '',
      assigneeUserId: ts.assignee_user_id ?? '',
      duration: ts.duration != null ? String(ts.duration) : '',
      date: ts.date ? String(ts.date).split('T')[0] : new Date().toISOString().split('T')[0],
      dueDate: ts.due_date ? String(ts.due_date).split('T')[0] : '',
      notes: ts.notes ?? '',
      status: (ts.status as TimesheetStatus) || 'new',
    });
    setIsEditOpen(true);
  };

  const openCompleteDialog = (id: string) => {
    setCompleteId(id);
    setCompleteDuration('');
    setCompleteNotes('');
    setIsCompleteOpen(true);
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ['timesheets', projectId],
    queryFn: async () => {
      // `date` has no time component, so entries on the same day need a real
      // timestamp as a tiebreaker -- otherwise same-day rows come back in an
      // undefined order instead of most-recently-created first.
      const { data, error } = await supabase
        .from('timesheets')
        .select('*')
        .eq('project_id', projectId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (e: TimesheetEntry) => {
      const { error } = await supabase.from('timesheets').insert({
        project_id: projectId,
        user_id: workspaceUserId,
        task: e.task,
        owner: e.owner,
        assignee_user_id: e.assigneeUserId || null,
        duration: null,
        date: e.date,
        due_date: e.dueDate || null,
        notes: e.notes || null,
        status: 'new',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', projectId] });
      setIsAssignOpen(false);
      setEntry({ ...emptyEntry });
      toast.success('Task assigned');
    },
    onError: (error: any) => {
      toast.error('Failed to assign task: ' + error.message);
    },
  });

  const importMutation = useMutation({
    mutationFn: async (entries: TimesheetEntry[]) => {
      const rows = entries.map(e => ({
        project_id: projectId,
        user_id: workspaceUserId,
        task: e.task,
        owner: e.owner,
        duration: parseFloat(e.duration) || 0,
        date: e.date,
        notes: e.notes || null,
        status: e.status || 'pending',
      }));
      const { error } = await supabase.from('timesheets').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', projectId] });
      toast.success('Timesheet entries imported');
    },
    onError: (error: any) => {
      toast.error('Failed to import entries: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('timesheets').delete().eq('id', id).select('id');
      if (error) throw error;
      assertRowAffected(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', projectId] });
      setDeleteId(null);
      toast.success('Entry deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TimesheetEntry }) => {
      const { data: rows, error } = await supabase
        .from('timesheets')
        .update({
          task: data.task,
          owner: data.owner,
          assignee_user_id: data.assigneeUserId || null,
          duration: data.duration ? parseFloat(data.duration) : null,
          date: data.date,
          due_date: data.dueDate || null,
          notes: data.notes || null,
          status: data.status || 'new',
        })
        .eq('id', id)
        .select('id');
      if (error) throw error;
      assertRowAffected(rows);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', projectId] });
      setIsEditOpen(false);
      setEditId(null);
      setEntry({ ...emptyEntry });
      toast.success('Timesheet entry updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update entry: ' + error.message);
    },
  });

  // One-click transition, no dialog -- friction here is the whole reason a
  // "New" pile never gets started in most task trackers.
  const startMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('timesheets').update({ status: 'in-progress' }).eq('id', id).select('id');
      if (error) throw error;
      assertRowAffected(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', projectId] });
      toast.success('Task started');
    },
    onError: (error: any) => {
      toast.error('Failed to start: ' + error.message);
    },
  });

  // Completion is the only place duration gets entered -- it wasn't knowable
  // at assignment time, since the work hadn't happened yet.
  const completeMutation = useMutation({
    mutationFn: async ({ id, duration, notes }: { id: string; duration: string; notes: string }) => {
      const { data, error } = await supabase
        .from('timesheets')
        .update({ duration: parseFloat(duration) || 0, notes: notes || null, status: 'pending' })
        .eq('id', id)
        .select('id');
      if (error) throw error;
      assertRowAffected(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', projectId] });
      setIsCompleteOpen(false);
      setCompleteId(null);
      toast.success('Task completed');
    },
    onError: (error: any) => {
      toast.error('Failed to complete: ' + error.message);
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { data, error } = await supabase
        .from('timesheets')
        .update({ status })
        .in('id', ids)
        .select('id');
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: (updatedCount, variables) => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', projectId] });
      setSelectedIds(new Set());
      if (updatedCount < variables.ids.length) {
        toast.warning(`${updatedCount} of ${variables.ids.length} entries updated — you may not have permission to update the rest.`);
      } else {
        toast.success(`${updatedCount} entries updated to "${STATUS_LABELS[variables.status as TimesheetStatus]}"`);
      }
    },
    onError: (error: any) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  const handleAssignSubmit = () => {
    if (!entry.task || !entry.owner) {
      toast.error('Please fill in task and assignee');
      return;
    }
    assignMutation.mutate(entry);
  };

  const handleEditSubmit = () => {
    if (!entry.task || !entry.owner) {
      toast.error('Please fill in task and assignee');
      return;
    }
    if (editId) updateMutation.mutate({ id: editId, data: entry });
  };

  const handleCompleteSubmit = () => {
    if (!completeDuration || parseFloat(completeDuration) <= 0) {
      toast.error('Please enter how long this took');
      return;
    }
    if (completeId) completeMutation.mutate({ id: completeId, duration: completeDuration, notes: completeNotes });
  };

  const handleBulkImport = async (entries: TimesheetEntry[]) => {
    await new Promise<void>((resolve, reject) => {
      importMutation.mutate(entries, {
        onSuccess: () => resolve(),
        onError: (err) => reject(err),
      });
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === timesheets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(timesheets.map(t => t.id)));
    }
  };

  const handleBulkStatus = (status: TimesheetStatus) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkStatusMutation.mutate({ ids, status });
  };

  const exportToExcel = (entries: typeof timesheets, filename: string) => {
    const rows = entries.map(t => ({
      Task: t.task,
      Owner: t.owner,
      Duration: t.duration != null ? Number(t.duration) : '',
      Date: t.date ? new Date(t.date).toLocaleDateString('en-IN') : '',
      'Due Date': t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN') : '',
      Status: STATUS_LABELS[(t.status as TimesheetStatus) || 'new'],
      Notes: t.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheets');
    XLSX.writeFile(wb, filename);
  };

  const handleExportSelected = () => {
    const selected = timesheets.filter(t => selectedIds.has(t.id));
    if (selected.length === 0) return;
    exportToExcel(selected, `timesheets-selected-${projectId.slice(0, 8)}.xlsx`);
    toast.success(`${selected.length} entries exported`);
  };

  const handleExportAll = () => {
    if (timesheets.length === 0) return;
    exportToExcel(timesheets, `timesheets-all-${projectId.slice(0, 8)}.xlsx`);
    toast.success(`${timesheets.length} entries exported`);
  };

  const totalHours = timesheets.reduce((sum, t) => sum + Number(t.duration ?? 0), 0);
  const selectedHours = timesheets
    .filter(t => selectedIds.has(t.id))
    .reduce((sum, t) => sum + Number(t.duration ?? 0), 0);
  const hasSelection = selectedIds.size > 0;

  const renderAssigneeField = (value: string, onChange: (label: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id="owner">
        <SelectValue placeholder="Select assignee" />
      </SelectTrigger>
      <SelectContent>
        {/* Keep a pre-existing value selectable even if it's not in the roster
            (e.g. imported from a spreadsheet, or a former team member). */}
        {value && !teamRoster.some(m => (m.full_name || m.email) === value) && (
          <SelectItem value={value}>{value}</SelectItem>
        )}
        {teamRoster.map(member => (
          <SelectItem key={member.user_id} value={member.full_name || member.email}>
            {member.full_name || member.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {hasSelection ? (
                <>
                  {selectedIds.size} of {timesheets.length} selected
                </>
              ) : (
                <>
                  {timesheets.length} {timesheets.length === 1 ? 'task' : 'tasks'}
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {hasSelection
                ? `${selectedHours.toFixed(1)} selected hours`
                : `${totalHours.toFixed(1)} total hours logged`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <RequirePermission module="timesheets" action="create">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportOpen(true)}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import CSV/Excel
            </Button>
          </RequirePermission>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            disabled={timesheets.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
          <RequirePermission module="timesheets" action="create">
            <Button size="sm" onClick={openAssignDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Assign Task
            </Button>
          </RequirePermission>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} selected
          </span>
          <span className="text-sm text-muted-foreground">— Update status to:</span>
          <RequirePermission module="timesheets" action="update">
            <div className="flex gap-1.5">
              {TIMESHEET_STATUSES.map(status => (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={bulkStatusMutation.isPending}
                  onClick={() => handleBulkStatus(status)}
                >
                  {STATUS_LABELS[status]}
                </Button>
              ))}
            </div>
          </RequirePermission>
          {bulkStatusMutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleExportSelected}
            >
              <Download className="h-3.5 w-3.5" />
              Export Selected
            </Button>
          </div>
        </div>
      )}

      {/* Timesheets Table */}
      {timesheets.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10">
                  <Checkbox
                    checked={timesheets.length > 0 && selectedIds.size === timesheets.length}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="font-semibold">Task</TableHead>
                <TableHead className="font-semibold">Assignee</TableHead>
                <TableHead className="font-semibold">Duration (hrs)</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Notes</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {timesheets.map(ts => {
                const status = (ts.status as TimesheetStatus) || 'new';
                return (
                <TableRow key={ts.id} className="group" data-state={selectedIds.has(ts.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(ts.id)}
                      onCheckedChange={() => toggleSelect(ts.id)}
                      aria-label={`Select ${ts.task}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{ts.task}</TableCell>
                  <TableCell className="text-muted-foreground">{ts.owner}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {ts.duration != null ? Number(ts.duration).toFixed(1) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div>{format(new Date(ts.date), 'MMM dd, yyyy')}</div>
                    {ts.due_date && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground/80">
                        <CalendarClock className="h-3 w-3" />
                        Due {format(new Date(ts.due_date), 'MMM dd')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`text-xs ${STATUS_STYLES[status]}`}>
                      {STATUS_LABELS[status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px]">
                    {ts.notes ? (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block truncate cursor-help">{ts.notes}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap break-words">
                            {ts.notes}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {status === 'new' && (
                        <RequirePermission module="timesheets" action="update">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary"
                            onClick={() => startMutation.mutate(ts.id)}
                            disabled={startMutation.isPending}
                            aria-label="Start task"
                            title="Start"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        </RequirePermission>
                      )}
                      {status === 'in-progress' && (
                        <RequirePermission module="timesheets" action="update">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600"
                            onClick={() => openCompleteDialog(ts.id)}
                            aria-label="Complete task"
                            title="Complete"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        </RequirePermission>
                      )}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <RequirePermission module="timesheets" action="update">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(ts)}
                            aria-label="Edit entry"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </RequirePermission>
                        <RequirePermission module="timesheets" action="delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(ts.id)}
                            aria-label="Delete entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </RequirePermission>
                      </div>
                    </div>
                  </TableCell>

                </TableRow>
              );})}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">No tasks assigned yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Assign a task to a team member, or import completed work from CSV/Excel
            </p>
            <RequirePermission module="timesheets" action="create">
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import File
              </Button>
              <Button size="sm" onClick={openAssignDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Assign Task
              </Button>
            </div>
            </RequirePermission>
          </CardContent>
        </Card>
      )}

      {/* Assign Task Dialog -- no duration/status fields: the task hasn't
          started yet, so how long it takes and its progress aren't knowable. */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task">Task *</Label>
              <Input
                id="task"
                placeholder="e.g. Homepage design"
                value={entry.task}
                onChange={e => setEntry(prev => ({ ...prev, task: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner">Assignee *</Label>
              {renderAssigneeField(entry.owner, setAssignee)}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={entry.dueDate}
                onChange={e => setEntry(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Optional notes"
                value={entry.notes}
                onChange={e => setEntry(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignSubmit} disabled={assignMutation.isPending}>
              {assignMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Assign Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Task Dialog -- the only place duration is entered, since it's
          only knowable once the work is actually done. */}
      <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="completeDuration">How long did this take (hrs)? *</Label>
              <Input
                id="completeDuration"
                type="number"
                step="0.5"
                min="0"
                placeholder="e.g. 2.5"
                value={completeDuration}
                onChange={e => setCompleteDuration(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="completeNotes">Notes</Label>
              <Input
                id="completeNotes"
                placeholder="Optional notes"
                value={completeNotes}
                onChange={e => setCompleteNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCompleteOpen(false)}>Cancel</Button>
            <Button onClick={handleCompleteSubmit} disabled={completeMutation.isPending}>
              {completeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Edit Dialog -- covers every field, for corrections or manual overrides. */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Timesheet Entry</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editTask">Task *</Label>
              <Input
                id="editTask"
                placeholder="e.g. Homepage design"
                value={entry.task}
                onChange={e => setEntry(prev => ({ ...prev, task: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editOwner">Assignee *</Label>
                {renderAssigneeField(entry.owner, setAssignee)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="editDuration">Duration (hrs)</Label>
                <Input
                  id="editDuration"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="Not started yet"
                  value={entry.duration}
                  onChange={e => setEntry(prev => ({ ...prev, duration: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editDate">Date</Label>
                <Input
                  id="editDate"
                  type="date"
                  value={entry.date}
                  onChange={e => setEntry(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editDueDate">Due Date</Label>
                <Input
                  id="editDueDate"
                  type="date"
                  value={entry.dueDate}
                  onChange={e => setEntry(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editStatus">Status</Label>
              <Select
                value={entry.status || 'new'}
                onValueChange={value => setEntry(prev => ({ ...prev, status: value as TimesheetStatus }))}
              >
                <SelectTrigger id="editStatus">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {TIMESHEET_STATUSES.map(status => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editNotes">Notes</Label>
              <Input
                id="editNotes"
                placeholder="Optional notes"
                value={entry.notes}
                onChange={e => setEntry(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditId(null); }}>Cancel</Button>
            <Button onClick={handleEditSubmit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <TimesheetImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={handleBulkImport}
      />
    </div>
  );
}
