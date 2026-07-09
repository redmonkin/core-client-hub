import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceUser, WorkspaceRole } from '@/hooks/useWorkspaceUser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Plus, Trash2, Loader2, Mail, Shield, Copy, Check, Link2 } from 'lucide-react';
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

const ASSIGNABLE_ROLES: Exclude<WorkspaceRole, 'owner'>[] = ['admin', 'editor', 'viewer'];

export function TeamManagement() {
  const { user, loading: authLoading } = useAuth();
  const { workspaceUserId, role: myRole, loading: workspaceLoading } = useWorkspaceUser();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<WorkspaceRole, 'owner'>>('editor');
  const [inviteCanViewFinancials, setInviteCanViewFinancials] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role, canViewFinancials }: { email: string; role: string; canViewFinancials: boolean }) => {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) throw new Error('Email is required');
      if (trimmedEmail === user?.email?.toLowerCase()) throw new Error('You cannot invite yourself');

      // Check if user already exists in auth by looking for existing active membership
      // We'll just insert — the DB trigger will activate if they sign up later
      const { error } = await supabase.from('team_members').insert({
        owner_id: workspaceUserId!,
        invited_email: trimmedEmail,
        role,
        can_view_financials: canViewFinancials,
        status: 'pending',
      } as any);

      if (error) {
        if (error.code === '23505') throw new Error('This email has already been invited');
        throw error;
      }
    },
    onSuccess: (_: void, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      setInviteEmail('');
      setInviteRole('editor');
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

  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, role, canViewFinancials }: { id: string; role?: string; canViewFinancials?: boolean }) => {
      const updatePayload: Record<string, unknown> = {};
      if (role !== undefined) updatePayload.role = role;
      if (canViewFinancials !== undefined) updatePayload.can_view_financials = canViewFinancials;
      const { error } = await supabase.from('team_members').update(updatePayload).eq('id', id);
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
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole, canViewFinancials: inviteCanViewFinancials });
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
          Invite team members and control what they can see and edit in your workspace
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
            <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as Exclude<WorkspaceRole, 'owner'>)}>
              <SelectTrigger className="sm:w-36">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={inviteMutation.isPending || !inviteEmail.trim()}>
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
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{member.invited_email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Select
                        value={member.role}
                        onValueChange={(value) => updateMemberMutation.mutate({ id: member.id, role: value })}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs capitalize">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.map((r) => (
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
                            updateMemberMutation.mutate({ id: member.id, canViewFinancials: checked === true })
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
            ))}
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
