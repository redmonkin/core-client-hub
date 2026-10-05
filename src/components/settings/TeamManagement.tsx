import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  useWorkspaceUser,
  WorkspaceRole,
  PermissionModule,
  PermissionAction,
  PermissionMatrix,
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  fullAccessMatrix,
  noAccessMatrix,
  readOnlyMatrix,
} from '@/hooks/useWorkspaceUser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CONTACT_EMAIL } from '@/lib/site';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, Trash2, Loader2, Mail, Shield, Check, Link2, ChevronDown, ChevronUp } from 'lucide-react';
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
import { toast } from 'sonner';

interface TeamMember {
  id: string;
  owner_id: string;
  member_id: string | null;
  role: string;
  status: string;
  invited_email: string;
  can_view_financials: boolean;
  created_at: string;
}

type AssignableRole = Exclude<WorkspaceRole, 'owner'>;

const ALL_ROLE_LABELS: AssignableRole[] = ['admin', 'manager', 'contributor', 'viewer', 'custom'];

const contributorMatrix = (): PermissionMatrix => {
  const m = readOnlyMatrix();
  m.projects = { create: true, read: true, update: true, delete: false };
  m.timesheets = { create: true, read: true, update: true, delete: false };
  m.notes = { create: true, read: true, update: true, delete: false };
  m.invoices = { create: false, read: false, update: false, delete: false };
  return m;
};

const ROLE_PRESET_MATRICES: Record<Exclude<AssignableRole, 'custom'>, PermissionMatrix> = {
  admin: fullAccessMatrix(),
  manager: fullAccessMatrix(),
  contributor: contributorMatrix(),
  viewer: readOnlyMatrix(),
};

const MODULE_LABELS: Record<PermissionModule, string> = {
  clients: 'Clients',
  projects: 'Projects',
  proposals: 'Proposals',
  contracts: 'Contracts',
  templates: 'Templates',
  timesheets: 'Timesheets',
  invoices: 'Invoices',
  notes: 'Notes',
};

const ACTION_LABELS: Record<PermissionAction, string> = {
  create: 'Create',
  read: 'View',
  update: 'Edit',
  delete: 'Delete',
};

function PermissionMatrixEditor({
  matrix,
  onChange,
}: {
  matrix: PermissionMatrix;
  onChange: (module: PermissionModule, action: PermissionAction, value: boolean) => void;
}) {
  return (
    // Scrolls inside its container on narrow screens instead of clipping the last column.
    <div className="overflow-x-auto">
    <Table className="min-w-[340px]">
      <TableHeader>
        <TableRow>
          <TableHead className="h-8 text-xs">Module</TableHead>
          {PERMISSION_ACTIONS.map((action) => (
            <TableHead key={action} className="h-8 w-14 text-center text-xs">
              {ACTION_LABELS[action]}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {PERMISSION_MODULES.map((module) => (
          <TableRow key={module}>
            <TableCell className="py-1.5 text-xs font-medium">{MODULE_LABELS[module]}</TableCell>
            {PERMISSION_ACTIONS.map((action) => (
              <TableCell key={action} className="py-1.5 text-center">
                <Checkbox
                  checked={matrix[module][action]}
                  onCheckedChange={(checked) => onChange(module, action, checked === true)}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}

export function TeamManagement() {
  const { user, loading: authLoading } = useAuth();
  const { workspaceUserId, role: myRole, loading: workspaceLoading } = useWorkspaceUser();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePreset, setInvitePreset] = useState<AssignableRole>('manager');
  const [inviteMatrix, setInviteMatrix] = useState<PermissionMatrix>(ROLE_PRESET_MATRICES.manager);
  const [inviteCanViewFinancials, setInviteCanViewFinancials] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isRoleLoading = authLoading || workspaceLoading;
  const canManageTeam = myRole === 'owner' || myRole === 'admin';

  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['team-members', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('owner_id', workspaceUserId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!user && !!workspaceUserId && canManageTeam && !isRoleLoading,
  });

  // Seat limit (app_settings.max_members_per_workspace): the owner plus active
  // and pending invitations. Keyed under 'team-members' so every invalidation
  // of the team list refreshes it too.
  const { data: seats } = useQuery({
    queryKey: ['team-members', 'seats', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_workspace_seats');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { seats_used: number; seat_limit: number | null } | undefined;
    },
    enabled: !!user && !!workspaceUserId && canManageTeam && !isRoleLoading,
  });
  const seatsFull = !!seats && seats.seat_limit != null && seats.seats_used >= seats.seat_limit;

  const { data: permissionsByMember = {} } = useQuery({
    queryKey: ['team-member-permissions', workspaceUserId, teamMembers.map((m) => m.id).join(',')],
    queryFn: async () => {
      const ids = teamMembers.map((m) => m.id);
      if (ids.length === 0) return {};
      const { data, error } = await supabase
        .from('team_member_permissions')
        .select('team_member_id, module, can_create, can_read, can_update, can_delete')
        .in('team_member_id', ids);
      if (error) throw error;
      const byMember: Record<string, PermissionMatrix> = {};
      for (const m of teamMembers) byMember[m.id] = noAccessMatrix();
      for (const row of data || []) {
        const mod = row.module as PermissionModule;
        if (!PERMISSION_MODULES.includes(mod)) continue;
        byMember[row.team_member_id][mod] = {
          create: row.can_create,
          read: row.can_read,
          update: row.can_update,
          delete: row.can_delete,
        };
      }
      return byMember;
    },
    enabled: teamMembers.length > 0,
  });

  const applyPermissions = async (teamMemberId: string, matrix: PermissionMatrix) => {
    const rows = PERMISSION_MODULES.map((module) => ({
      team_member_id: teamMemberId,
      module,
      can_create: matrix[module].create,
      can_read: matrix[module].read,
      can_update: matrix[module].update,
      can_delete: matrix[module].delete,
    }));
    const { error } = await supabase.from('team_member_permissions').upsert(rows, { onConflict: 'team_member_id,module' });
    if (error) throw error;
  };

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role, matrix, canViewFinancials }: { email: string; role: AssignableRole; matrix: PermissionMatrix; canViewFinancials: boolean }) => {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) throw new Error('Email is required');
      if (trimmedEmail === user?.email?.toLowerCase()) throw new Error('You cannot invite yourself');

      const { data: inserted, error } = await supabase.from('team_members').insert({
        owner_id: workspaceUserId!,
        invited_email: trimmedEmail,
        role,
        can_view_financials: canViewFinancials,
        status: 'pending',
      } as any).select('id').single();

      if (error) {
        if (error.code === '23505') throw new Error('This email has already been invited');
        if (error.message?.includes('seat_limit_reached')) {
          throw new Error('Your workspace has reached its team member limit.');
        }
        throw error;
      }

      await applyPermissions(inserted.id, matrix);
    },
    onSuccess: (_: void, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['team-member-permissions'] });
      setInviteEmail('');
      setInvitePreset('manager');
      setInviteMatrix(ROLE_PRESET_MATRICES.manager);
      setInviteCanViewFinancials(true);
      toast.success('Team member invited successfully');

      // Send invitation email
      supabase.functions.invoke('send-notification-email', {
        body: {
          type: 'team_invite',
          recipientEmail: variables.email.trim().toLowerCase(),
          recipientName: '',
          data: {
            inviterName: user?.email || 'Your team',
            appUrl: window.location.origin,
          },
        },
      }).catch((err) => console.error('Failed to send invite email:', err));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role, matrix }: { id: string; role: AssignableRole; matrix: PermissionMatrix }) => {
      const { error } = await supabase.from('team_members').update({ role }).eq('id', id);
      if (error) throw error;
      await applyPermissions(id, matrix);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['team-member-permissions'] });
      toast.success('Team member updated');
    },
    onError: (error) => {
      toast.error('Failed to update team member: ' + error.message);
    },
  });

  const updateFinancialsMutation = useMutation({
    mutationFn: async ({ id, canViewFinancials }: { id: string; canViewFinancials: boolean }) => {
      const { error } = await supabase.from('team_members').update({ can_view_financials: canViewFinancials }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Team member updated');
    },
    onError: (error) => {
      toast.error('Failed to update team member: ' + error.message);
    },
  });

  // Hand-editing a single checkbox marks the member 'custom' and only touches
  // that one module row -- doesn't require re-picking a whole preset. Reads the
  // row fresh from the server right before writing (rather than trusting the
  // `matrix` captured in the render closure) so two rapid edits to the same
  // module can't race and silently drop one of the changes.
  const updateSinglePermissionMutation = useMutation({
    mutationFn: async ({ id, module, action, value }: { id: string; module: PermissionModule; action: PermissionAction; value: boolean }) => {
      const { data: existing, error: fetchError } = await supabase
        .from('team_member_permissions')
        .select('can_create, can_read, can_update, can_delete')
        .eq('team_member_id', id)
        .eq('module', module)
        .maybeSingle();
      if (fetchError) throw fetchError;

      const current = {
        create: existing?.can_create ?? false,
        read: existing?.can_read ?? false,
        update: existing?.can_update ?? false,
        delete: existing?.can_delete ?? false,
        [action]: value,
      };

      const { error: roleError } = await supabase.from('team_members').update({ role: 'custom' }).eq('id', id);
      if (roleError) throw roleError;
      const { error } = await supabase.from('team_member_permissions').upsert({
        team_member_id: id,
        module,
        can_create: current.create,
        can_read: current.read,
        can_update: current.update,
        can_delete: current.delete,
      }, { onConflict: 'team_member_id,module' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['team-member-permissions'] });
    },
    onError: (error) => {
      toast.error('Failed to update permission: ' + error.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      setRemovingId(null);
      toast.success('Team member removed');
    },
    onError: (error) => {
      toast.error('Failed to remove team member: ' + error.message);
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate({ email: inviteEmail, role: invitePreset, matrix: inviteMatrix, canViewFinancials: inviteCanViewFinancials });
  };

  const handleInvitePresetChange = (value: AssignableRole) => {
    setInvitePreset(value);
    if (value !== 'custom') setInviteMatrix(ROLE_PRESET_MATRICES[value]);
  };

  const handleMemberPresetChange = (member: TeamMember, value: AssignableRole) => {
    if (value === 'custom') {
      // Switching to "Custom" with no preset just keeps whatever matrix the
      // member already has -- the matrix editor is where they hand-edit it.
      updateRoleMutation.mutate({ id: member.id, role: value, matrix: permissionsByMember[member.id] || noAccessMatrix() });
      return;
    }
    updateRoleMutation.mutate({ id: member.id, role: value, matrix: ROLE_PRESET_MATRICES[value] });
  };

  const generateInviteLink = (memberId: string) => {
    return `${window.location.origin}/auth?invite=${memberId}`;
  };

  const copyInviteLink = async (member: TeamMember) => {
    const link = generateInviteLink(member.id);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(member.id);
      toast.success('Invite link copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  if (isRoleLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Team Management</CardTitle>
          </div>
          <CardDescription>
            Loading team settings...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Only owners and admins can manage the team
  if (!canManageTeam) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Team</CardTitle>
          </div>
          <CardDescription>
            Only the account owner or an admin can manage the team.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>Team Management</CardTitle>
        </div>
        <CardDescription>
          Invite team members and control exactly what they can create, view, edit, and delete in your workspace
        </CardDescription>
        {seats?.seat_limit != null && (
          <p className="text-sm text-muted-foreground">
            {seats.seats_used} of {seats.seat_limit} seats used, including you
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {seatsFull && (
          <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
            You've reached the limit of {seats?.seat_limit} people per workspace on free access. Remove someone to
            invite another person, or{' '}
            {CONTACT_EMAIL ? (
              <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('More team seats')}`} className="font-medium text-primary underline underline-offset-4">
                contact us
              </a>
            ) : (
              'contact us'
            )}{' '}
            for more seats.
          </div>
        )}
        {/* Invite Form */}
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Enter email address to invite..."
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            <Select value={invitePreset} onValueChange={(value) => handleInvitePresetChange(value as AssignableRole)}>
              <SelectTrigger className="capitalize sm:w-36">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLE_LABELS.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={inviteMutation.isPending || !inviteEmail.trim() || seatsFull}>
              {inviteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Invite
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="invite-financials"
              checked={inviteCanViewFinancials}
              onCheckedChange={(checked) => setInviteCanViewFinancials(checked === true)}
            />
            <Label htmlFor="invite-financials" className="text-sm font-normal text-muted-foreground">
              Can view financial figures (contract values, invoice amounts, revenue)
            </Label>
          </div>
          {invitePreset === 'custom' && (
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Custom permissions for this invite</p>
              <PermissionMatrixEditor
                matrix={inviteMatrix}
                onChange={(module, action, value) =>
                  setInviteMatrix((prev) => ({ ...prev, [module]: { ...prev[module], [action]: value } }))
                }
              />
            </div>
          )}
        </form>

        {/* Team Members List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No team members yet. Invite someone to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {teamMembers.map((member) => {
              const matrix = permissionsByMember[member.id] || noAccessMatrix();
              const isExpanded = expandedId === member.id;
              return (
                <div key={member.id} className="rounded-lg border bg-card">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Shield className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{member.invited_email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Select
                            value={member.role as AssignableRole}
                            onValueChange={(value) => handleMemberPresetChange(member, value as AssignableRole)}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs capitalize">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_ROLE_LABELS.map((r) => (
                                <SelectItem key={r} value={r} className="capitalize">
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                            <Checkbox
                              checked={member.can_view_financials}
                              onCheckedChange={(checked) =>
                                updateFinancialsMutation.mutate({ id: member.id, canViewFinancials: checked === true })
                              }
                            />
                            Sees financials
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge
                        variant={member.status === 'active' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {member.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setExpandedId(isExpanded ? null : member.id)}
                      >
                        Permissions
                        {isExpanded ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyInviteLink(member)}
                        title="Copy invite link"
                      >
                        {copiedId === member.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Link2 className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setRemovingId(member.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t p-3">
                      <PermissionMatrixEditor
                        matrix={matrix}
                        onChange={(module, action, value) =>
                          updateSinglePermissionMutation.mutate({ id: member.id, module, action, value })
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Remove Confirmation */}
        <AlertDialog open={!!removingId} onOpenChange={() => setRemovingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
              <AlertDialogDescription>
                This will revoke their access to your workspace. They will no longer be able to view or manage any data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removingId && removeMutation.mutate(removingId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {removeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
