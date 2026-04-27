import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Mail, Phone, Building2, Loader2, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ViewToggle } from '@/components/ui/view-toggle';
import { useViewMode } from '@/hooks/useViewMode';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Client {
  id: string;
  client_name: string;
  company_name: string | null;
  primary_contact_name: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export default function Clients() {
  const { user } = useAuth();
  const { workspaceUserId } = useWorkspaceUser();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    clientName: '',
    designation: '',
    email: '',
    phone: '',
    companyName: '',
    address: '',
    notes: '',
  });

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    clientName: '',
    designation: '',
    email: '',
    phone: '',
    companyName: '',
    address: '',
    notes: '',
    status: 'active',
  });

  // Fetch clients
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!user,
  });

  // Fetch projects count
  const { data: projectCounts = {} } = useQuery({
    queryKey: ['project-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('client_id');
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach((project) => {
        counts[project.client_id] = (counts[project.client_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!user,
  });

  // Create client mutation
  const createClient = useMutation({
    mutationFn: async (clientData: typeof formData) => {
      const { error } = await supabase.from('clients').insert({
        user_id: workspaceUserId!,
        client_name: clientData.clientName,
        designation: clientData.designation || null,
        email: clientData.email || null,
        phone: clientData.phone || null,
        company_name: clientData.companyName || null,
        billing_address: clientData.address || null,
        notes: clientData.notes || null,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client created successfully!');
      setIsDialogOpen(false);
      setFormData({
        clientName: '',
        designation: '',
        email: '',
        phone: '',
        companyName: '',
        address: '',
        notes: '',
      });
    },
    onError: (error) => {
      toast.error('Failed to create client: ' + error.message);
    },
  });

  // Update client mutation
  const updateClient = useMutation({
    mutationFn: async (clientData: typeof editFormData & { id: string }) => {
      const { error } = await supabase
        .from('clients')
        .update({
          client_name: clientData.clientName,
          designation: clientData.designation || null,
          email: clientData.email || null,
          phone: clientData.phone || null,
          company_name: clientData.companyName || null,
          billing_address: clientData.address || null,
          notes: clientData.notes || null,
          status: clientData.status,
        })
        .eq('id', clientData.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client updated successfully!');
      setIsEditDialogOpen(false);
      setSelectedClient(null);
    },
    onError: (error) => {
      toast.error('Failed to update client: ' + error.message);
    },
  });

  // Delete client mutation
  const deleteClient = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted successfully!');
      setIsDeleteDialogOpen(false);
      setSelectedClient(null);
    },
    onError: (error) => {
      toast.error('Failed to delete client: ' + error.message);
    },
  });

  const filteredClients = clients.filter(client => {
    const matchesSearch = 
      client.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.company_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (client.email?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getProjectCount = (clientId: string) => {
    return projectCounts[clientId] || 0;
  };

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    createClient.mutate(formData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setEditFormData({
      clientName: client.client_name,
      designation: client.designation || '',
      email: client.email || '',
      phone: client.phone || '',
      companyName: client.company_name || '',
      address: client.billing_address || '',
      notes: client.notes || '',
      status: client.status,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (client: Client) => {
    setSelectedClient(client);
    setIsDeleteDialogOpen(true);
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setEditFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleUpdateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClient) {
      updateClient.mutate({ ...editFormData, id: selectedClient.id });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Clients"
        description="Manage your client relationships"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateClient} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Name *</Label>
                    <Input 
                      id="clientName" 
                      placeholder="Enter full name" 
                      value={formData.clientName}
                      onChange={handleInputChange}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="designation">Designation</Label>
                    <Input 
                      id="designation" 
                      placeholder="e.g. CEO, Manager" 
                      value={formData.designation}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="email@example.com" 
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input 
                      id="phone" 
                      type="tel" 
                      placeholder="+1 (555) 000-0000" 
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input 
                      id="companyName" 
                      placeholder="Enter company name" 
                      value={formData.companyName}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Company Address</Label>
                    <Input 
                      id="address" 
                      placeholder="Enter company address" 
                      value={formData.address}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes / Remarks</Label>
                  <Textarea 
                    id="notes" 
                    placeholder="Add any notes or remarks about this client..." 
                    rows={3} 
                    value={formData.notes}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createClient.isPending}>
                    {createClient.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Client
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
            placeholder="Search clients by name, company, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 pl-11 text-base"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'archived')}>
          <SelectTrigger className="h-12 w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredClients.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map(client => (
            <Card key={client.id} className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link 
                        to={`/clients/${client.id}`}
                        className="truncate font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        {client.client_name}
                      </Link>
                      <StatusBadge status={client.status as 'active' | 'archived'} />
                    </div>
                    {client.company_name && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{client.company_name}</span>
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/clients/${client.id}`}>View Details</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(client)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDelete(client)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-5 space-y-2.5">
                  {client.email && (
                    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
                  <span className="text-sm text-muted-foreground">
                    {getProjectCount(client.id)} project{getProjectCount(client.id) !== 1 ? 's' : ''}
                  </span>
                  <Link 
                    to={`/clients/${client.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    View Details →
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Building2}
          title="No clients found"
          description={searchQuery ? "Try adjusting your search query" : "Get started by adding your first client"}
          actionLabel={!searchQuery ? "Add Client" : undefined}
          onAction={() => setIsDialogOpen(true)}
        />
      )}

      {/* Edit Client Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateClient} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clientName">Name *</Label>
                <Input 
                  id="clientName" 
                  placeholder="Enter full name" 
                  value={editFormData.clientName}
                  onChange={handleEditInputChange}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input 
                  id="designation" 
                  placeholder="e.g. CEO, Manager" 
                  value={editFormData.designation}
                  onChange={handleEditInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="email@example.com" 
                  value={editFormData.email}
                  onChange={handleEditInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input 
                  id="phone" 
                  type="tel" 
                  placeholder="+1 (555) 000-0000" 
                  value={editFormData.phone}
                  onChange={handleEditInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input 
                  id="companyName" 
                  placeholder="Enter company name" 
                  value={editFormData.companyName}
                  onChange={handleEditInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Company Address</Label>
                <Input 
                  id="address" 
                  placeholder="Enter company address" 
                  value={editFormData.address}
                  onChange={handleEditInputChange}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={editFormData.status} 
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Remarks</Label>
              <Textarea 
                id="notes" 
                placeholder="Add any notes or remarks about this client..." 
                rows={3} 
                value={editFormData.notes}
                onChange={handleEditInputChange}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateClient.isPending}>
                {updateClient.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the client "{selectedClient?.client_name}". 
              This action cannot be undone and will also delete all associated projects, contracts, and proposals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedClient && deleteClient.mutate(selectedClient.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteClient.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
