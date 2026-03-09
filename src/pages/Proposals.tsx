import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, FileText, MoreHorizontal, Download, Loader2, Pencil, Trash2, Copy, Send, LinkIcon } from 'lucide-react';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { toast } from 'sonner';
import { ProposalFormDialog } from '@/components/proposals/ProposalFormDialog';

type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected';

type Proposal = {
  id: string;
  title: string;
  client_id: string;
  project_id: string | null;
  scope_of_work: string | null;
  cost_breakdown: string | null;
  customer_goals: string | null;
  validity_date: string | null;
  status: string;
};

type Client = {
  id: string;
  client_name: string;
  email: string | null;
};

interface ProposalFormData {
  title: string;
  clientId: string;
  projectId: string;
  scopeOfWork: string;
  costBreakdown: string;
  validityDate: string;
  status: ProposalStatus;
}

const emptyProposal: ProposalFormData = {
  title: '',
  clientId: '',
  projectId: '',
  scopeOfWork: '',
  costBreakdown: '',
  validityDate: '',
  status: 'draft',
};

export default function Proposals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [newProposal, setNewProposal] = useState(emptyProposal);
  const [editProposal, setEditProposal] = useState(emptyProposal);
  const [isSending, setIsSending] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

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
        .select('id, client_name, email')
        .order('client_name');
      if (error) throw error;
      return data as Client[];
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
      setNewProposal(emptyProposal);
      toast.success('Proposal created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create proposal: ' + error.message);
    },
  });

  const updateProposalMutation = useMutation({
    mutationFn: async ({ id, ...proposal }: { id: string } & typeof editProposal) => {
      const { data, error } = await supabase
        .from('proposals')
        .update({
          title: proposal.title,
          client_id: proposal.clientId,
          project_id: proposal.projectId || null,
          scope_of_work: proposal.scopeOfWork || null,
          cost_breakdown: proposal.costBreakdown || null,
          validity_date: proposal.validityDate || null,
          status: proposal.status,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      setIsEditDialogOpen(false);
      setSelectedProposal(null);
      toast.success('Proposal updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update proposal: ' + error.message);
    },
  });

  const deleteProposalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('proposals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      setIsDeleteDialogOpen(false);
      setSelectedProposal(null);
      toast.success('Proposal deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete proposal: ' + error.message);
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

  const getClientEmail = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.email || null;
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return 'No Project';
    const project = projects.find(p => p.id === projectId);
    return project?.project_name || 'Unknown Project';
  };


  const handleExportPDF = async (proposal: Proposal) => {
    const toastId = toast.loading('Generating PDF...');
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-proposal-pdf', {
        body: {
          proposalTitle: proposal.title,
          clientName: getClientName(proposal.client_id),
          projectName: getProjectName(proposal.project_id),
          scopeOfWork: proposal.scope_of_work,
          costBreakdown: proposal.cost_breakdown,
          validityDate: proposal.validity_date,
          status: proposal.status,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to generate PDF');

      // Convert base64 to blob and download
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${proposal.title.replace(/[^a-z0-9]/gi, '_')}_proposal.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('PDF downloaded successfully', { id: toastId });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF: ' + error.message, { id: toastId });
    }
  };

  const handleSubmit = (data: ProposalFormData) => {
    if (!data.title || !data.clientId) {
      toast.error('Please fill in required fields');
      return;
    }
    createProposalMutation.mutate(data);
  };

  const handleEdit = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setEditProposal({
      title: proposal.title,
      clientId: proposal.client_id,
      projectId: proposal.project_id || '',
      scopeOfWork: proposal.scope_of_work || '',
      costBreakdown: proposal.cost_breakdown || '',
      validityDate: proposal.validity_date || '',
      status: proposal.status as ProposalStatus,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setIsDeleteDialogOpen(true);
  };

  const handleDuplicate = (proposal: Proposal) => {
    setNewProposal({
      title: `${proposal.title} (Copy)`,
      clientId: proposal.client_id,
      projectId: proposal.project_id || '',
      scopeOfWork: proposal.scope_of_work || '',
      costBreakdown: proposal.cost_breakdown || '',
      validityDate: '',
      status: 'draft',
    });
    setIsDialogOpen(true);
  };

  const handleSendEmail = (proposal: Proposal) => {
    const clientEmail = getClientEmail(proposal.client_id);
    if (!clientEmail) {
      toast.error('This client does not have an email address configured');
      return;
    }
    setSelectedProposal(proposal);
    setIsSendDialogOpen(true);
  };

  const confirmSendEmail = async () => {
    if (!selectedProposal) return;
    
    const clientEmail = getClientEmail(selectedProposal.client_id);
    const clientName = getClientName(selectedProposal.client_id);
    
    if (!clientEmail) {
      toast.error('Client email not found');
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-proposal-email', {
        body: {
          proposalId: selectedProposal.id,
          clientEmail,
          clientName,
          proposalTitle: selectedProposal.title,
          scopeOfWork: selectedProposal.scope_of_work,
          costBreakdown: selectedProposal.cost_breakdown,
          validityDate: selectedProposal.validity_date,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send email');

      // Update proposal status to 'sent' if it was draft
      if (selectedProposal.status === 'draft') {
        await supabase
          .from('proposals')
          .update({ status: 'sent' })
          .eq('id', selectedProposal.id);
        queryClient.invalidateQueries({ queryKey: ['proposals'] });
      }

      toast.success(`Proposal sent to ${clientEmail}`);
      setIsSendDialogOpen(false);
      setSelectedProposal(null);
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleShareLink = async (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setShareLink('');
    setIsShareDialogOpen(true);
    setIsGeneratingLink(true);

    try {
      // Generate a secure random token
      const tokenArray = new Uint8Array(32);
      crypto.getRandomValues(tokenArray);
      const token = Array.from(tokenArray, b => b.toString(16).padStart(2, '0')).join('');

      // Set expiry to 30 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Insert the access token
      const { error } = await supabase
        .from('proposal_access_tokens')
        .insert({
          proposal_id: proposal.id,
          token,
          expires_at: expiresAt.toISOString(),
        });

      if (error) throw error;

      const link = `${window.location.origin}/portal?token=${token}`;
      setShareLink(link);
    } catch (error: any) {
      console.error('Error generating share link:', error);
      toast.error('Failed to generate share link');
      setIsShareDialogOpen(false);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success('Link copied to clipboard!');
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
          <Button size="lg" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Proposal
          </Button>
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
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => handleEdit(proposal)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(proposal)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSendEmail(proposal)}>
                        <Send className="mr-2 h-4 w-4" />
                        Send to Client
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShareLink(proposal)}>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Get Share Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportPDF(proposal)}>
                        <Download className="mr-2 h-4 w-4" />
                        Export PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(proposal)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
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

      {/* Create/Edit Proposal Dialog */}
      <ProposalFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleSubmit}
        initialData={newProposal}
        clients={clients}
        projects={projects}
        isSubmitting={createProposalMutation.isPending}
        mode="create"
      />

      <ProposalFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={(data) => {
          if (selectedProposal) {
            updateProposalMutation.mutate({ id: selectedProposal.id, ...data });
          }
        }}
        initialData={editProposal}
        clients={clients}
        projects={projects}
        isSubmitting={updateProposalMutation.isPending}
        mode="edit"
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this proposal? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedProposal && deleteProposalMutation.mutate(selectedProposal.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProposalMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Email Confirmation Dialog */}
      <AlertDialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedProposal && (
                <>
                  Send "{selectedProposal.title}" to{' '}
                  <strong>{getClientEmail(selectedProposal.client_id)}</strong>?
                  {selectedProposal.status === 'draft' && (
                    <span className="block mt-2 text-muted-foreground">
                      The proposal status will be updated to "Sent".
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSendEmail}
              disabled={isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Email
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Link Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Proposal Link</DialogTitle>
            <DialogDescription>
              Share this link with your client so they can view and respond to the proposal.
            </DialogDescription>
          </DialogHeader>
          {isGeneratingLink ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  value={shareLink}
                  readOnly
                  className="flex-1"
                />
                <Button onClick={copyShareLink} variant="secondary">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                This link will expire in 30 days. The client can approve or reject the proposal directly from this link.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsShareDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
