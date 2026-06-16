import { useState } from 'react';
import { Plus, Upload, Trash2, Clock, Loader2, FileSpreadsheet, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
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

const TIMESHEET_STATUSES = ['pending', 'in-progress', 'completed', 'billed'] as const;
type TimesheetStatus = typeof TIMESHEET_STATUSES[number];

const STATUS_STYLES: Record<TimesheetStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  billed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

const STATUS_LABELS: Record<TimesheetStatus, string> = {
  pending: 'Pending',
  'in-progress': 'In Progress',
  completed: 'Completed',
  billed: 'Billed',
};

interface ProjectTimesheetsProps {
  projectId: string;
}

interface TimesheetEntry {
  task: string;
  owner: string;
  duration: string;
  date: string;
  notes: string;
}

const emptyEntry: TimesheetEntry = {
  task: '',
  owner: '',
  duration: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
};

export function ProjectTimesheets({ projectId }: ProjectTimesheetsProps) {
  const { user } = useAuth();
  const { workspaceUserId } = useWorkspaceUser();
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

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [entry, setEntry] = useState<TimesheetEntry>({ ...emptyEntry });
  const [editId, setEditId] = useState<string | null>(null);

  const openAddDialog = () => {
    setEditId(null);
    setEntry({ ...emptyEntry, owner: userFirstName });
    setIsAddOpen(true);
  };

  const openEditDialog = (ts: any) => {
    setEditId(ts.id);
    setEntry({
      task: ts.task ?? '',
      owner: ts.owner ?? '',
      duration: String(ts.duration ?? ''),
      date: ts.date ? String(ts.date).split('T')[0] : new Date().toISOString().split('T')[0],
      notes: ts.notes ?? '',
    });
    setIsAddOpen(true);
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ['timesheets', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timesheets')
        .select('*')
        .eq('project_id', projectId)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (entries: TimesheetEntry[]) => {
      const rows = entries.map(e => ({
        project_id: projectId,
        user_id: workspaceUserId,
        task: e.task,
        owner: e.owner,
        duration: parseFloat(e.duration) || 0,
        date: e.date,
        notes: e.notes || null,
      }));
      const { error } = await supabase.from('timesheets').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', projectId] });
      setIsAddOpen(false);
      setEntry({ ...emptyEntry, owner: userFirstName });
      toast.success('Timesheet entry added');
    },
    onError: (error: any) => {
      toast.error('Failed to add entry: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('timesheets').delete().eq('id', id);
      if (error) throw error;
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
      const { error } = await supabase
        .from('timesheets')
        .update({
          task: data.task,
          owner: data.owner,
          duration: parseFloat(data.duration) || 0,
          date: data.date,
          notes: data.notes || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', projectId] });
      setIsAddOpen(false);
      setEditId(null);
      setEntry({ ...emptyEntry, owner: userFirstName });
      toast.success('Timesheet entry updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update entry: ' + error.message);
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase
        .from('timesheets')
        .update({ status })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', projectId] });
      setSelectedIds(new Set());
      toast.success(`${variables.ids.length} entries updated to "${STATUS_LABELS[variables.status as TimesheetStatus]}"`);
    },
    onError: (error: any) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  const handleSubmit = () => {
    if (!entry.task || !entry.owner || !entry.duration) {
      toast.error('Please fill in task, owner, and duration');
      return;
    }
    if (editId) {
      updateMutation.mutate({ id: editId, data: entry });
    } else {
      createMutation.mutate([entry]);
    }
  };


  const handleBulkImport = async (entries: TimesheetEntry[]) => {
    await new Promise<void>((resolve, reject) => {
      createMutation.mutate(entries, {
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

  const totalHours = timesheets.reduce((sum, t) => sum + Number(t.duration), 0);
  const selectedHours = timesheets
    .filter(t => selectedIds.has(t.id))
    .reduce((sum, t) => sum + Number(t.duration), 0);
  const hasSelection = selectedIds.size > 0;

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
                  {timesheets.length} {timesheets.length === 1 ? 'entry' : 'entries'}
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {hasSelection
                ? `${selectedHours.toFixed(1)} selected hours`
                : `${totalHours.toFixed(1)} total hours`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import CSV/Excel
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} selected
          </span>
          <span className="text-sm text-muted-foreground">— Update status to:</span>
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
          {bulkStatusMutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
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
                <TableHead className="font-semibold">Owner</TableHead>
                <TableHead className="font-semibold">Duration (hrs)</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Notes</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {timesheets.map(ts => (
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
                  <TableCell className="text-muted-foreground">{Number(ts.duration).toFixed(1)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(ts.date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`text-xs ${STATUS_STYLES[(ts.status as TimesheetStatus) || 'pending']}`}>
                      {STATUS_LABELS[(ts.status as TimesheetStatus) || 'pending']}
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
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(ts)}
                        aria-label="Edit entry"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(ts.id)}
                        aria-label="Delete entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>

                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">No timesheet entries yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add entries manually or import from CSV/Excel
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import File
              </Button>
              <Button size="sm" onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Entry Dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) setEditId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Timesheet Entry' : 'Add Timesheet Entry'}</DialogTitle>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner">Owner *</Label>
                <Input
                  id="owner"
                  placeholder="e.g. John Doe"
                  value={entry.owner}
                  onChange={e => setEntry(prev => ({ ...prev, owner: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (hrs) *</Label>
                <Input
                  id="duration"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g. 2.5"
                  value={entry.duration}
                  onChange={e => setEntry(prev => ({ ...prev, duration: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={entry.date}
                onChange={e => setEntry(prev => ({ ...prev, date: e.target.value }))}
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
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Add Entry
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
