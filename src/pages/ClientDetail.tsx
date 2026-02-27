import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, FileText, FolderKanban, FileSignature, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ClientDetail() {
  const { id } = useParams();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: clientProjects = [] } = useQuery({
    queryKey: ['client-projects', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: clientProposals = [] } = useQuery({
    queryKey: ['client-proposals', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('client_id', id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: clientContracts = [] } = useQuery({
    queryKey: ['client-contracts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('client_id', id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link to="/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title={client.client_name}
          description={client.company_name || ''}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.designation && (
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{client.designation}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                  {client.email}
                </a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{client.phone}</span>
              </div>
            )}
            {client.billing_address && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.billing_address}</span>
              </div>
            )}
            {client.notes && (
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-muted-foreground">Notes / Remarks</p>
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
                        <p className="font-medium text-foreground">{project.project_name}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm text-muted-foreground capitalize">
                            {project.project_type}
                          </span>
                          {project.start_date && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(project.start_date), 'MMM dd, yyyy')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={project.status as any} />
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
                        {proposal.validity_date && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            Valid until {format(new Date(proposal.validity_date), 'MMM dd, yyyy')}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={proposal.status as any} />
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
                          {contract.contract_type} Contract
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <span>${Number(contract.value).toLocaleString()}</span>
                          <span>•</span>
                          <span>
                            {format(new Date(contract.start_date), 'MMM dd')} - {format(new Date(contract.end_date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={contract.status as any} />
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
