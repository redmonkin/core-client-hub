import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, FileText, MoreHorizontal, Download } from 'lucide-react';
import { format } from 'date-fns';
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
import { mockProposals, mockClients, mockProjects } from '@/lib/mock-data';
import { ProposalStatus } from '@/lib/types';
import { toast } from 'sonner';

export default function Proposals() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all');

  const filteredProposals = mockProposals.filter(proposal => {
    const matchesSearch = proposal.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || proposal.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getClientName = (clientId: string) => {
    const client = mockClients.find(c => c.id === clientId);
    return client?.clientName || 'Unknown Client';
  };

  const getProjectName = (projectId: string) => {
    const project = mockProjects.find(p => p.id === projectId);
    return project?.projectName || 'Unknown Project';
  };

  const handleExportPDF = (proposalId: string) => {
    toast.success('PDF export started - this feature requires backend integration');
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Proposals"
        description="Create and manage client proposals"
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Proposal
          </Button>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search proposals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProposalStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-48">
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProposals.map(proposal => (
            <Card key={proposal.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{proposal.title}</h3>
                    <div className="mt-1 space-y-1">
                      <Link 
                        to={`/clients/${proposal.clientId}`}
                        className="block text-sm text-muted-foreground hover:text-primary"
                      >
                        {getClientName(proposal.clientId)}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {getProjectName(proposal.projectId)}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
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

                <div className="mt-4 rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Scope of Work</p>
                  <p className="mt-1 line-clamp-2 text-sm text-foreground">
                    {proposal.scopeOfWork}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Valid until {format(proposal.validityDate, 'MMM dd, yyyy')}
                  </div>
                  <StatusBadge status={proposal.status} />
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
          onAction={() => {}}
        />
      )}
    </div>
  );
}
