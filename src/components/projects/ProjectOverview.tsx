import { Link } from 'react-router-dom';
import { format, isPast, isToday } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { ListTodo, Clock, AlertTriangle, CheckCircle2, StickyNote, Paperclip, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS, STATUS_STYLES, TASK_STATUSES, TaskStatus } from '@/hooks/useTaskMutations';

interface ProjectOverviewProps {
  projectId: string;
  onViewNotes?: () => void;
  onViewTasks?: () => void;
}

// Tasks that still represent open work -- used for the "Open" tile and to
// decide which rows count as overdue (a task past due but already billed or
// written off isn't actionable anymore).
const OPEN_STATUSES: TaskStatus[] = ['new', 'in-progress', 'pending'];

export function ProjectOverview({ projectId, onViewNotes, onViewTasks }: ProjectOverviewProps) {
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['timesheets', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timesheets')
        .select('id, status, due_date, duration')
        .eq('project_id', projectId);
      if (error) throw error;
      return data;
    },
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['project-notes', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_notes')
        .select('id, content, file_name, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const total = tasks.length;
  const statusCounts = TASK_STATUSES.reduce((acc, status) => {
    acc[status] = tasks.filter((t) => t.status === status).length;
    return acc;
  }, {} as Record<TaskStatus, number>);
  const statusHours = TASK_STATUSES.reduce((acc, status) => {
    acc[status] = tasks
      .filter((t) => t.status === status)
      .reduce((sum, t) => sum + (Number(t.duration) || 0), 0);
    return acc;
  }, {} as Record<TaskStatus, number>);
  const openCount = OPEN_STATUSES.reduce((sum, s) => sum + statusCounts[s], 0);
  const completedCount = total - openCount - statusCounts['wont-do'];
  const overdueCount = tasks.filter(
    (t) => t.due_date && OPEN_STATUSES.includes(t.status as TaskStatus) && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
  ).length;

  const isLoading = tasksLoading || notesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ListTodo className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{total}</p>
              <p className="text-xs text-muted-foreground">Total Tasks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{openCount}</p>
              <p className="text-xs text-muted-foreground">Open</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{overdueCount}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{completedCount}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status breakdown */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Tasks by Status</h3>
              {onViewTasks && (
                <button onClick={onViewTasks} className="text-xs text-primary hover:underline">
                  View all
                </button>
              )}
            </div>
            {total === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No tasks assigned to this project yet</p>
            ) : (
              <div className="space-y-2.5">
                {TASK_STATUSES.filter((status) => statusCounts[status] > 0).map((status) => {
                  const count = statusCounts[status];
                  const hours = statusHours[status];
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={status} className="flex items-center gap-3 text-sm">
                      <Badge variant="outline" className={`w-28 shrink-0 justify-center ${STATUS_STYLES[status]}`}>
                        {STATUS_LABELS[status]}
                      </Badge>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-20 shrink-0 text-right text-muted-foreground">
                        {count} · {hours.toFixed(1)}h
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Latest notes */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Latest Notes</h3>
              {onViewNotes && (
                <button onClick={onViewNotes} className="text-xs text-primary hover:underline">
                  View all
                </button>
              )}
            </div>
            {notes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No notes added yet</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="flex gap-2.5 border-b border-border pb-3 last:border-0 last:pb-0">
                    <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm text-foreground">{note.content}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(note.created_at), 'MMM d, yyyy')}</span>
                        {note.file_name && (
                          <span className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            {note.file_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
