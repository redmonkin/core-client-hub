import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, FileText, FolderKanban, FileSignature, Building2, Users, Pencil, Loader2, Activity, UserPlus, CircleDot, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ClientContacts } from '@/components/clients/ClientContacts';
import { ClientLedger } from '@/components/clients/ClientLedger';

export default function ClientDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    clientName: '', designation: '', email: '', phone: '',
    companyName: '', address: '', notes: '', status: 'active',
  });
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

  const updateClient = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const { error } = await supabase
        .from('clients')
        .update({
          client_name: data.clientName,
          designation: data.designation || null,
          email: data.email || null,
          phone: data.phone || null,
          company_name: data.companyName || null,
          billing_address: data.address || null,
          notes: data.notes || null,
          status: data.status,
        })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client updated successfully');
      setIsEditOpen(false);
    },
    onError: (error: any) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  const handleOpenEdit = () => {
    if (!client) return;
    setEditForm({
      clientName: client.client_name,
      designation: client.designation || '',
      email: client.email || '',
      phone: client.phone || '',
      companyName: client.company_name || '',
      address: client.billing_address || '',
      notes: client.notes || '',
      status: client.status,
    });
    setIsEditOpen(true);
  };

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/clients">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">{client.client_name}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleOpenEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
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
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
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
          <TabsTrigger value="account" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contacts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                type TLEvent = {
                  id: string;
                  date: string;
                  type: 'client' | 'project' | 'proposal' | 'contract';
                  title: string;
                  subtitle?: string;
                  status?: string;
                  href?: string;
                };
                const events: TLEvent[] = [];

                if (client.created_at) {
                  events.push({
                    id: `client-${client.id}`,
                    date: client.created_at,
                    type: 'client',
                    title: 'Client onboarded',
                    subtitle: client.client_name,
                  });
                }
                clientProjects.forEach((p: any) => {
                  events.push({
                    id: `project-${p.id}`,
                    date: p.start_date || p.created_at,
                    type: 'project',
                    title: `Project: ${p.project_name}`,
                    subtitle: p.project_type,
                    status: p.status,
                    href: `/projects/${p.id}`,
                  });
                });
                clientProposals.forEach((p: any) => {
                  events.push({
                    id: `proposal-${p.id}`,
                    date: p.created_at,
                    type: 'proposal',
                    title: `Proposal: ${p.title}`,
                    subtitle: p.validity_date ? `Valid until ${format(new Date(p.validity_date), 'MMM dd, yyyy')}` : undefined,
                    status: p.status,
                  });
                });
                clientContracts.forEach((c: any) => {
                  const label = c.contract_type === 'amc' ? 'Annual Maintenance Contract'
                    : c.contract_type === 'retainer' ? 'Retainer Contract'
                    : c.contract_type === 'fixed' ? 'Fixed Contract' : c.contract_type;
                  events.push({
                    id: `contract-${c.id}`,
                    date: c.start_date || c.created_at,
                    type: 'contract',
                    title: `Contract: ${label}`,
                    subtitle: `₹${Number(c.value).toLocaleString('en-IN')} • ${format(new Date(c.start_date), 'MMM dd, yyyy')} – ${format(new Date(c.end_date), 'MMM dd, yyyy')}`,
                    status: c.status,
                    href: `/contracts/${c.id}`,
                  });
                });

                events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (events.length === 0) {
                  return <p className="py-8 text-center text-muted-foreground">No activity yet</p>;
                }

                const iconFor = (t: TLEvent['type']) => {
                  switch (t) {
                    case 'client': return UserPlus;
                    case 'project': return FolderKanban;
                    case 'proposal': return FileText;
                    case 'contract': return FileSignature;
                    default: return CircleDot;
                  }
                };

                return (
                  <ol className="relative ml-3 border-l border-border">
                    {events.map((ev) => {
                      const Icon = iconFor(ev.type);
                      const Inner = (
                        <div className="rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                              {ev.subtitle && (
                                <p className="mt-0.5 text-xs text-muted-foreground capitalize truncate">{ev.subtitle}</p>
                              )}
                            </div>
                            {ev.status && <StatusBadge status={ev.status as any} />}
                          </div>
                        </div>
                      );
                      return (
                        <li key={ev.id} className="mb-5 ml-6 last:mb-0">
                          <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 ring-4 ring-background">
                            <Icon className="h-3 w-3 text-primary" />
                          </span>
                          <time className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {format(new Date(ev.date), 'MMM dd, yyyy')}
                          </time>
                          {ev.href ? <Link to={ev.href}>{Inner}</Link> : Inner}
                        </li>
                      );
                    })}
                  </ol>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <div className="space-y-3">
            {clientProjects.map(project => (
              <Link key={project.id} to={`/projects/${project.id}`} className="block">
                <Card className="transition-all hover:border-primary/20 hover:shadow-sm">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-foreground hover:text-primary transition-colors">{project.project_name}</p>
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
              </Link>
            ))}
            {clientProjects.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No projects yet</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="proposals" className="mt-4">
          <div className="space-y-3">
            {clientProposals.map(proposal => (
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
            {clientProposals.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No proposals yet</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          <div className="space-y-3">
            {clientContracts.map(contract => (
              <Link key={contract.id} to="/contracts" className="block">
                <Card className="transition-all hover:border-primary/20 hover:shadow-sm">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium capitalize text-foreground hover:text-primary transition-colors">
                        {contract.contract_type === 'amc' ? 'Annual Maintenance Contract' : contract.contract_type === 'retainer' ? 'Retainer Contract' : contract.contract_type === 'fixed' ? 'Fixed Contract' : contract.contract_type}
                      </p>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <span>₹{Number(contract.value).toLocaleString('en-IN')}</span>
                      <span>•</span>
                      <span>
                        {format(new Date(contract.start_date), 'MMM dd')} - {format(new Date(contract.end_date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </div>
                    <StatusBadge status={contract.status as any} />
                  </CardContent>
                </Card>
              </Link>
            ))}
            {clientContracts.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No contracts yet</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="account" className="mt-4">
          <ClientLedger clientId={id!} />
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <ClientContacts clientId={id!} />
        </TabsContent>
      </Tabs>

      {/* Edit Client Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateClient.mutate(editForm); }} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clientName">Name *</Label>
                <Input id="clientName" value={editForm.clientName} onChange={(e) => setEditForm(prev => ({ ...prev, clientName: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input id="designation" value={editForm.designation} onChange={(e) => setEditForm(prev => ({ ...prev, designation: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input id="email" type="email" value={editForm.email} onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input id="phone" type="tel" value={editForm.phone} onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" value={editForm.companyName} onChange={(e) => setEditForm(prev => ({ ...prev, companyName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Company Address</Label>
                <Input id="address" value={editForm.address} onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="status">Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value }))}>
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
              <Textarea id="notes" rows={3} value={editForm.notes} onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateClient.isPending}>
                {updateClient.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
