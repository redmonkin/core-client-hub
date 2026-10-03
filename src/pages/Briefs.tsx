import { useState } from 'react';
import { format } from 'date-fns';
import {
  Plus,
  ClipboardList,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  Clock,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Brief {
  id: string;
  user_id: string;
  date: string;
  state: string | null;
  today_focus: string | null;
  pre_drafted_replies: string | null;
  follow_ups_owed: string | null;
  deferred: string | null;
  has_expiring_proposals: boolean;
  has_unsigned_contracts: boolean;
  has_overdue_items: boolean;
  item_count: number;
  reviewed: boolean;
  review_notes: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

const today = () => format(new Date(), 'yyyy-MM-dd');

const emptyForm = {
  date: today(),
  state: '',
  today_focus: '',
  pre_drafted_replies: '',
  follow_ups_owed: '',
  deferred: '',
  has_expiring_proposals: false,
  has_unsigned_contracts: false,
  has_overdue_items: false,
  item_count: 0,
  reviewed: false,
  review_notes: '',
};

export default function Briefs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Brief | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Brief | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Briefs (RLS already restricts to current user)
  const { data: briefs = [], isLoading } = useQuery({
    queryKey: ['briefs', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('briefs')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Brief[];
    },
  });


  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const payload = {
        user_id: user.id,
        date: form.date,
        state: form.state || null,
        today_focus: form.today_focus || null,
        pre_drafted_replies: form.pre_drafted_replies || null,
        follow_ups_owed: form.follow_ups_owed || null,
        deferred: form.deferred || null,
        has_expiring_proposals: form.has_expiring_proposals,
        has_unsigned_contracts: form.has_unsigned_contracts,
        has_overdue_items: form.has_overdue_items,
        item_count: Number(form.item_count) || 0,
        reviewed: form.reviewed,
        review_notes: form.review_notes || null,
      };

      if (editing) {
        const { error } = await (supabase as any)
          .from('briefs')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('briefs').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['briefs', user?.id] });
      toast.success(editing ? 'Brief updated' : 'Brief created');
      closeDialog();
    },
    onError: (e: any) => {
      const msg = e?.message || 'Failed to save brief';
      if (msg.includes('briefs_user_date_unique')) {
        toast.error('You already have a brief for this date');
      } else if (msg.includes('future')) {
        toast.error('Brief date cannot be in the future');
      } else {
        toast.error(msg);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('briefs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['briefs', user?.id] });
      toast.success('Brief deleted');
      setDeletingId(null);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const openEdit = (b: Brief) => {
    setEditing(b);
    setForm({
      date: b.date,
      state: b.state ?? '',
      today_focus: b.today_focus ?? '',
      pre_drafted_replies: b.pre_drafted_replies ?? '',
      follow_ups_owed: b.follow_ups_owed ?? '',
      deferred: b.deferred ?? '',
      has_expiring_proposals: b.has_expiring_proposals,
      has_unsigned_contracts: b.has_unsigned_contracts,
      has_overdue_items: b.has_overdue_items,
      item_count: b.item_count,
      reviewed: b.reviewed,
      review_notes: b.review_notes ?? '',
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };


  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Briefs"
        description="Your private daily briefs — only you can see these."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Brief
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : briefs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No briefs yet"
          description="Create your first daily brief to track focus, follow-ups, and deferred items."
          actionLabel="Create Brief"
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {briefs.map((b) => (
            <Card
              key={b.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setViewing(b)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {format(new Date(b.date), 'EEE, dd MMM yyyy')}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      {b.reviewed && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Reviewed
                        </Badge>
                      )}
                      {b.item_count > 0 && (
                        <Badge variant="outline">{b.item_count} items</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(b)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeletingId(b.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {b.today_focus && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Today's Focus
                    </p>
                    <p className="line-clamp-3 whitespace-pre-line text-sm text-foreground">
                      {b.today_focus}
                    </p>
                  </div>
                )}

                {(b.has_expiring_proposals ||
                  b.has_unsigned_contracts ||
                  b.has_overdue_items) && (
                  <div className="flex flex-wrap gap-2">
                    {b.has_expiring_proposals && (
                      <Badge variant="destructive" className="gap-1">
                        <Clock className="h-3 w-3" /> Expiring proposals
                      </Badge>
                    )}
                    {b.has_unsigned_contracts && (
                      <Badge variant="destructive" className="gap-1">
                        <FileWarning className="h-3 w-3" /> Unsigned contracts
                      </Badge>
                    )}
                    {b.has_overdue_items && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> Overdue items
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(o) => (o ? setIsDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Brief' : 'New Brief'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                max={today()}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="sm:max-w-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Textarea
                id="state"
                rows={2}
                placeholder="2-3 bullets on the current state"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="today_focus">Today's Focus</Label>
              <Textarea
                id="today_focus"
                rows={4}
                placeholder="Top 4 priorities for today"
                value={form.today_focus}
                onChange={(e) => setForm({ ...form, today_focus: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pre_drafted_replies">Pre-drafted Replies</Label>
              <Textarea
                id="pre_drafted_replies"
                rows={3}
                value={form.pre_drafted_replies}
                onChange={(e) =>
                  setForm({ ...form, pre_drafted_replies: e.target.value })
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="follow_ups_owed">Follow-ups Owed</Label>
                <Textarea
                  id="follow_ups_owed"
                  rows={3}
                  value={form.follow_ups_owed}
                  onChange={(e) =>
                    setForm({ ...form, follow_ups_owed: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deferred">Deferred</Label>
                <Textarea
                  id="deferred"
                  rows={3}
                  value={form.deferred}
                  onChange={(e) => setForm({ ...form, deferred: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-3 text-sm font-medium">Quick-reference flags</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.has_expiring_proposals}
                    onCheckedChange={(c) =>
                      setForm({ ...form, has_expiring_proposals: !!c })
                    }
                  />
                  Expiring proposals
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.has_unsigned_contracts}
                    onCheckedChange={(c) =>
                      setForm({ ...form, has_unsigned_contracts: !!c })
                    }
                  />
                  Unsigned contracts
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.has_overdue_items}
                    onCheckedChange={(c) =>
                      setForm({ ...form, has_overdue_items: !!c })
                    }
                  />
                  Overdue items
                </label>
              </div>
              <div className="mt-4 max-w-xs space-y-2">
                <Label htmlFor="item_count">Total actionable items</Label>
                <Input
                  id="item_count"
                  type="number"
                  min={0}
                  value={form.item_count}
                  onChange={(e) =>
                    setForm({ ...form, item_count: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={form.reviewed}
                  onCheckedChange={(c) => setForm({ ...form, reviewed: !!c })}
                />
                Mark as reviewed
              </label>
              <Textarea
                rows={2}
                placeholder="Review notes (optional)"
                value={form.review_notes}
                onChange={(e) => setForm({ ...form, review_notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={upsertMutation.isPending || !form.date}
            >
              {upsertMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editing ? 'Save Changes' : 'Create Brief'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {format(new Date(viewing.date), 'EEEE, dd MMM yyyy')}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {viewing.reviewed && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Reviewed
                    </Badge>
                  )}
                  {viewing.item_count > 0 && (
                    <Badge variant="outline">{viewing.item_count} items</Badge>
                  )}
                  {viewing.has_expiring_proposals && (
                    <Badge variant="destructive" className="gap-1">
                      <Clock className="h-3 w-3" /> Expiring proposals
                    </Badge>
                  )}
                  {viewing.has_unsigned_contracts && (
                    <Badge variant="destructive" className="gap-1">
                      <FileWarning className="h-3 w-3" /> Unsigned contracts
                    </Badge>
                  )}
                  {viewing.has_overdue_items && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> Overdue items
                    </Badge>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {[
                  { label: 'State', value: viewing.state },
                  { label: "Today's Focus", value: viewing.today_focus },
                  { label: 'Pre-drafted Replies', value: viewing.pre_drafted_replies },
                  { label: 'Follow-ups Owed', value: viewing.follow_ups_owed },
                  { label: 'Deferred', value: viewing.deferred },
                  { label: 'Review Notes', value: viewing.review_notes },
                ]
                  .filter((s) => s.value)
                  .map((s) => (
                    <div key={s.label}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {s.label}
                      </p>
                      <p className="whitespace-pre-line text-sm text-foreground">
                        {s.value}
                      </p>
                    </div>
                  ))}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewing(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const b = viewing;
                    setViewing(null);
                    openEdit(b);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this brief?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
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
