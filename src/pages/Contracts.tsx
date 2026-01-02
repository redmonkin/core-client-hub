import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, FileSignature, MoreHorizontal, Calendar } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { mockContracts, mockClients, mockProjects } from '@/lib/mock-data';
import { ContractStatus } from '@/lib/types';

export default function Contracts() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');

  const getClientName = (clientId: string) => {
    const client = mockClients.find(c => c.id === clientId);
    return client?.clientName || 'Unknown Client';
  };

  const getProjectName = (projectId: string) => {
    const project = mockProjects.find(p => p.id === projectId);
    return project?.projectName || 'Unknown Project';
  };

  const filteredContracts = mockContracts.filter(contract => {
    const clientName = getClientName(contract.clientId).toLowerCase();
    const projectName = getProjectName(contract.projectId).toLowerCase();
    const matchesSearch = 
      clientName.includes(searchQuery.toLowerCase()) ||
      projectName.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const contractTypeLabels: Record<string, string> = {
    'amc': 'AMC',
    'fixed': 'Fixed',
    'retainer': 'Retainer',
  };

  const renewalLabels: Record<string, string> = {
    'monthly': 'Monthly',
    'quarterly': 'Quarterly',
    'yearly': 'Yearly',
  };

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Contracts & AMCs"
        description="Manage contracts and annual maintenance agreements"
        actions={
          <Button size="lg">
            <Plus className="mr-2 h-4 w-4" />
            New Contract
          </Button>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by client or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 pl-11 text-base"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ContractStatus | 'all')}>
          <SelectTrigger className="h-12 w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="pending-renewal">Pending Renewal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredContracts.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold">Client / Project</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Value</TableHead>
                <TableHead className="font-semibold">Duration</TableHead>
                <TableHead className="font-semibold">Renewal</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.map(contract => {
                const daysUntilEnd = differenceInDays(contract.endDate, new Date());
                const isExpiringSoon = daysUntilEnd > 0 && daysUntilEnd <= 30;

                return (
                  <TableRow key={contract.id} className="group">
                    <TableCell>
                      <div>
                        <Link 
                          to={`/clients/${contract.clientId}`}
                          className="font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {getClientName(contract.clientId)}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {getProjectName(contract.projectId)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium">
                        {contractTypeLabels[contract.contractType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      ${contract.value.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className={isExpiringSoon ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                          {format(contract.startDate, 'MMM dd')} - {format(contract.endDate, 'MMM dd, yyyy')}
                        </span>
                      </div>
                      {isExpiringSoon && (
                        <p className="mt-1 text-xs font-medium text-destructive">
                          Expires in {daysUntilEnd} days
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {renewalLabels[contract.renewalFrequency]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={contract.status} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem>Renew Contract</DropdownMenuItem>
                          <DropdownMenuItem>View History</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={FileSignature}
          title="No contracts found"
          description={searchQuery || statusFilter !== 'all' 
            ? "Try adjusting your filters" 
            : "Create your first contract to get started"}
          actionLabel={!searchQuery && statusFilter === 'all' ? "New Contract" : undefined}
          onAction={() => {}}
        />
      )}
    </div>
  );
}
