import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, FileText, FolderKanban, FileSignature } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mockClients, mockProjects, mockProposals, mockContracts } from '@/lib/mock-data';

export default function ClientDetail() {
  const { id } = useParams();
  const client = mockClients.find(c => c.id === id);

  if (!client) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">Client not found</h2>
          <Link to="/clients" className="mt-2 text-primary hover:underline">
            Back to Clients
          </Link>
        </div>
      </div>
    );
  }

  const clientProjects = mockProjects.filter(p => p.clientId === id);
  const clientProposals = mockProposals.filter(p => p.clientId === id);
  const clientContracts = mockContracts.filter(c => c.clientId === id);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link to="/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title={client.clientName}
          description={client.companyName}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Primary Contact</p>
              <p className="text-foreground">{client.primaryContactName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                {client.email}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{client.phone}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{client.billingAddress}</span>
            </div>
            {client.notes && (
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm text-foreground">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="projects" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                Projects ({clientProjects.length})
              </TabsTrigger>
              <TabsTrigger value="proposals" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Proposals ({clientProposals.length})
              </TabsTrigger>
              <TabsTrigger value="contracts" className="flex items-center gap-2">
                <FileSignature className="h-4 w-4" />
                Contracts ({clientContracts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="mt-4">
              <div className="space-y-3">
                {clientProjects.map(project => (
                  <Card key={project.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <Link 
                          to={`/projects/${project.id}`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {project.projectName}
                        </Link>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm text-muted-foreground capitalize">
                            {project.projectType}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">
                            {format(project.startDate, 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={project.status} />
                    </CardContent>
                  </Card>
                ))}
                {clientProjects.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">No projects yet</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="proposals" className="mt-4">
              <div className="space-y-3">
                {clientProposals.map(proposal => (
                  <Card key={proposal.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium text-foreground">{proposal.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Valid until {format(proposal.validityDate, 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <StatusBadge status={proposal.status} />
                    </CardContent>
                  </Card>
                ))}
                {clientProposals.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">No proposals yet</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="contracts" className="mt-4">
              <div className="space-y-3">
                {clientContracts.map(contract => (
                  <Card key={contract.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium capitalize text-foreground">
                          {contract.contractType} Contract
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <span>${contract.value.toLocaleString()}</span>
                          <span>•</span>
                          <span>
                            {format(contract.startDate, 'MMM dd')} - {format(contract.endDate, 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={contract.status} />
                    </CardContent>
                  </Card>
                ))}
                {clientContracts.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">No contracts yet</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
