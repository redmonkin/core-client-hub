import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { useTemplates, Template } from '@/hooks/useTemplates';
import { CommentThread } from '@/components/shared/CommentThread';
import { ArrowLeft, Loader2, FileText, Clock, CheckCircle2, XCircle, Send, PenLine, MessageSquare, Mail, Eye, Pencil, LinkIcon, Copy, MoreVertical, Users, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ProposalFormDialog } from '@/components/proposals/ProposalFormDialog';
import { ProposalPreviewDialog } from '@/components/proposals/ProposalPreviewDialog';
import { ProposalData, buildDisplayTemplate } from '@/lib/proposal-utils';
import { getOrCreateProposalPortalAccess, regenerateProposalPortalAccess } from '@/lib/proposal-portal-access';

type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'change_requested';

const statusIconMap: Record<string, React.ElementType> = {
  draft: PenLine,
  sent: Send,
  approved: CheckCircle2,
  rejected: XCircle,
  change_requested: MessageSquare,
};

const statusColorMap: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/10 text-primary',
  approved: 'bg-green-500/10 text-green-600',
  rejected: 'bg-destructive/10 text-destructive',
  change_requested: 'bg-orange-500/10 text-orange-600',
};

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { workspaceUserId } = useWorkspaceUser();
  const queryClient = useQueryClient();
  const { templates } = useTemplates();
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editDialogKey, setEditDialogKey] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewProposalData, setPreviewProposalData] = useState<ProposalData | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [sharePassword, setSharePassword] = useState<string | null>(null);
  const [isExistingLink, setIsExistingLink] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = useState(false);
  const [regenerateBeforeSend, setRegenerateBeforeSend] = useState(false);
  const [selectedCcEmails, setSelectedCcEmails] = useState<string[]>([]);

  const { data: proposal, isLoading: proposalLoading, refetch: refetchProposal } = useQuery({
    queryKey: ['proposal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: client } = useQuery({
    queryKey: ['client', proposal?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, company_name, email, designation, phone, billing_address, primary_contact_name')
        .eq('id', proposal!.client_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!proposal?.client_id,
  });

  const { data: project } = useQuery({
    queryKey: ['project', proposal?.project_id],
    queryFn: async () => {
      if (!proposal?.project_id) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, client_id')
        .eq('id', proposal.project_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!proposal?.project_id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, client_name, email').order('client_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, project_name, client_id').order('project_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: statusHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['proposal-status-history', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_status_history')
        .select('*')
        .eq('proposal_id', id!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: clientContacts = [] } = useQuery({
    queryKey: ['client-contacts', proposal?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_contacts')
        .select('*')
        .eq('client_id', proposal!.client_id)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!proposal?.client_id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['document-comments', 'proposal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_comments')
        .select('id, author_type, author_name, content, created_at')
        .eq('document_type', 'proposal')
        .eq('document_id', id!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updateProposalMutation = useMutation({
    mutationFn: async ({ templateId, ...formData }: any) => {
      const { data, error } = await supabase
        .from('proposals')
        .update({
          title: formData.title,
          client_id: formData.clientId,
          project_id: formData.projectId || null,
          scope_of_work: formData.scopeOfWork || null,
          cost_breakdown: formData.costBreakdown || null,
          customer_goals: formData.customerGoals || null,
          validity_date: formData.validityDate || null,
          duration: formData.duration || null,
          status: formData.status,
          template_id: templateId || null,
        })
        .eq('id', id!)
        .select()
        .single();
      if (error) throw error;

      if (proposal && proposal.status !== formData.status) {
        await supabase.from('proposal_status_history').insert({
          proposal_id: id!,
          user_id: user?.id,
          from_status: proposal.status,
          to_status: formData.status,
          note: null,
        });
      }

      return data;
    },
    onSuccess: () => {
      refetchProposal();
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal-status-history', id] });
      setIsEditDialogOpen(false);
      toast.success('Proposal updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update proposal: ' + error.message);
    },
  });

  const handleSendEmail = () => {
    if (!client?.email) {
      toast.error('This client does not have an email address configured');
      return;
    }
    setSelectedCcEmails([]);
    setRegenerateBeforeSend(false);
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
    if (!proposal || !client?.email) return;
    setIsSending(true);
    try {
      const portal = regenerateBeforeSend
        ? await regenerateProposalPortalAccess(proposal.id, window.location.origin)
        : await getOrCreateProposalPortalAccess(proposal.id, window.location.origin);

      // Fetch support email from branding settings
      const { data: brandingData } = await supabase
        .from('branding_settings')
        .select('support_email')
        .eq('user_id', user?.id)
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke('send-proposal-email', {
        body: {
          proposalId: proposal.id,
          clientEmail: client.email,
          clientName: client.client_name,
          proposalTitle: proposal.title,
          customerGoals: proposal.customer_goals,
          totalAmount: calculateTotal(proposal.cost_breakdown),
          validityDate: proposal.validity_date,
          portalLink: portal.link,
          portalPassword: portal.password,
          senderName: user?.user_metadata?.full_name || null,
          senderCompany: user?.user_metadata?.company || null,
          supportEmail: brandingData?.support_email || null,
          ccEmails: [...(selectedCcEmails.length > 0 ? selectedCcEmails : []), ...(user?.email ? [user.email] : [])].filter((v, i, a) => a.indexOf(v) === i),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send email');

      const previousStatus = proposal.status;
      const proposalTemplates = templates.filter(t => t.type === 'proposal');
      const liveTemplate = (proposal as any).template_id
        ? proposalTemplates.find(t => t.id === (proposal as any).template_id)
        : proposalTemplates[0];
      const updatePayload: Record<string, unknown> = {};
      if (previousStatus === 'draft') updatePayload.status = 'sent';
      // Freeze the template content on first send so later template edits don't
      // retroactively change what this proposal shows the client.
      if (!(proposal as any).content && liveTemplate) updatePayload.content = liveTemplate.content;
      if (Object.keys(updatePayload).length > 0) {
        await supabase
          .from('proposals')
          .update(updatePayload)
          .eq('id', proposal.id);
      }

      await supabase.from('proposal_status_history').insert({
        proposal_id: proposal.id,
        user_id: user?.id,
        from_status: previousStatus,
        to_status: previousStatus === 'draft' ? 'sent' : previousStatus,
        note: `Proposal emailed to ${client.email}${selectedCcEmails.length > 0 ? ` (CC: ${selectedCcEmails.join(', ')})` : ''}`,
      });

      refetchProposal();
      queryClient.invalidateQueries({ queryKey: ['proposal-status-history', id] });

      const ccNote = selectedCcEmails.length > 0 ? ` (CC: ${selectedCcEmails.join(', ')})` : '';
      toast.success(`Proposal sent to ${client.email}${ccNote}`);
      setIsSendDialogOpen(false);
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handlePreview = () => {
    if (!proposal) return;
    const proposalTemplates = templates.filter(t => t.type === 'proposal');
    if (proposalTemplates.length === 0) {
      toast.error('No proposal templates found. Create a template first.');
      return;
    }
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
      createdAt: proposal.created_at,
      approvedDate: statusHistory.find((h: any) => h.to_status === 'approved')?.created_at || '',
    });
    const liveTemplate = (proposal as any).template_id ? templates.find(t => t.id === (proposal as any).template_id) : null;
    setPreviewTemplate(buildDisplayTemplate((proposal as any).content, liveTemplate || proposalTemplates[0]));
    setIsPreviewOpen(true);
  };

  const handleEdit = () => {
    setEditDialogKey(prev => prev + 1);
    setIsEditDialogOpen(true);
  };

  const handleShareLink = async () => {
    if (!proposal) return;
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
    if (!proposal) return;
    setIsRegenerating(true);
    try {
      const portal = await regenerateProposalPortalAccess(proposal.id, window.location.origin);
      setShareLink(portal.link);
      setSharePassword(portal.password);
      setIsExistingLink(false);
      toast.success('New secure link generated. The old link no longer works.');
    } catch (error: any) {
      toast.error('Failed to regenerate link');
    } finally {
      setIsRegenerating(false);
      setIsRegenerateConfirmOpen(false);
    }
  };

  if (proposalLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Proposal not found.</p>
        <Link to="/proposals">
          <Button variant="outline" className="mt-4">Back to Proposals</Button>
        </Link>
      </div>
    );
  }

  const editFormData = {
    title: proposal.title,
    clientId: proposal.client_id,
    projectId: proposal.project_id || '',
    scopeOfWork: proposal.scope_of_work || '',
    costBreakdown: proposal.cost_breakdown || '',
    customerGoals: proposal.customer_goals || '',
    validityDate: proposal.validity_date || '',
    duration: proposal.duration || '',
    status: proposal.status as ProposalStatus,
  };

  // Build a combined timeline: creation + status history
  const timelineItems = [
    {
      id: 'created',
      status: 'draft',
      note: 'Proposal created',
      created_at: proposal.created_at,
      from_status: null as string | null,
      to_status: 'draft',
    },
    ...statusHistory.map((h: any) => ({
      id: h.id,
      status: h.to_status,
      note: h.note,
      created_at: h.created_at,
      from_status: h.from_status,
      to_status: h.to_status,
    })),
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Back button & header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/proposals">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{proposal.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button onClick={handleSendEmail} variant="default" size="sm">
            <Mail className="mr-2 h-4 w-4" />
            Send to Client
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePreview}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </DropdownMenuItem>
              {proposal.status !== 'approved' && (
                <DropdownMenuItem onClick={handleEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleShareLink}>
                <LinkIcon className="mr-2 h-4 w-4" />
                Share Link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={proposal.status as any} />
            </div>
            {client && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <Link to={`/clients/${client.id}`} className="text-right hover:text-primary transition-colors truncate max-w-[180px]">
                    {client.client_name}
                  </Link>
                </div>
              </>
            )}
            {client?.email && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client Email</span>
                  <span className="text-right truncate max-w-[180px]">{client.email}</span>
                </div>
              </>
            )}
            {project && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Project</span>
                  <Link to={`/projects/${project.id}`} className="text-right hover:text-primary transition-colors truncate max-w-[180px]">
                    {project.project_name}
                  </Link>
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(proposal.created_at), 'MMM dd, yyyy')}</span>
            </div>
            {proposal.validity_date && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valid Until</span>
                  <span>{format(new Date(proposal.validity_date), 'MMM dd, yyyy')}</span>
                </div>
              </>
            )}
            {proposal.duration && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span>{proposal.duration}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Timeline Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Status Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="relative">
                {timelineItems.map((item, index) => {
                  const isEmailEvent = item.note?.toLowerCase().includes('emailed');
                  const Icon = isEmailEvent ? Mail : (statusIconMap[item.to_status] || FileText);
                  const colorClass = isEmailEvent ? 'bg-blue-500/10 text-blue-600' : (statusColorMap[item.to_status] || 'bg-muted text-muted-foreground');
                  const isLast = index === timelineItems.length - 1;

                  return (
                    <div key={item.id} className="flex gap-4 pb-6 last:pb-0">
                      {/* Line + Icon */}
                      <div className="flex flex-col items-center">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {!isLast && (
                          <div className="w-px flex-1 bg-border mt-1" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-1">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={item.to_status as any} />
                          {item.from_status && (
                            <span className="text-xs text-muted-foreground">
                              from <StatusBadge status={item.from_status as any} className="text-[10px] px-1.5 py-0" />
                            </span>
                          )}
                        </div>
                        {item.note && (
                          <p className="mt-1 text-sm text-foreground">{item.note}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(item.created_at), 'MMM dd, yyyy · h:mm a')}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {timelineItems.length <= 1 && !historyLoading && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No status changes recorded yet. Changes will appear here as the proposal progresses.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {workspaceUserId && (
          <CommentThread
            documentType="proposal"
            documentId={id!}
            workspaceUserId={workspaceUserId}
            comments={comments}
            queryKeyToInvalidate={['document-comments', 'proposal', id]}
          />
        )}
      </div>

      {/* Send Email Confirmation Dialog */}
      <AlertDialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Proposal to Client</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Send "{proposal.title}" to{' '}
                  <strong>{client?.email}</strong>?
                </p>
                {proposal.status === 'draft' && (
                  <p className="text-muted-foreground">
                    The proposal status will be updated to "Sent".
                  </p>
                )}

                {/* CC Contacts */}
                {(() => {
                  const ccContacts = clientContacts.filter(c => c.email && c.email !== client?.email);
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
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSendEmail} disabled={isSending}>
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

      {/* Edit Proposal Dialog */}
      <ProposalFormDialog
        key={editDialogKey}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={({ templateId, ...data }) => {
          updateProposalMutation.mutate({ templateId, ...data });
        }}
        initialData={editFormData}
        initialTemplateId={(proposal as any).template_id || ''}
        clients={clients}
        projects={projects}
        templates={templates}
        isSubmitting={updateProposalMutation.isPending}
        mode="edit"
      />

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
                  <Button onClick={() => { navigator.clipboard.writeText(shareLink); toast.success('Link copied!'); }} variant="secondary">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {sharePassword ? (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
                  <div className="flex items-center gap-2">
                    <Input value={sharePassword} readOnly className="flex-1 font-mono tracking-widest text-lg" />
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
            <Button variant="outline" onClick={() => setIsRegenerateConfirmOpen(true)} disabled={isGeneratingLink || isRegenerating}>
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
