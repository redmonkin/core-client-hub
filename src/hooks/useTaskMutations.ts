import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const TASK_STATUSES = ['new', 'in-progress', 'completed', 'wont-do', 'non-billable', 'billed'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export const STATUS_STYLES: Record<TaskStatus, string> = {
  new: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
  'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'wont-do': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'non-billable': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  billed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'New',
  'in-progress': 'In Progress',
  completed: 'Completed',
  'wont-do': "Won't Do",
  'non-billable': 'Non Billable',
  billed: 'Billed',
};

// Supabase/PostgREST doesn't error on an UPDATE/DELETE that RLS silently
// filters down to zero rows -- it just returns success with nothing changed.
// Without this check, a user lacking the `timesheets` permission would see a
// false "success" toast while nothing actually happened server-side.
export const PERMISSION_DENIED_MESSAGE = "You don't have permission to do that.";
export function assertRowAffected<T>(data: T[] | null): void {
  if (!data || data.length === 0) {
    throw new Error(PERMISSION_DENIED_MESSAGE);
  }
}

export interface TaskEntry {
  task: string;
  owner: string;
  assigneeUserId: string;
  duration: string;
  date: string;
  dueDate: string;
  notes: string;
  status?: TaskStatus;
  projectId?: string;
}

export const emptyTaskEntry: TaskEntry = {
  task: '',
  owner: '',
  assigneeUserId: '',
  duration: '',
  date: new Date().toISOString().split('T')[0],
  dueDate: '',
  notes: '',
  status: 'new',
  projectId: '',
};

interface UseTaskMutationsOptions {
  // Fixed project scope (project detail page). When omitted, each entry's
  // own `projectId` is used instead (global Task Master board), so a task
  // can be assigned to any project or left generic.
  projectId?: string;
  workspaceUserId: string | undefined;
  onAssignSuccess?: () => void;
  onUpdateSuccess?: () => void;
  onCompleteSuccess?: () => void;
}

// All task-board mutations invalidate the `timesheets` query key prefix
// (not a specific scoped key), so edits made from the global Task Master
// board and the per-project view stay in sync with each other.
const TASKS_QUERY_KEY = ['timesheets'];

export function useTaskMutations({
  projectId,
  workspaceUserId,
  onAssignSuccess,
  onUpdateSuccess,
  onCompleteSuccess,
}: UseTaskMutationsOptions) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });

  const assignMutation = useMutation({
    mutationFn: async (e: TaskEntry) => {
      const { error } = await supabase.from('timesheets').insert({
        project_id: projectId ?? e.projectId ?? null,
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
      invalidate();
      onAssignSuccess?.();
      toast.success('Task assigned');
    },
    onError: (error: any) => {
      toast.error('Failed to assign task: ' + error.message);
    },
  });

  const importMutation = useMutation({
    mutationFn: async (entries: TaskEntry[]) => {
      const rows = entries.map(e => ({
        project_id: projectId ?? e.projectId ?? null,
        user_id: workspaceUserId,
        task: e.task,
        owner: e.owner,
        duration: parseFloat(e.duration) || 0,
        date: e.date,
        notes: e.notes || null,
        status: e.status || 'completed',
      }));
      const { error } = await supabase.from('timesheets').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
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
      invalidate();
      toast.success('Entry deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TaskEntry }) => {
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
          project_id: projectId ?? (data.projectId || null),
        })
        .eq('id', id)
        .select('id');
      if (error) throw error;
      assertRowAffected(rows);
    },
    onSuccess: () => {
      invalidate();
      onUpdateSuccess?.();
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
      invalidate();
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
        .update({ duration: parseFloat(duration) || 0, notes: notes || null, status: 'completed' })
        .eq('id', id)
        .select('id');
      if (error) throw error;
      assertRowAffected(data);
    },
    onSuccess: () => {
      invalidate();
      onCompleteSuccess?.();
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
      invalidate();
      if (updatedCount < variables.ids.length) {
        toast.warning(`${updatedCount} of ${variables.ids.length} entries updated — you may not have permission to update the rest.`);
      } else {
        toast.success(`${updatedCount} entries updated to "${STATUS_LABELS[variables.status as TaskStatus]}"`);
      }
    },
    onError: (error: any) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  return {
    assignMutation,
    importMutation,
    deleteMutation,
    updateMutation,
    startMutation,
    completeMutation,
    bulkStatusMutation,
  };
}
