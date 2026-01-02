import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Mail, Phone, Building2 } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { mockClients, mockProjects } from '@/lib/mock-data';
import { toast } from 'sonner';

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredClients = mockClients.filter(client =>
    client.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getProjectCount = (clientId: string) => {
    return mockProjects.filter(p => p.clientId === clientId).length;
  };

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Client created successfully!');
    setIsDialogOpen(false);
  };

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
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input id="clientName" placeholder="Enter client name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input id="companyName" placeholder="Enter company name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Primary Contact</Label>
                    <Input id="contactName" placeholder="Enter contact name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="email@example.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" type="tel" placeholder="+1 (555) 000-0000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Billing Address</Label>
                    <Input id="address" placeholder="Enter billing address" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" placeholder="Add any notes about this client..." rows={3} />
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Client</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search clients by name, company, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 pl-11 text-base"
        />
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
                        {client.clientName}
                      </Link>
                      <StatusBadge status={client.status} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{client.companyName}</span>
                    </div>
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
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Archive</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-5 space-y-2.5">
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>{client.phone}</span>
                  </div>
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
    </div>
  );
}
