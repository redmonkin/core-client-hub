import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, FileText, MoreHorizontal, Download, Loader2, Pencil, Trash2, Copy, Send, LinkIcon, Eye, Calendar, User, Users, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ViewToggle } from '@/components/ui/view-toggle';
import { useViewMode } from '@/hooks/useViewMode';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { getOrCreateProposalPortalAccess, regenerateProposalPortalAccess } from '@/lib/proposal-portal-access';
import { ProposalFormDialog } from '@/components/proposals/ProposalFormDialog';
import { ProposalPreviewDialog } from '@/components/proposals/ProposalPreviewDialog';
import { ProposalData } from '@/lib/proposal-utils';
import { useTemplates, Template } from '@/hooks/useTemplates';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { differenceInCalendarDays } from 'date-fns';

type ExpiryInfo = { kind: 'expired' | 'expiring'; days: number; label: string } | null;

function getExpiryInfo(validityDate: string | null, status: string): ExpiryInfo {
  if (!validityDate) return null;
  // Don't warn for terminal states
  if (status === 'approved' || status === 'rejected') return null;
  const days = differenceInCalendarDays(new Date(validityDate), new Date());
  if (days < 0) {
    const abs = Math.abs(days);
    return { kind: 'expired', days: abs, label: `Expired ${abs} day${abs === 1 ? '' : 's'} ago` };
  }
  if (days <= 3) {
    if (days === 0) return { kind: 'expiring', days: 0, label: 'Expires today' };
    return { kind: 'expiring', days, label: `Expiring in ${days} day${days === 1 ? '' : 's'}` };
  }
  return null;
}

type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'change_requested';

type Proposal = {
  id: string;
  title: string;
  client_id: string;
  project_id: string | null;
  scope_of_work: string | null;
  cost_breakdown: string | null;
  customer_goals: string | null;
  validity_date: string | null;
  duration: string | null;
  status: string;
  template_id: string | null;
  updated_at: string;
};

type Client = {
  id: string;
  client_name: string;
  email: string | null;
  designation: string | null;
  phone: string | null;
  company_name: string | null;
  billing_address: string | null;
  primary_contact_name: string | null;
};

interface ProposalFormData {
  title: string;
  clientId: string;
  projectId: string;
  scopeOfWork: string;
  costBreakdown: string;
  customerGoals: string;
  validityDate: string;
  duration: string;
  status: ProposalStatus;
}

const emptyProposal: ProposalFormData = {
  title: '',
  clientId: '',
  projectId: '',
  scopeOfWork: '',
  costBreakdown: '',
  customerGoals: '',
  validityDate: '',
  duration: '',
  status: 'draft',
};

export default function Proposals() {
  const { user } = useAuth();
  const { workspaceUserId } = useWorkspaceUser();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all');
  const [viewMode, setViewMode] = useViewMode('proposals', 'list');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [newProposal, setNewProposal] = useState(emptyProposal);
  const [editProposal, setEditProposal] = useState(emptyProposal);
  const [editDialogKey, setEditDialogKey] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [selectedCcEmails, setSelectedCcEmails] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailIntro, setEmailIntro] = useState('');
  const [isReminder, setIsReminder] = useState(false);
  
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [sharePassword, setSharePassword] = useState<string | null>(null);
  const [isExistingLink, setIsExistingLink] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = useState(false);
  const [regenerateBeforeSend, setRegenerateBeforeSend] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewProposalData, setPreviewProposalData] = useState<ProposalData | null>(null);

  const { templates } = useTemplates();

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
        .select('id, client_name, email, designation, phone, company_name, billing_address, primary_contact_name')
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

  // Fetch contacts for the selected proposal's client
  const { data: selectedClientContacts = [] } = useQuery({
    queryKey: ['client-contacts', selectedProposal?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_contacts')
        .select('*')
        .eq('client_id', selectedProposal!.client_id)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProposal?.client_id,
  });

  const createProposalMutation = useMutation({
    mutationFn: async (proposal: typeof newProposal & { templateId?: string }) => {
      const { data, error } = await supabase
        .from('proposals')
        .insert({
          title: proposal.title,
          client_id: proposal.clientId,
          project_id: proposal.projectId || null,
          scope_of_work: proposal.scopeOfWork || null,
          cost_breakdown: proposal.costBreakdown || null,
          customer_goals: proposal.customerGoals || null,
          validity_date: proposal.validityDate || null,
          duration: proposal.duration || null,
          status: proposal.status,
          user_id: workspaceUserId,
          template_id: proposal.templateId || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Log initial status in history
      await supabase.from('proposal_status_history').insert({
        proposal_id: data.id,
        user_id: user?.id,
        from_status: null,
        to_status: proposal.status,
        note: 'Proposal created',
      });

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
    mutationFn: async ({ id, previousStatus, templateId, ...proposal }: { id: string; previousStatus?: string; templateId?: string } & typeof editProposal) => {
      const { data, error } = await supabase
        .from('proposals')
        .update({
          title: proposal.title,
          client_id: proposal.clientId,
          project_id: proposal.projectId || null,
          scope_of_work: proposal.scopeOfWork || null,
          cost_breakdown: proposal.costBreakdown || null,
          customer_goals: proposal.customerGoals || null,
          validity_date: proposal.validityDate || null,
          duration: proposal.duration || null,
          status: proposal.status,
          template_id: templateId || null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Log status change if it changed
      if (previousStatus && previousStatus !== proposal.status) {
        await supabase.from('proposal_status_history').insert({
          proposal_id: id,
          user_id: user?.id,
          from_status: previousStatus,
          to_status: proposal.status,
          note: null,
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal-status-history'] });
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


  const handleExportPDF = (proposal: Proposal) => {
    const proposalTemplates = templates.filter(t => t.type === 'proposal');
    if (proposalTemplates.length === 0) {
      toast.error('No proposal templates found. Create a template first to export PDF.');
      return;
    }
    // Open preview dialog — user can export PDF from there
    const client = clients.find(c => c.id === proposal.client_id);
    const project = projects.find(p => p.id === proposal.project_id);
    
    setPreviewProposalData({
      title: proposal.title,
      clientName: client?.primary_contact_name || client?.client_name || '',
      clientDesignation: client?.designation || '',
      clientEmail: client?.email || '',
      clientPhone: client?.phone || '',
      companyName: client?.company_name || client?.client_name || '',
      companyAddress: client?.billing_address || '',
      projectName: project?.project_name || '',
      projectWebsite: '',
      customerGoals: proposal.customer_goals || '',
      scopeOfWork: proposal.scope_of_work || '',
      costBreakdown: proposal.cost_breakdown || '',
      validityDate: proposal.validity_date || '',
      duration: proposal.duration || '',
      createdAt: new Date().toISOString(),
      approvedDate: proposal.status === 'approved' ? proposal.updated_at : '',
    });
    const savedTemplate = proposal.template_id ? templates.find(t => t.id === proposal.template_id) : null;
    setPreviewTemplate(savedTemplate || proposalTemplates[0]);
    setIsPreviewOpen(true);
  };

  const handleSubmit = ({ templateId, ...data }: ProposalFormData & { templateId?: string }) => {
    if (!data.title || !data.clientId) {
      toast.error('Please fill in required fields');
      return;
    }
    createProposalMutation.mutate({ ...data, templateId });
  };

  const handleEdit = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setEditProposal({
      title: proposal.title,
      clientId: proposal.client_id,
      projectId: proposal.project_id || '',
      scopeOfWork: proposal.scope_of_work || '',
      costBreakdown: proposal.cost_breakdown || '',
      customerGoals: proposal.customer_goals || '',
      validityDate: proposal.validity_date || '',
      duration: proposal.duration || '',
      status: proposal.status as ProposalStatus,
    });
    setEditDialogKey(prev => prev + 1);
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
      customerGoals: proposal.customer_goals || '',
      duration: proposal.duration || '',
      validityDate: '',
      status: 'draft',
    });
    setIsDialogOpen(true);
  };

  const handlePreview = (proposal: Proposal) => {
    const proposalTemplates = templates.filter(t => t.type === 'proposal');
    if (proposalTemplates.length === 0) {
      toast.error('No proposal templates found. Create a template first.');
      return;
    }
    const client = clients.find(c => c.id === proposal.client_id);
    const project = projects.find(p => p.id === proposal.project_id);
    
    setPreviewProposalData({
      title: proposal.title,
      clientName: client?.primary_contact_name || client?.client_name || '',
      clientDesignation: client?.designation || '',
      clientEmail: client?.email || '',
      clientPhone: client?.phone || '',
      companyName: client?.company_name || client?.client_name || '',
      companyAddress: client?.billing_address || '',
      projectName: project?.project_name || '',
      projectWebsite: '',
      customerGoals: proposal.customer_goals || '',
      scopeOfWork: proposal.scope_of_work || '',
      costBreakdown: proposal.cost_breakdown || '',
      validityDate: proposal.validity_date || '',
      duration: proposal.duration || '',
      createdAt: new Date().toISOString(),
      approvedDate: proposal.status === 'approved' ? proposal.updated_at : '',
    });
    const savedTemplate = proposal.template_id ? templates.find(t => t.id === proposal.template_id) : null;
    setPreviewTemplate(savedTemplate || proposalTemplates[0]);
    setIsPreviewOpen(true);
  };

  const handleSendEmail = (proposal: Proposal) => {
    const clientEmail = getClientEmail(proposal.client_id);
    if (!clientEmail) {
      toast.error('This client does not have an email address configured');
      return;
    }
    const reminder = proposal.status !== 'draft';
    const clientName = getClientName(proposal.client_id);
    setSelectedProposal(proposal);
    setSelectedCcEmails([]);
    setRegenerateBeforeSend(false);
    setIsReminder(reminder);
    setEmailSubject(
      reminder
        ? `Reminder: Proposal "${proposal.title}"`
        : `Proposal: ${proposal.title}`
    );
    setEmailIntro(
      reminder
        ? `Hi ${clientName},\n\nJust a friendly reminder about the proposal we shared with you. We'd love to hear your thoughts whenever you get a chance to review it.`
        : `Hi ${clientName},\n\nA new proposal has been prepared for you. Please review it at your convenience and let us know if you have any questions.`
    );
    setIsSendDialogOpen(true);
  };

  const calculateTotal = (costBreakdownJson: string | null): string => {
    if (!costBreakdownJson) return '';
    try {
      const data = JSON.parse(costBreakdownJson);
      if (!data.items || !Array.isArray(data.items)) return '';
      const subtotal = data.items.reduce((acc: number, item: any) => {
        const lineTotal = item.quantity * item.unitPrice;
        return acc + lineTotal - lineTotal * (item.discount / 100);
      }, 0);
      const discountAmount = subtotal * ((data.additionalDiscount || 0) / 100);
      const afterDiscount = subtotal - discountAmount;
      const taxAmount = afterDiscount * ((data.taxRate || 0) / 100);
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(afterDiscount + taxAmount);
    } catch { return ''; }
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
      // Reuse existing portal link by default; regenerate only if user opted in
      const portal = regenerateBeforeSend
        ? await regenerateProposalPortalAccess(selectedProposal.id, window.location.origin)
        : await getOrCreateProposalPortalAccess(selectedProposal.id, window.location.origin);

      // Fetch support email from branding settings
      const { data: brandingData } = await supabase
        .from('branding_settings')
        .select('support_email')
        .eq('user_id', user?.id)
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke('send-proposal-email', {
        body: {
          proposalId: selectedProposal.id,
          clientEmail,
          clientName,
          proposalTitle: selectedProposal.title,
          customerGoals: selectedProposal.customer_goals,
          totalAmount: calculateTotal(selectedProposal.cost_breakdown),
          validityDate: selectedProposal.validity_date,
          portalLink: portal.link,
          portalPassword: portal.password,
          senderName: user?.user_metadata?.full_name || null,
          senderCompany: user?.user_metadata?.company || null,
          supportEmail: brandingData?.support_email || null,
          ccEmails: [...(selectedCcEmails.length > 0 ? selectedCcEmails : []), ...(user?.email ? [user.email] : [])].filter((v, i, a) => a.indexOf(v) === i),
          customSubject: emailSubject?.trim() || null,
          customIntro: emailIntro?.trim() || null,
          isReminder,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send email');

      // Log email sent in status history
      const previousStatus = selectedProposal.status;
      if (previousStatus === 'draft') {
        await supabase
          .from('proposals')
          .update({ status: 'sent' })
          .eq('id', selectedProposal.id);
      }

      await supabase.from('proposal_status_history').insert({
        proposal_id: selectedProposal.id,
        user_id: user?.id,
        from_status: previousStatus,
        to_status: previousStatus === 'draft' ? 'sent' : previousStatus,
        note: `${isReminder ? 'Reminder email sent' : 'Proposal emailed'} to ${clientEmail}${selectedCcEmails.length > 0 ? ` (CC: ${selectedCcEmails.join(', ')})` : ''}`,
      });

      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal-status-history'] });

      const ccNote = selectedCcEmails.length > 0 ? ` (CC: ${selectedCcEmails.join(', ')})` : '';
      toast.success(`${isReminder ? 'Reminder' : 'Proposal'} sent to ${clientEmail}${ccNote}`);
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
    setSharePassword(null);
    setIsExistingLink(false);
    setIsShareDialogOpen(true);
    setIsGeneratingLink(true);

    try {
      const portal = await getOrCreateProposalPortalAccess(proposal.id, window.location.origin);
      setShareLink(portal.link);
      setSharePassword(portal.password);
      setIsExistingLink(portal.isExisting);
    } catch (error: any) {
      console.error('Error generating share link:', error);
      toast.error('Failed to generate share link');
      setIsShareDialogOpen(false);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleRegenerateShareLink = async () => {
    if (!selectedProposal) return;
    setIsRegenerating(true);
    try {
      const portal = await regenerateProposalPortalAccess(selectedProposal.id, window.location.origin);
      setShareLink(portal.link);
      setSharePassword(portal.password);
      setIsExistingLink(false);
      toast.success('New secure link generated. The old link no longer works.');
    } catch (error: any) {
      console.error('Error regenerating link:', error);
      toast.error('Failed to regenerate link');
    } finally {
      setIsRegenerating(false);
      setIsRegenerateConfirmOpen(false);
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
            <SelectItem value="change_requested">Change Requested</SelectItem>
          </SelectContent>
        </Select>
        <ViewToggle mode={viewMode} onChange={setViewMode} className="h-12 self-stretch sm:self-auto" />
      </div>

      {filteredProposals.length > 0 ? (
        viewMode === 'list' ? (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid md:grid-cols-[1fr_180px_140px_140px_120px_48px] items-center gap-4 border-b border-border bg-muted/40 px-6 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proposal</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valid Until</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
            <span />
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-border">
            {filteredProposals.map(proposal => (
              <div
                key={proposal.id}
                className="group grid grid-cols-1 md:grid-cols-[1fr_180px_140px_140px_120px_48px] items-center gap-3 md:gap-4 px-6 py-4 transition-colors hover:bg-muted/30"
              >
                {/* Proposal Title */}
                <div className="min-w-0">
                  <Link
                    to={`/proposals/${proposal.id}`}
                    className="block"
                  >
                    <h3 className="truncate font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                      <span className="truncate">{proposal.title}</span>
                      {(() => {
                        const info = getExpiryInfo(proposal.validity_date, proposal.status);
                        if (!info) return null;
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertTriangle
                                className={`h-4 w-4 shrink-0 ${info.kind === 'expired' ? 'text-destructive' : 'text-amber-500'}`}
                              />
                            </TooltipTrigger>
                            <TooltipContent>{info.label}</TooltipContent>
                          </Tooltip>
                        );
                      })()}
                    </h3>
                  </Link>
                  {proposal.duration && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      Duration: {proposal.duration}
                    </p>
                  )}
                </div>

                {/* Client */}
                <div className="min-w-0">
                  <Link
                    to={`/clients/${proposal.client_id}`}
                    className="flex items-center gap-1.5 truncate text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{getClientName(proposal.client_id)}</span>
                  </Link>
                </div>

                {/* Project */}
                <div className="min-w-0">
                  <p className="truncate text-sm text-muted-foreground">
                    {getProjectName(proposal.project_id)}
                  </p>
                </div>

                {/* Validity Date */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0 hidden md:block" />
                  <span className="truncate">
                    {proposal.validity_date
                      ? format(new Date(proposal.validity_date), 'MMM dd, yyyy')
                      : '—'}
                  </span>
                </div>

                {/* Status */}
                <div>
                  <StatusBadge status={proposal.status as ProposalStatus} />
                </div>

                {/* Actions */}
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => handlePreview(proposal)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                      </DropdownMenuItem>
                      {proposal.status !== 'approved' && (
                        <DropdownMenuItem onClick={() => handleEdit(proposal)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      )}
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
                      {proposal.status !== 'approved' && (
                        <DropdownMenuItem
                          onClick={() => handleDelete(proposal)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
          ))}
          </div>
        </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProposals.map(proposal => (
              <Card key={proposal.id} className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link
                          to={`/proposals/${proposal.id}`}
                          className="block truncate font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {proposal.title}
                        </Link>
                        {(() => {
                          const info = getExpiryInfo(proposal.validity_date, proposal.status);
                          if (!info) return null;
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle
                                  className={`h-4 w-4 shrink-0 ${info.kind === 'expired' ? 'text-destructive' : 'text-amber-500'}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent>{info.label}</TooltipContent>
                            </Tooltip>
                          );
                        })()}
                      </div>
                      <Link
                        to={`/clients/${proposal.client_id}`}
                        className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{getClientName(proposal.client_id)}</span>
                      </Link>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem onClick={() => handlePreview(proposal)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </DropdownMenuItem>
                        {proposal.status !== 'approved' && (
                          <DropdownMenuItem onClick={() => handleEdit(proposal)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
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
                        {proposal.status !== 'approved' && (
                          <DropdownMenuItem
                            onClick={() => handleDelete(proposal)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <StatusBadge status={proposal.status as ProposalStatus} />
                    {proposal.duration && (
                      <span className="text-xs text-muted-foreground">Duration: {proposal.duration}</span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {proposal.validity_date
                          ? `Valid ${format(new Date(proposal.validity_date), 'MMM dd, yyyy')}`
                          : 'No validity date'}
                      </span>
                    </div>
                    <Link
                      to={`/proposals/${proposal.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      View →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
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
        templates={templates}
        isSubmitting={createProposalMutation.isPending}
        mode="create"
      />

      <ProposalFormDialog
        key={editDialogKey}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={({ templateId, ...data }) => {
          if (selectedProposal) {
            updateProposalMutation.mutate({ id: selectedProposal.id, previousStatus: selectedProposal.status, templateId, ...data });
          }
        }}
        initialData={editProposal}
        initialTemplateId={selectedProposal?.template_id || ''}
        clients={clients}
        projects={projects}
        templates={templates}
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

      {/* Send Email Dialog */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isReminder ? 'Send Reminder' : 'Send Proposal'}
              {isReminder && (
                <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">
                  Already sent
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedProposal && (
                <>
                  {isReminder
                    ? `This proposal was already sent. We'll send a reminder to `
                    : `Send "${selectedProposal.title}" to `}
                  <strong className="text-foreground">{getClientEmail(selectedProposal.client_id)}</strong>
                  {selectedProposal.status === 'draft' && '. The status will be updated to "Sent".'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedProposal && (
            <div className="space-y-4">
              {/* Subject */}
              <div className="space-y-1.5">
                <Label htmlFor="email-subject">Subject</Label>
                <Input
                  id="email-subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="email-intro">Message</Label>
                <Textarea
                  id="email-intro"
                  value={emailIntro}
                  onChange={(e) => setEmailIntro(e.target.value)}
                  rows={5}
                  placeholder="Write a personal note to your client..."
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Proposal details (amount, validity, secure link) are appended automatically.
                </p>
              </div>

              {/* CC Contacts */}
              {(() => {
                const clientEmail = getClientEmail(selectedProposal.client_id);
                const ccContacts = selectedClientContacts.filter(c => c.email && c.email !== clientEmail);
                if (ccContacts.length === 0) return null;
                return (
                  <div className="rounded-md border p-3 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      CC Additional Contacts
                    </p>
                    {ccContacts.map(contact => (
                      <label key={contact.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedCcEmails.includes(contact.email!)}
                          onCheckedChange={(checked) => {
                            setSelectedCcEmails(prev =>
                              checked
                                ? [...prev, contact.email!]
                                : prev.filter(e => e !== contact.email!)
                            );
                          }}
                        />
                        <span className="truncate">{contact.name}</span>
                        <span className="text-muted-foreground truncate">({contact.email})</span>
                      </label>
                    ))}
                  </div>
                );
              })()}

              {/* Regenerate secure link option */}
              <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer">
                <Checkbox
                  checked={regenerateBeforeSend}
                  onCheckedChange={(checked) => setRegenerateBeforeSend(checked === true)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Regenerate secure link &amp; password</p>
                  <p className="text-xs text-muted-foreground">
                    By default, the existing share link is reused (no new password is sent). Tick this to invalidate the old link and email a fresh password.
                  </p>
                </div>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendDialogOpen(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button onClick={confirmSendEmail} disabled={isSending || !emailSubject.trim()}>
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {isReminder ? 'Send Reminder' : 'Send Email'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Link</label>
                <div className="flex items-center gap-2">
                  <Input value={shareLink} readOnly className="flex-1" />
                  <Button onClick={copyShareLink} variant="secondary">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {sharePassword ? (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={sharePassword}
                      readOnly
                      className="flex-1 font-mono tracking-widest text-lg"
                    />
                    <Button onClick={() => { navigator.clipboard.writeText(sharePassword!); toast.success('Password copied!'); }} variant="secondary">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  This share link is already active. The access password was shown when it was first generated and is securely hashed — it can't be retrieved. If you need a new password, regenerate the secure link.
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {sharePassword
                  ? 'Share both the link and password with your client. The link expires in 30 days.'
                  : 'The link expires 30 days after it was first generated.'}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setIsRegenerateConfirmOpen(true)}
              disabled={isGeneratingLink || isRegenerating}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
            <Button onClick={() => setIsShareDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate confirmation */}
      <AlertDialog open={isRegenerateConfirmOpen} onOpenChange={setIsRegenerateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Regenerate secure link?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate the existing link and password. Any client who already has the previous link will no longer be able to access the proposal until you share the new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegenerating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerateShareLink} disabled={isRegenerating}>
              {isRegenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Regenerating...</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" />Yes, regenerate</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Proposal Preview Dialog */}
      <ProposalPreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        template={previewTemplate}
        proposalData={previewProposalData!}
      />
    </div>
  );
}
