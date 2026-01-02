import { Users, FolderKanban, FileText, FileSignature, AlertTriangle } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { RenewalCard } from '@/components/dashboard/RenewalCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockClients, mockProjects, mockProposals, mockContracts } from '@/lib/mock-data';

export default function Dashboard() {
  const activeClients = mockClients.filter(c => c.status === 'active').length;
  const activeProjects = mockProjects.filter(p => p.status === 'active').length;
  const pendingProposals = mockProposals.filter(p => p.status === 'sent').length;
  
  const upcomingRenewals = mockContracts
    .filter(c => {
      const daysUntil = differenceInDays(c.endDate, new Date());
      return daysUntil > 0 && daysUntil <= 90;
    })
    .sort((a, b) => differenceInDays(a.endDate, new Date()) - differenceInDays(b.endDate, new Date()));

  const getClientName = (clientId: string) => {
    const client = mockClients.find(c => c.id === clientId);
    return client?.clientName || 'Unknown Client';
  };

  const getProjectName = (projectId: string) => {
    const project = mockProjects.find(p => p.id === projectId);
    return project?.projectName || 'Unknown Project';
  };

  return (
    <div className="space-y-8 p-8">
      <PageHeader 
        title="Dashboard" 
        description="Overview of your clients, projects, and contracts"
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Clients"
          value={activeClients}
          icon={Users}
          description={`${mockClients.length} total clients`}
        />
        <StatCard
          title="Active Projects"
          value={activeProjects}
          icon={FolderKanban}
          description={`${mockProjects.length} total projects`}
        />
        <StatCard
          title="Pending Proposals"
          value={pendingProposals}
          icon={FileText}
          description="Awaiting approval"
        />
        <StatCard
          title="Upcoming Renewals"
          value={upcomingRenewals.length}
          icon={FileSignature}
          description="Within 90 days"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                <AlertTriangle className="h-4 w-4 text-accent-foreground" />
              </div>
              Upcoming Contract Renewals
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {upcomingRenewals.length > 0 ? (
                upcomingRenewals.map(contract => (
                  <RenewalCard
                    key={contract.id}
                    clientName={getClientName(contract.clientId)}
                    projectName={getProjectName(contract.projectId)}
                    endDate={contract.endDate}
                    value={contract.value}
                    contractType={contract.contractType}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <FileSignature className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    No upcoming renewals in the next 90 days
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              Recent Proposals
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {mockProposals.slice(0, 5).map(proposal => (
                <div 
                  key={proposal.id}
                  className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                      {proposal.title}
                    </h4>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {getClientName(proposal.clientId)}
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
