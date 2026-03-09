import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, FolderKanban, FileText, FileSignature, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

export default function ProjectDetail() {
  const { id } = useParams();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: client } = useQuery({
    queryKey: ['project-client', project?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, company_name')
        .eq('id', project!.client_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!project?.client_id,
  });

  const { data: projectProposals = [] } = useQuery({
    queryKey: ['project-proposals', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('project_id', id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: projectContracts = [] } = useQuery({
    queryKey: ['project-contracts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('project_id', id!);
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

  if (!project) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">Project not found</h2>
          <Link to="/projects" className="mt-2 text-primary hover:underline">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/projects">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{project.project_name}</h1>
            <StatusBadge status={project.status as any} />
            <Badge variant="secondary" className="capitalize">{project.project_type}</Badge>
          </div>
        </div>
      </div>

      {/* Project Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {client && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Client:</span>
                <Link to={`/clients/${client.id}`} className="text-primary hover:underline font-medium">
                  {client.client_name}
                  {client.company_name && ` (${client.company_name})`}
                </Link>
              </div>
            )}
            {project.start_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Start:</span>
                <span className="text-foreground">{format(new Date(project.start_date), 'MMM dd, yyyy')}</span>
              </div>
            )}
            {project.end_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">End:</span>
                <span className="text-foreground">{format(new Date(project.end_date), 'MMM dd, yyyy')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="proposals" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="proposals" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Proposals ({projectProposals.length})
          </TabsTrigger>
          <TabsTrigger value="contracts" className="flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Contracts ({projectContracts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="mt-4">
          <div className="space-y-3">
            {projectProposals.map(proposal => (
              <Link key={proposal.id} to="/proposals" className="block">
                <Card className="transition-all hover:border-primary/20 hover:shadow-sm">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-foreground hover:text-primary transition-colors">{proposal.title}</p>
                    {proposal.validity_date && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Valid until {format(new Date(proposal.validity_date), 'MMM dd, yyyy')}
                      </p>
                    )}
                  </div>
                    <StatusBadge status={proposal.status as any} />
                  </CardContent>
                </Card>
              </Link>
            ))}
            {projectProposals.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No proposals linked to this project</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          <div className="space-y-3">
            {projectContracts.map(contract => (
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
            {projectContracts.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No contracts linked to this project</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
