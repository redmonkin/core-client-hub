import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, FolderKanban, FileText, FileSignature, Loader2, ArrowRight, AlertCircle, StickyNote, ListTodo } from 'lucide-react';
import { differenceInDays, differenceInCalendarDays, format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge, type StatusType } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ContractStatus } from '@/lib/types';
import { getContractExpiryInfo } from '@/lib/contract-alerts';
import { STATUS_LABELS, STATUS_STYLES, type TaskStatus } from '@/hooks/useTaskMutations';
import { contractTypeLabel } from '@/lib/labels';


export default function Dashboard() {
  const { user } = useAuth();
  const [myTasksOnly, setMyTasksOnly] = useState(false);

  // Fetch clients
  const { data: clients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*');
      if (error) throw error;
      return data;
    },
  });

  // Fetch projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*');
      if (error) throw error;
      return data;
    },
  });

  // Fetch proposals (sorted by latest update)
  const { data: proposals = [], isLoading: isLoadingProposals } = useQuery({
    queryKey: ['proposals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch contracts (sorted by latest update)
  const { data: contracts = [], isLoading: isLoadingContracts } = useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Recent notes accumulated across every project, not scoped to one.
  const { data: recentNotes = [], isLoading: isLoadingNotes } = useQuery({
    queryKey: ['dashboard-recent-notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_notes')
        .select('id, content, created_at, project_id, projects(project_name)')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as { id: string; content: string; created_at: string; project_id: string; projects: { project_name: string } | null }[];
    },
  });

  const { data: latestTasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['dashboard-latest-tasks', myTasksOnly, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('timesheets')
        .select('id, task, status, due_date, created_at, project_id, assignee_user_id, projects(project_name)')
        .order('created_at', { ascending: false })
        .limit(5);
      if (myTasksOnly) {
        query = query.eq('assignee_user_id', user?.id ?? '');
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as { id: string; task: string; status: string; due_date: string | null; created_at: string; project_id: string | null; assignee_user_id: string | null; projects: { project_name: string } | null }[];
    },
    enabled: !!user,
  });

  // Tasks' own loading state is intentionally excluded here -- toggling
  // "Show only mine" refetches it, and that shouldn't flash the whole
  // dashboard back to a full-page spinner; the Latest Tasks card handles
  // its own loading state instead.
  const isLoading = isLoadingClients || isLoadingProjects || isLoadingProposals || isLoadingContracts || isLoadingNotes;

  const activeClients = clients.filter(c => c.status === 'active').length;
  const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'maintenance').length;
  const pendingProposals = proposals.filter(p => p.status === 'sent').length;

  const upcomingRenewals = contracts
    .filter(c => {
      const daysUntil = differenceInDays(new Date(c.end_date), new Date());
      return daysUntil > 0 && daysUntil <= 90;
    });

  // Severity score: critical alert = 2, warning = 1, none = 0. Higher = more attention.
  const severityRank = (s?: 'critical' | 'warning' | null) => (s === 'critical' ? 2 : s === 'warning' ? 1 : 0);

  const contractsWithAlerts = contracts.map(c => ({
    contract: c,
    alert: getContractExpiryInfo(c.start_date, c.end_date, c.status),
  }));

  const recentContracts = [...contractsWithAlerts]
    .sort((a, b) => {
      const diff = severityRank(b.alert?.severity) - severityRank(a.alert?.severity);
      if (diff !== 0) return diff;
      return new Date(b.contract.updated_at).getTime() - new Date(a.contract.updated_at).getTime();
    })
    .slice(0, 5);

  // Proposal attention: sent proposals nearing/past validity_date, or change_requested.
  const proposalAttention = (p: any): 'critical' | 'warning' | null => {
    if (p.status === 'change_requested') return 'critical';
    if (p.status === 'sent') {
      if (p.validity_date) {
        const days = differenceInCalendarDays(new Date(p.validity_date), new Date());
        if (days <= 0) return 'critical';
        if (days <= 7) return 'warning';
      }
      return 'warning';
    }
    return null;
  };

  const recentProposals = [...proposals]
    .map(p => ({ proposal: p, attention: proposalAttention(p) }))
    .sort((a, b) => {
      const diff = severityRank(b.attention) - severityRank(a.attention);
      if (diff !== 0) return diff;
      return new Date(b.proposal.updated_at).getTime() - new Date(a.proposal.updated_at).getTime();
    })
    .slice(0, 5);

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.client_name || 'Unknown Client';
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return 'No Project';
    const project = projects.find(p => p.id === projectId);
    return project?.project_name || 'Unknown Project';
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Dashboard"
        description="Overview of your clients, projects, and contracts"
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Clients"
          value={activeClients}
          icon={Users}
          description={`${clients.length} total clients`}
          href="/clients"
        />
        <StatCard
          title="Active Projects"
          value={activeProjects}
          icon={FolderKanban}
          description={`${projects.length} total projects`}
          href="/projects"
        />
        <StatCard
          title="Pending Proposals"
          value={pendingProposals}
          icon={FileText}
          description="Awaiting approval"
          href="/proposals"
        />
        <StatCard
          title="Upcoming Renewals"
          value={upcomingRenewals.length}
          icon={FileSignature}
          description="Within 90 days"
          href="/contracts"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/30">
            <div className="flex items-center justify-between w-full">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                  <FileSignature className="h-4 w-4 text-accent-foreground" />
                </div>
                Recent Contracts
              </CardTitle>
              <Link to="/contracts" className="flex items-center gap-1 text-sm text-primary hover:underline">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {recentContracts.length > 0 ? (
                recentContracts.map(({ contract, alert }) => (
                  <Link
                    key={contract.id}
                    to={`/contracts/${contract.id}`}
                    className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="flex items-center gap-2 truncate font-medium text-foreground group-hover:text-primary transition-colors">
                        {alert && (
                          <AlertCircle
                            className={`h-4 w-4 shrink-0 ${alert.severity === 'critical' ? 'text-destructive' : 'text-amber-500'}`}
                          />
                        )}
                        <span className="truncate">
                          {contractTypeLabel(contract.contract_type)}
                        </span>
                      </h4>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {getClientName(contract.client_id)}
                        {alert
                          ? ` · ${alert.label}`
                          : contract.end_date && ` · Ends ${format(new Date(contract.end_date), 'MMM d, yyyy')}`}
                      </p>
                    </div>
                    <div className="ml-4 shrink-0">
                      <StatusBadge status={contract.status as ContractStatus} />
                    </div>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <FileSignature className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    No contracts yet
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/30">
            <div className="flex items-center justify-between w-full">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                Recent Proposals
              </CardTitle>
              <Link to="/proposals" className="flex items-center gap-1 text-sm text-primary hover:underline">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {recentProposals.length > 0 ? (
                recentProposals.map(({ proposal, attention }) => (
                  <Link
                    key={proposal.id}
                    to="/proposals"
                    className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="flex items-center gap-2 truncate font-medium text-foreground group-hover:text-primary transition-colors">
                        {attention && (
                          <AlertCircle
                            className={`h-4 w-4 shrink-0 ${attention === 'critical' ? 'text-destructive' : 'text-amber-500'}`}
                          />
                        )}
                        <span className="truncate">{proposal.title}</span>
                      </h4>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {getClientName(proposal.client_id)}
                        {proposal.validity_date && ` · Valid till ${format(new Date(proposal.validity_date), 'MMM d, yyyy')}`}
                      </p>
                    </div>
                    <StatusBadge status={proposal.status as StatusType} className="ml-4 shrink-0" />
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    No proposals yet
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/30">
            <div className="flex items-center justify-between w-full">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                  <StickyNote className="h-4 w-4 text-accent-foreground" />
                </div>
                Recent Notes
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {recentNotes.length > 0 ? (
                recentNotes.map((note) => (
                  <Link
                    key={note.id}
                    to={`/projects/${note.project_id}`}
                    className="group block rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-sm"
                  >
                    <p className="line-clamp-2 text-sm text-foreground">{note.content}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {note.projects?.project_name || 'Unknown Project'}
                      </span>
                      {' · '}
                      {format(new Date(note.created_at), 'MMM d, yyyy')}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <StickyNote className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    No notes yet
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/30">
            <div className="flex items-center justify-between w-full gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <ListTodo className="h-4 w-4 text-primary" />
                </div>
                Latest Tasks
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="my-tasks-only" className="text-sm font-normal text-muted-foreground">
                  Show only mine
                </Label>
                <Switch id="my-tasks-only" checked={myTasksOnly} onCheckedChange={setMyTasksOnly} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {isLoadingTasks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : latestTasks.length > 0 ? (
                latestTasks.map((t) => (
                  <Link
                    key={t.id}
                    to="/tasks"
                    className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                        {t.task}
                      </h4>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {t.projects?.project_name || 'No Project'}
                        {t.due_date && ` · Due ${format(new Date(t.due_date), 'MMM d, yyyy')}`}
                      </p>
                    </div>
                    <Badge variant="secondary" className={`ml-4 shrink-0 text-xs ${STATUS_STYLES[t.status as TaskStatus] || ''}`}>
                      {STATUS_LABELS[t.status as TaskStatus] || t.status}
                    </Badge>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <ListTodo className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {myTasksOnly ? 'No tasks assigned to you' : 'No tasks yet'}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
