import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, FileText, FolderKanban, FileSignature, Briefcase, Building2, User } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

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

  const initials = client.client_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6 p-6">
      {/* Back Button + Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/clients">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">{client.client_name}</h1>
      </div>

      {/* Client Info Card - Full Width */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            {/* Avatar + Name */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 text-lg">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-semibold text-foreground">{client.client_name}</h1>
                {client.designation && (
                  <p className="text-sm text-muted-foreground">{client.designation}</p>
                )}
                {client.company_name && (
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    {client.company_name}
                  </div>
                )}
              </div>
            </div>

            <Separator orientation="vertical" className="hidden h-16 md:block" />

            {/* Contact Details */}
            <div className="flex flex-1 flex-wrap gap-x-8 gap-y-3">
              {client.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                    {client.email}
                  </a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${client.phone}`} className="text-primary hover:underline">
                    {client.phone}
                  </a>
                </div>
              )}
              {client.billing_address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.billing_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-left"
                  >
                    {client.billing_address}
                  </a>
                </div>
              )}
            </div>

            {/* Status Badge */}
            <div className="flex-shrink-0">
              <StatusBadge status={client.status as any} />
            </div>
          </div>

          {/* Notes */}
          {client.notes && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes / Remarks</p>
                <p className="mt-1 text-sm text-foreground">{client.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
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
  );
}
