import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, FileSignature, MoreHorizontal, Calendar, Loader2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ContractStatus } from '@/lib/types';

export default function Contracts() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newContract, setNewContract] = useState({
    client_id: '',
    project_id: '',
    contract_type: '',
    start_date: '',
    end_date: '',
    value: '',
    renewal_frequency: '',
    status: 'active',
  });

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
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
        .select('*')
        .order('client_name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('project_name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createContractMutation = useMutation({
    mutationFn: async (contractData: typeof newContract) => {
      if (!user?.id) throw new Error('User not authenticated');
      const { data, error } = await supabase
        .from('contracts')
        .insert({
          user_id: user.id,
          client_id: contractData.client_id,
          project_id: contractData.project_id || null,
          contract_type: contractData.contract_type,
          start_date: contractData.start_date,
          end_date: contractData.end_date,
          value: parseFloat(contractData.value),
          renewal_frequency: contractData.renewal_frequency,
          status: contractData.status,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setIsDialogOpen(false);
      setNewContract({
        client_id: '',
        project_id: '',
        contract_type: '',
        start_date: '',
        end_date: '',
        value: '',
        renewal_frequency: '',
        status: 'active',
      });
      toast({ title: 'Contract created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create contract', description: error.message, variant: 'destructive' });
    },
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

  const filteredContracts = contracts.filter(contract => {
    const clientName = getClientName(contract.client_id).toLowerCase();
    const projectName = getProjectName(contract.project_id).toLowerCase();
    const matchesSearch = 
      clientName.includes(searchQuery.toLowerCase()) ||
      projectName.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredProjects = projects.filter(p => p.client_id === newContract.client_id);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContract.client_id || !newContract.contract_type || !newContract.start_date || !newContract.end_date || !newContract.value || !newContract.renewal_frequency) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    createContractMutation.mutate(newContract);
  };

  if (contractsLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Contracts & AMCs"
        description="Manage contracts and annual maintenance agreements"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="mr-2 h-4 w-4" />
                New Contract
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Contract</DialogTitle>
                <DialogDescription>Add a new contract or AMC agreement.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <Select
                    value={newContract.client_id}
                    onValueChange={(value) => setNewContract({ ...newContract, client_id: value, project_id: '' })}
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
                    value={newContract.project_id}
                    onValueChange={(value) => setNewContract({ ...newContract, project_id: value })}
                    disabled={!newContract.client_id}
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
                  <Label htmlFor="contract_type">Contract Type *</Label>
                  <Select
                    value={newContract.contract_type}
                    onValueChange={(value) => setNewContract({ ...newContract, contract_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amc">AMC</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="retainer">Retainer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={newContract.start_date}
                      onChange={(e) => setNewContract({ ...newContract, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date *</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={newContract.end_date}
                      onChange={(e) => setNewContract({ ...newContract, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Contract Value *</Label>
                  <Input
                    id="value"
                    type="number"
                    placeholder="Enter value"
                    value={newContract.value}
                    onChange={(e) => setNewContract({ ...newContract, value: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="renewal_frequency">Renewal Frequency *</Label>
                  <Select
                    value={newContract.renewal_frequency}
                    onValueChange={(value) => setNewContract({ ...newContract, renewal_frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={newContract.status}
                    onValueChange={(value) => setNewContract({ ...newContract, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="pending-renewal">Pending Renewal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createContractMutation.isPending}>
                    {createContractMutation.isPending ? 'Creating...' : 'Create Contract'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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
                const endDate = new Date(contract.end_date);
                const startDate = new Date(contract.start_date);
                const daysUntilEnd = differenceInDays(endDate, new Date());
                const isExpiringSoon = daysUntilEnd > 0 && daysUntilEnd <= 30;

                return (
                  <TableRow key={contract.id} className="group">
                    <TableCell>
                      <div>
                        <Link 
                          to={`/clients/${contract.client_id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {getClientName(contract.client_id)}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {getProjectName(contract.project_id)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium">
                        {contractTypeLabels[contract.contract_type] || contract.contract_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      ${Number(contract.value).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className={isExpiringSoon ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                          {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd, yyyy')}
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
                        {renewalLabels[contract.renewal_frequency] || contract.renewal_frequency}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={contract.status as 'active' | 'expired' | 'pending-renewal'} />
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
          onAction={() => setIsDialogOpen(true)}
        />
      )}
    </div>
  );
}
