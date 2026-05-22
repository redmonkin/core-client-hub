import { Link } from 'react-router-dom';
import { Users, FolderKanban, FileText, FileSignature, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { differenceInDays, differenceInCalendarDays, format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ContractStatus } from '@/lib/types';
import { NotificationsDropdown } from '@/components/notifications/NotificationsDropdown';
import { getContractExpiryInfo } from '@/lib/contract-alerts';

const contractTypeLabels: Record<string, string> = {
  amc: 'Annual Maintenance Contract',
  fixed: 'Fixed Contract',
  retainer: 'Retainer',
};

export default function Dashboard() {
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

  const isLoading = isLoadingClients || isLoadingProjects || isLoadingProposals || isLoadingContracts;

  const activeClients = clients.filter(c => c.status === 'active').length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
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
    <div className="space-y-8 p-8">
      <div className="flex items-center justify-between">
        <PageHeader 
          title="Dashboard" 
          description="Overview of your clients, projects, and contracts"
        />
        <NotificationsDropdown />
      </div>

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
                recentContracts.map(contract => (
                  <Link
                    key={contract.id}
                    to={`/contracts/${contract.id}`}
                    className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                        {contractTypeLabels[contract.contract_type] || contract.contract_type}
                      </h4>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {getClientName(contract.client_id)}
                        {contract.end_date && ` · Ends ${format(new Date(contract.end_date), 'MMM d, yyyy')}`}
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
              {proposals.length > 0 ? (
                proposals.slice(0, 5).map(proposal => (
                  <Link
                    key={proposal.id}
                    to="/proposals"
                    className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                        {proposal.title}
                      </h4>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {getClientName(proposal.client_id)}
                      </p>
                    </div>
                    <span className={`ml-4 shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      proposal.status === 'approved' ? 'bg-primary/10 text-primary' :
                      proposal.status === 'sent' ? 'bg-accent text-accent-foreground' :
                      proposal.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                    </span>
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
    </div>
  );
}
