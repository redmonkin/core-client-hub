import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, FileText, MoreHorizontal, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected';

export default function Proposals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProposal, setNewProposal] = useState({
    title: '',
    clientId: '',
    projectId: '',
    scopeOfWork: '',
    costBreakdown: '',
    validityDate: '',
    status: 'draft' as ProposalStatus,
  });

  const { data: proposals = [], isLoading: proposalsLoading } = useQuery({
    queryKey: ['proposals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name')
        .order('client_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, client_id')
        .order('project_name');
      if (error) throw error;
      return data;
    },
  });

  const createProposalMutation = useMutation({
    mutationFn: async (proposal: typeof newProposal) => {
      const { data, error } = await supabase
        .from('proposals')
        .insert({
          title: proposal.title,
          client_id: proposal.clientId,
          project_id: proposal.projectId || null,
          scope_of_work: proposal.scopeOfWork || null,
          cost_breakdown: proposal.costBreakdown || null,
          validity_date: proposal.validityDate || null,
          status: proposal.status,
          user_id: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      setIsDialogOpen(false);
      setNewProposal({
        title: '',
        clientId: '',
        projectId: '',
        scopeOfWork: '',
        costBreakdown: '',
        validityDate: '',
        status: 'draft',
      });
      toast.success('Proposal created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create proposal: ' + error.message);
    },
  });

  const filteredProposals = proposals.filter(proposal => {
    const matchesSearch = proposal.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || proposal.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.client_name || 'Unknown Client';
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return 'No Project';
    const project = projects.find(p => p.id === projectId);
    return project?.project_name || 'Unknown Project';
  };

  const filteredProjects = projects.filter(p => p.client_id === newProposal.clientId);

  const handleExportPDF = (proposalId: string) => {
    toast.success('PDF export started - this feature requires backend integration');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProposal.title || !newProposal.clientId) {
      toast.error('Please fill in required fields');
      return;
    }
    createProposalMutation.mutate(newProposal);
  };

  if (proposalsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Proposals"
        description="Create and manage client proposals"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="mr-2 h-4 w-4" />
                New Proposal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Proposal</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Proposal Title *</Label>
                  <Input
                    id="title"
                    value={newProposal.title}
                    onChange={(e) => setNewProposal({ ...newProposal, title: e.target.value })}
                    placeholder="Enter proposal title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <Select
                    value={newProposal.clientId}
                    onValueChange={(value) => setNewProposal({ ...newProposal, clientId: value, projectId: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.client_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project">Project (Optional)</Label>
                  <Select
                    value={newProposal.projectId}
                    onValueChange={(value) => setNewProposal({ ...newProposal, projectId: value })}
                    disabled={!newProposal.clientId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.project_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scopeOfWork">Scope of Work</Label>
                  <Textarea
                    id="scopeOfWork"
                    value={newProposal.scopeOfWork}
                    onChange={(e) => setNewProposal({ ...newProposal, scopeOfWork: e.target.value })}
                    placeholder="Describe the scope of work"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costBreakdown">Cost Breakdown</Label>
                  <Textarea
                    id="costBreakdown"
                    value={newProposal.costBreakdown}
                    onChange={(e) => setNewProposal({ ...newProposal, costBreakdown: e.target.value })}
                    placeholder="Enter pricing details"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="validityDate">Valid Until</Label>
                    <Input
                      id="validityDate"
                      type="date"
                      value={newProposal.validityDate}
                      onChange={(e) => setNewProposal({ ...newProposal, validityDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={newProposal.status}
                      onValueChange={(value) => setNewProposal({ ...newProposal, status: value as ProposalStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createProposalMutation.isPending}>
                    {createProposalMutation.isPending ? 'Creating...' : 'Create Proposal'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search proposals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 pl-11 text-base"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProposalStatus | 'all')}>
          <SelectTrigger className="h-12 w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredProposals.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredProposals.map(proposal => (
            <Card key={proposal.id} className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="truncate font-semibold text-foreground">{proposal.title}</h3>
                    <div className="mt-1.5 space-y-1">
                      <Link 
                        to={`/clients/${proposal.client_id}`}
                        className="block truncate text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        {getClientName(proposal.client_id)}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {getProjectName(proposal.project_id)}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportPDF(proposal.id)}>
                        <Download className="mr-2 h-4 w-4" />
                        Export PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem>Send to Client</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {proposal.scope_of_work && (
                  <div className="mt-5 rounded-xl bg-muted/50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scope of Work</p>
                    <p className="mt-2 line-clamp-2 text-sm text-foreground">
                      {proposal.scope_of_work}
                    </p>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {proposal.validity_date 
                      ? `Valid until ${format(new Date(proposal.validity_date), 'MMM dd, yyyy')}`
                      : 'No expiry date'}
                  </div>
                  <StatusBadge status={proposal.status as ProposalStatus} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No proposals found"
          description={searchQuery || statusFilter !== 'all' 
            ? "Try adjusting your filters" 
            : "Create your first proposal to get started"}
          actionLabel={!searchQuery && statusFilter === 'all' ? "New Proposal" : undefined}
          onAction={() => setIsDialogOpen(true)}
        />
      )}
    </div>
  );
}
