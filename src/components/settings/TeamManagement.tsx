import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Trash2, Loader2, Mail, Shield } from 'lucide-react';
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
  created_at: string;
}

export function TeamManagement() {
  const { user, loading: authLoading } = useAuth();
  const { isTeamMember, loading: workspaceLoading } = useWorkspaceUser();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const isRoleLoading = authLoading || workspaceLoading;

  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!user && !isTeamMember && !isRoleLoading,
  });

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) throw new Error('Email is required');
      if (trimmedEmail === user?.email?.toLowerCase()) throw new Error('You cannot invite yourself');

      // Check if user already exists in auth by looking for existing active membership
      // We'll just insert — the DB trigger will activate if they sign up later
      const { error } = await supabase.from('team_members').insert({
        owner_id: user!.id,
        invited_email: trimmedEmail,
        role: 'member',
        status: 'pending',
      } as any);

      if (error) {
        if (error.code === '23505') throw new Error('This email has already been invited');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      setInviteEmail('');
      toast.success('Team member invited successfully');
    },
    onError: (error) => {
      toast.error(error.message);
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
    inviteMutation.mutate(inviteEmail);
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

  // Team members can't manage the team
  if (isTeamMember) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Team</CardTitle>
          </div>
          <CardDescription>
            You are a team member. Only the account owner can manage the team.
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
          Invite team members to give them full access to your workspace
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite Form */}
        <form onSubmit={handleInvite} className="flex gap-3">
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
          <Button type="submit" disabled={inviteMutation.isPending || !inviteEmail.trim()}>
            {inviteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Invite
          </Button>
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
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.invited_email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={member.status === 'active' ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {member.status}
                  </Badge>
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
