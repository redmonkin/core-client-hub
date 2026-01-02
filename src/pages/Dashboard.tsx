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
    <div className="space-y-8 p-6">
      <PageHeader 
        title="Dashboard" 
        description="Overview of your clients, projects, and contracts"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-accent-foreground" />
              Upcoming Contract Renewals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
              <p className="py-8 text-center text-muted-foreground">
                No upcoming renewals in the next 90 days
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Recent Proposals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockProposals.slice(0, 5).map(proposal => (
              <div 
                key={proposal.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50"
              >
                <div>
                  <h4 className="font-medium text-foreground">{proposal.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {getClientName(proposal.clientId)}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                  proposal.status === 'approved' ? 'bg-primary/10 text-primary' :
                  proposal.status === 'sent' ? 'bg-accent text-accent-foreground' :
                  proposal.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
