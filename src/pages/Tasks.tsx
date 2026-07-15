import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Plus,
  Trash2,
  Loader2,
  ListTodo,
  Pencil,
  Play,
  CheckCircle2,
  CalendarClock,
  User,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import {
  useTaskMutations,
  TASK_STATUSES,
  TaskStatus,
  STATUS_STYLES,
  STATUS_LABELS,
  TaskEntry,
  emptyTaskEntry,
} from '@/hooks/useTaskMutations';
import { PageHeader } from '@/components/shared/PageHeader';
import { RequirePermission } from '@/components/shared/RequirePermission';
import { NoAccessState } from '@/components/shared/NoAccessState';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

const NO_PROJECT_VALUE = '__none__';
const ALL_VALUE = '__all__';
const PAGE_SIZE = 20;

export default function Tasks() {
  const { user } = useAuth();
  const { workspaceUserId, can, loading: permLoading } = useWorkspaceUser();

  const { data: teamRoster = [] } = useQuery({
    queryKey: ['team-roster', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_team_roster');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list-for-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name')
        .order('project_name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const [statusFilter, setStatusFilter] = useState<TaskStatus | typeof ALL_VALUE>(ALL_VALUE);
  const [assigneeFilter, setAssigneeFilter] = useState<string>(ALL_VALUE);
  const [projectFilter, setProjectFilter] = useState<string>(ALL_VALUE);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [dueOnly, setDueOnly] = useState(false);
  const [page, setPage] = useState(0);

  // Filters are applied server-side (not just the current page fetched), so
  // changing any of them can change the total row count -- reset to page 0
  // or a stale page could come back empty.
  useEffect(() => {
    setPage(0);
  }, [statusFilter, assigneeFilter, projectFilter, myTasksOnly, dueOnly]);

  const { data: taskPage, isLoading: tasksLoading } = useQuery({
    queryKey: ['timesheets', 'all', { statusFilter, assigneeFilter, projectFilter, myTasksOnly, dueOnly, page }],
    queryFn: async () => {
      let query = supabase
        .from('timesheets')
        .select('*, projects(id, project_name)', { count: 'exact' });

      if (statusFilter !== ALL_VALUE) {
        query = query.eq('status', statusFilter);
      }
      if (myTasksOnly) {
        query = query.eq('assignee_user_id', user?.id ?? '');
      } else if (assigneeFilter !== ALL_VALUE) {
        query = query.eq('assignee_user_id', assigneeFilter);
      }
      if (projectFilter === NO_PROJECT_VALUE) {
        query = query.is('project_id', null);
      } else if (projectFilter !== ALL_VALUE) {
        query = query.eq('project_id', projectFilter);
      }
      if (dueOnly) {
        query = query.not('due_date', 'is', null).in('status', ['new', 'in-progress']);
      }

      const from = page * PAGE_SIZE;
      const { data, error, count } = await query
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
    enabled: !!user,
  });

  const tasks = taskPage?.rows ?? [];
  const totalCount = taskPage?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [entry, setEntry] = useState<TaskEntry>({ ...emptyTaskEntry });
  const [editId, setEditId] = useState<string | null>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [completeDuration, setCompleteDuration] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    assignMutation,
    deleteMutation,
    updateMutation,
    startMutation,
    completeMutation,
  } = useTaskMutations({
    workspaceUserId,
    onAssignSuccess: () => {
      setIsAssignOpen(false);
      setEntry({ ...emptyTaskEntry });
    },
    onUpdateSuccess: () => {
      setIsEditOpen(false);
      setEditId(null);
      setEntry({ ...emptyTaskEntry });
    },
    onCompleteSuccess: () => {
      setIsCompleteOpen(false);
      setCompleteId(null);
    },
  });

  const setAssignee = (rosterLabel: string) => {
    const member = teamRoster.find((m) => (m.full_name || m.email) === rosterLabel);
    setEntry((prev) => ({ ...prev, owner: rosterLabel, assigneeUserId: member?.user_id || '' }));
  };

  const openAssignDialog = () => {
    setEditId(null);
    setEntry({ ...emptyTaskEntry });
    setIsAssignOpen(true);
  };

  const openEditDialog = (t: any) => {
    setEditId(t.id);
    setEntry({
      task: t.task ?? '',
      owner: t.owner ?? '',
      assigneeUserId: t.assignee_user_id ?? '',
      duration: t.duration != null ? String(t.duration) : '',
      date: t.date ? String(t.date).split('T')[0] : new Date().toISOString().split('T')[0],
      dueDate: t.due_date ? String(t.due_date).split('T')[0] : '',
      notes: t.notes ?? '',
      status: (t.status as TaskStatus) || 'new',
      projectId: t.project_id ?? '',
    });
    setIsEditOpen(true);
  };

  const openCompleteDialog = (id: string) => {
    setCompleteId(id);
    setCompleteDuration('');
    setCompleteNotes('');
    setIsCompleteOpen(true);
  };

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

  const renderAssigneeField = (value: string, onChange: (label: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id="owner">
        <SelectValue placeholder="Select assignee" />
      </SelectTrigger>
      <SelectContent>
        {value && !teamRoster.some((m) => (m.full_name || m.email) === value) && (
          <SelectItem value={value}>{value}</SelectItem>
        )}
        {teamRoster.map((member) => (
          <SelectItem key={member.user_id} value={member.full_name || member.email}>
            {member.full_name || member.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const renderProjectField = (value: string, onChange: (value: string) => void) => (
    <Select value={value || NO_PROJECT_VALUE} onValueChange={(v) => onChange(v === NO_PROJECT_VALUE ? '' : v)}>
      <SelectTrigger id="project">
        <SelectValue placeholder="No project (general task)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_PROJECT_VALUE}>No project (general task)</SelectItem>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.project_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (tasksLoading || permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!can('timesheets', 'read')) {
    return (
      <div className="space-y-6 p-8">
        <PageHeader title="Tasks" description="Every task assigned across your workspace" />
        <NoAccessState moduleLabel="tasks" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Tasks"
        description="Every task assigned across your workspace — project-linked or general"
        actions={
          <RequirePermission module="timesheets" action="create">
            <Button size="lg" onClick={openAssignDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Assign Task
            </Button>
          </RequirePermission>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={myTasksOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMyTasksOnly((prev) => !prev)}
        >
          <User className="mr-2 h-4 w-4" />
          My Tasks
        </Button>

        <Button
          variant={dueOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDueOnly((prev) => !prev)}
        >
          <CalendarClock className="mr-2 h-4 w-4" />
          Due Tasks
        </Button>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | typeof ALL_VALUE)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
            {TASK_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={assigneeFilter}
          onValueChange={(v) => {
            setAssigneeFilter(v);
            if (v !== ALL_VALUE) setMyTasksOnly(false);
          }}
          disabled={myTasksOnly}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All assignees</SelectItem>
            {teamRoster.map((member) => (
              <SelectItem key={member.user_id} value={member.user_id}>
                {member.full_name || member.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All projects</SelectItem>
            <SelectItem value={NO_PROJECT_VALUE}>General (no project)</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.project_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tasks.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold">Task</TableHead>
                <TableHead className="font-semibold">Project</TableHead>
                <TableHead className="font-semibold">Assignee</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t: any) => {
                const status = (t.status as TaskStatus) || 'new';
                return (
                  <TableRow key={t.id} className="group">
                    <TableCell className="font-medium text-foreground">
                      <div>{t.task}</div>
                      {t.notes && (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="mt-0.5 max-w-[280px] truncate text-xs font-normal text-muted-foreground cursor-help">
                                {t.notes}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap break-words">
                              {t.notes}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.projects ? (
                        <Link to={`/projects/${t.project_id}`} className="hover:underline">
                          {t.projects.project_name}
                        </Link>
                      ) : (
                        <Badge variant="outline" className="text-xs">General</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.owner}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div>{format(new Date(t.date), 'MMM dd, yyyy')}</div>
                      {t.due_date && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground/80">
                          <CalendarClock className="h-3 w-3" />
                          Due {format(new Date(t.due_date), 'MMM dd')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${STATUS_STYLES[status]}`}>
                        {STATUS_LABELS[status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {status === 'new' && (
                          <RequirePermission module="timesheets" action="update">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary"
                              onClick={() => startMutation.mutate(t.id)}
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
                              onClick={() => openCompleteDialog(t.id)}
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
                              onClick={() => openEditDialog(t)}
                              aria-label="Edit task"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </RequirePermission>
                          <RequirePermission module="timesheets" action="delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(t.id)}
                              aria-label="Delete task"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </RequirePermission>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={ListTodo}
          title="No tasks match these filters"
          description="Assign a task to a team member — it can be tied to a project or kept general."
          actionLabel="Assign Task"
          onAction={openAssignDialog}
        />
      )}

      {totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min(totalCount, (page + 1) * PAGE_SIZE)} of {totalCount} tasks
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span>Page {page + 1} of {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Assign Task Dialog */}
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
                onChange={(e) => setEntry((prev) => ({ ...prev, task: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner">Assignee *</Label>
              {renderAssigneeField(entry.owner, setAssignee)}
            </div>
            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              {renderProjectField(entry.projectId || '', (v) => setEntry((prev) => ({ ...prev, projectId: v })))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={entry.dueDate}
                onChange={(e) => setEntry((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Optional notes"
                value={entry.notes}
                onChange={(e) => setEntry((prev) => ({ ...prev, notes: e.target.value }))}
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

      {/* Complete Task Dialog */}
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
                onChange={(e) => setCompleteDuration(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="completeNotes">Notes</Label>
              <Input
                id="completeNotes"
                placeholder="Optional notes"
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
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

      {/* Edit Dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editTask">Task *</Label>
              <Input
                id="editTask"
                value={entry.task}
                onChange={(e) => setEntry((prev) => ({ ...prev, task: e.target.value }))}
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
                  onChange={(e) => setEntry((prev) => ({ ...prev, duration: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editProject">Project</Label>
              {renderProjectField(entry.projectId || '', (v) => setEntry((prev) => ({ ...prev, projectId: v })))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editDate">Date</Label>
                <Input
                  id="editDate"
                  type="date"
                  value={entry.date}
                  onChange={(e) => setEntry((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editDueDate">Due Date</Label>
                <Input
                  id="editDueDate"
                  type="date"
                  value={entry.dueDate}
                  onChange={(e) => setEntry((prev) => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editStatus">Status</Label>
              <Select
                value={entry.status || 'new'}
                onValueChange={(value) => setEntry((prev) => ({ ...prev, status: value as TaskStatus }))}
              >
                <SelectTrigger id="editStatus">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((status) => (
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
                onChange={(e) => setEntry((prev) => ({ ...prev, notes: e.target.value }))}
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
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) })}
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
