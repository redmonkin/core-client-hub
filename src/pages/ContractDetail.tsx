import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTemplates, Template } from '@/hooks/useTemplates';
import {
  ArrowLeft, Loader2, FileSignature, Clock, CheckCircle2, XCircle,
  Send, PenLine, MessageSquare, Mail, Eye, Pencil, LinkIcon, Copy,
  MoreVertical, Users, Calendar, RefreshCw, AlertTriangle, FileText,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ContractFormDialog } from '@/components/contracts/ContractFormDialog';
import { ProposalPreviewDialog } from '@/components/proposals/ProposalPreviewDialog';
import { ProposalData } from '@/lib/proposal-utils';
import { ContractStatus } from '@/lib/types';
import { getOrCreateContractPortalAccess, regenerateContractPortalAccess } from '@/lib/contract-portal-access';

const contractTypeLabels: Record<string, string> = {
  amc: 'Annual Maintenance Contract',
  fixed: 'Fixed Contract',
  retainer: 'Retainer',
};

const renewalLabels: Record<string, string> = {
  '1-month': '1 Month',
  '3-months': '3 Months',
  '6-months': '6 Months',
  '1-year': '1 Year',
  '3-years': '3 Years',
};

const statusIconMap: Record<string, React.ElementType> = {
  draft: PenLine,
  sent: Send,
  approved: CheckCircle2,
  rejected: XCircle,
  change_requested: MessageSquare,
  active: CheckCircle2,
  expired: AlertTriangle,
  'pending-renewal': RefreshCw,
};

const statusColorMap: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/10 text-primary',
  approved: 'bg-green-500/10 text-green-600',
  rejected: 'bg-destructive/10 text-destructive',
  change_requested: 'bg-orange-500/10 text-orange-600',
  active: 'bg-green-500/10 text-green-600',
  expired: 'bg-destructive/10 text-destructive',
  'pending-renewal': 'bg-orange-500/10 text-orange-600',
};

function computeValueFromCostBreakdown(costBreakdown: string | null): number {
  if (!costBreakdown) return 0;
  try {
    const parsed = JSON.parse(costBreakdown);
    if (!parsed.items || !Array.isArray(parsed.items)) return 0;
    const subtotal = parsed.items.reduce((acc: number, item: any) => {
      const lineTotal = (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100);
      return acc + lineTotal;
    }, 0);
    const additionalDiscount = subtotal * ((parsed.additionalDiscount || 0) / 100);
    const afterDiscount = subtotal - additionalDiscount;
    const tax = afterDiscount * ((parsed.taxRate || 0) / 100);
    return afterDiscount + tax;
  } catch {
    return 0;
  }
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { templates } = useTemplates();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editDialogKey, setEditDialogKey] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewData, setPreviewData] = useState<ProposalData | null>(null);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedCcEmails, setSelectedCcEmails] = useState<string[]>([]);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [sharePassword, setSharePassword] = useState<string | null>(null);
  const [isExistingLink, setIsExistingLink] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = useState(false);
  const [regenerateBeforeSend, setRegenerateBeforeSend] = useState(false);

  const { data: contract, isLoading: contractLoading, refetch: refetchContract } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('contracts').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: statusHistory = [] } = useQuery({
    queryKey: ['contract-status-history', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_status_history' as any)
        .select('*')
        .eq('contract_id', id!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

  const { data: client } = useQuery({
    queryKey: ['client', contract?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, company_name, email, designation, phone, billing_address, primary_contact_name')
        .eq('id', contract!.client_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!contract?.client_id,
  });

  const { data: project } = useQuery({
    queryKey: ['project', contract?.project_id],
    queryFn: async () => {
      if (!contract?.project_id) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, client_id')
        .eq('id', contract.project_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!contract?.project_id,
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

  const { data: clientContacts = [] } = useQuery({
    queryKey: ['client-contacts', contract?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_contacts')
        .select('*')
        .eq('client_id', contract!.client_id)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contract?.client_id,
  });

  const updateContractMutation = useMutation({
    mutationFn: async (formData: any) => {
      const { data, error } = await supabase
        .from('contracts')
        .update({
          client_id: formData.client_id,
          project_id: formData.project_id || null,
          contract_type: formData.contract_type,
          start_date: formData.start_date,
          end_date: formData.end_date,
          value: computeValueFromCostBreakdown(formData.cost_breakdown),
          renewal_frequency: formData.renewal_frequency,
          status: formData.status,
          scope_of_work: formData.scope_of_work || null,
          cost_breakdown: formData.cost_breakdown || null,
          template_id: formData.template_id || null,
          is_external: !!formData.is_external,
          file_url: formData.file_url || null,
          file_name: formData.file_name || null,
          file_type: formData.file_type || null,
        } as any)
        .eq('id', id!)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, formData) => {
      // Log status change if it changed
      if (contract && contract.status !== formData.status) {
        await supabase.from('contract_status_history' as any).insert({
          contract_id: id!,
          user_id: user?.id,
          from_status: contract.status,
          to_status: formData.status,
          note: null,
        } as any);
      }

      refetchContract();
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-status-history', id] });
      setIsEditDialogOpen(false);
      toast.success('Contract updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update contract: ' + error.message);
    },
  });

  const handleEdit = () => {
    setEditDialogKey(prev => prev + 1);
    setIsEditDialogOpen(true);
  };

  const handleViewFile = async () => {
    const path = (contract as any)?.file_url;
    if (!path) return;
    const { data, error } = await supabase.storage
      .from('contract-files')
      .createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast.error('Could not open file');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePreview = () => {
    if (!contract) return;
    const contractTemplates = templates.filter(t => t.type === 'contract');
    if (contractTemplates.length === 0) {
      toast.error('No contract templates found. Create a template first.');
      return;
    }

    const savedTemplate = contract.template_id
      ? contractTemplates.find((template) => template.id === contract.template_id)
      : null;

    setPreviewData({
      title: contractTypeLabels[contract.contract_type] || contract.contract_type,
      clientName: client?.primary_contact_name || client?.client_name || '',
      clientDesignation: client?.designation || '',
      clientEmail: client?.email || '',
      clientPhone: client?.phone || '',
      companyName: client?.company_name || client?.client_name || '',
      companyAddress: client?.billing_address || '',
      projectName: project?.project_name || '',
      projectWebsite: '',
      customerGoals: '',
      scopeOfWork: contract.scope_of_work || '',
      costBreakdown: contract.cost_breakdown || '',
      validityDate: contract.end_date || '',
      duration: '',
      createdAt: contract.start_date || new Date().toISOString(),
      contractType: contract.contract_type,
      renewalFrequency: contract.renewal_frequency,
      startDate: contract.start_date,
      endDate: contract.end_date,
      approvedDate: contract.status === 'approved' ? contract.updated_at : '',
      clientSignature: (contract as any).client_signature || '',
      mySignature: user?.user_metadata?.full_name || '',
    });
    setPreviewTemplate(savedTemplate || contractTemplates[0]);
    setIsPreviewOpen(true);
  };

  const handleSendEmail = () => {
    if (!client?.email) {
      toast.error('This client does not have an email address configured');
      return;
    }
    setSelectedCcEmails([]);
    setIsSendDialogOpen(true);
  };

  const confirmSendEmail = async () => {
    if (!contract || !client?.email) return;
    setIsSending(true);
    try {
      const portal = await createContractPortalAccess(contract.id, window.location.origin);
      const portalLink = portal.link;
      const password = portal.password;

      const { data: brandingData } = await supabase
        .from('branding_settings')
        .select('support_email, company_name')
        .eq('user_id', user?.id)
        .maybeSingle();

      const contractTypeLabelsLocal: Record<string, string> = {
        amc: 'Annual Maintenance Contract',
        fixed: 'Fixed Contract',
        retainer: 'Retainer Contract',
      };

      const renewalLabelsLocal: Record<string, string> = {
        '1-month': '1 Month',
        '3-months': '3 Months',
        '6-months': '6 Months',
        '1-year': '1 Year',
        '3-years': '3 Years',
      };

      const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
      };

      const { error } = await supabase.functions.invoke('send-notification-email', {
        body: {
          type: 'contract_sent',
          recipientEmail: client.email,
          recipientName: client.primary_contact_name || client.client_name,
          data: {
            contractTitle: contractTypeLabelsLocal[contract.contract_type] || contract.contract_type,
            contractType: contract.contract_type,
            startDate: contract.start_date,
            endDate: contract.end_date,
            totalAmount: contract.value ? formatCurrency(contract.value) : null,
            renewalFrequency: renewalLabelsLocal[contract.renewal_frequency] || contract.renewal_frequency,
            senderName: user?.user_metadata?.full_name || 'Your Team',
            senderCompany: brandingData?.company_name || null,
            supportEmail: brandingData?.support_email || null,
            portalLink,
            portalPassword: password,
          },
          ccEmails: [...(selectedCcEmails.length > 0 ? selectedCcEmails : []), ...(user?.email ? [user.email] : [])].filter((v, i, a) => a.indexOf(v) === i),
        },
      });

      if (error) throw error;

      const previousStatus = contract.status;
      if (previousStatus === 'draft') {
        await supabase.from('contracts').update({ status: 'sent' }).eq('id', contract.id);
      }

      // Always log send action in history (matching proposal behavior)
      await supabase.from('contract_status_history' as any).insert({
        contract_id: contract.id,
        user_id: user?.id,
        from_status: previousStatus,
        to_status: previousStatus === 'draft' ? 'sent' : previousStatus,
        note: `Contract emailed to ${client.email}${selectedCcEmails.length > 0 ? ` (CC: ${selectedCcEmails.join(', ')})` : ''}`,
      } as any);

      refetchContract();
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-status-history', id] });

      const ccNote = selectedCcEmails.length > 0 ? ` (CC: ${selectedCcEmails.join(', ')})` : '';
      toast.success(`Contract sent to ${client.email}${ccNote}`);
      setIsSendDialogOpen(false);
    } catch (error: any) {
      toast.error('Failed to send email: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleShareLink = async () => {
    if (!contract) return;
    setShareLink('');
    setSharePassword('');
    setIsShareDialogOpen(true);
    setIsGeneratingLink(true);
    try {
      const portal = await createContractPortalAccess(contract.id, window.location.origin);
      setShareLink(portal.link);
      setSharePassword(portal.password);
    } catch (error: any) {
      toast.error('Failed to generate share link');
      setIsShareDialogOpen(false);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  if (contractLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Contract not found.</p>
        <Link to="/contracts">
          <Button variant="outline" className="mt-4">Back to Contracts</Button>
        </Link>
      </div>
    );
  }

  const startDate = new Date(contract.start_date);
  const endDate = new Date(contract.end_date);
  const now = new Date();
  const daysUntilEnd = differenceInDays(endDate, now);
  const totalDays = differenceInDays(endDate, startDate);
  const elapsedDays = differenceInDays(now, startDate);
  const progressPercent = totalDays > 0 ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 0;

  const editFormData = {
    client_id: contract.client_id,
    project_id: contract.project_id || '',
    contract_type: contract.contract_type,
    start_date: contract.start_date,
    end_date: contract.end_date,
    renewal_frequency: contract.renewal_frequency,
    status: contract.status,
    scope_of_work: contract.scope_of_work || '',
    cost_breakdown: contract.cost_breakdown || '',
    template_id: (contract as any).template_id || '',
    is_external: !!(contract as any).is_external,
    file_url: (contract as any).file_url || '',
    file_name: (contract as any).file_name || '',
    file_type: (contract as any).file_type || '',
  };

  // Build timeline from real status history
  const lifecycleStages: Array<{
    id: string;
    status: string;
    fromStatus: string | null;
    label: string;
    note: string | null;
    date: string | null;
    reached: boolean;
    icon: React.ElementType;
  }> = statusHistory.map((entry: any) => ({
    id: entry.id,
    status: entry.to_status,
    fromStatus: entry.from_status,
    label: entry.to_status === 'draft' ? 'Contract Created' :
           entry.to_status === 'sent' ? 'Sent to Client' :
           entry.to_status === 'approved' ? 'Approved' :
           entry.to_status === 'active' ? 'Active' :
           entry.to_status === 'rejected' ? 'Rejected' :
           entry.to_status === 'change_requested' ? 'Change Requested' :
           entry.to_status === 'pending-renewal' ? 'Pending Renewal' :
           entry.to_status === 'expired' ? 'Expired' : entry.to_status,
    note: entry.note,
    date: entry.created_at,
    reached: true,
    icon: statusIconMap[entry.to_status] || PenLine,
  }));

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/contracts">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              {contractTypeLabels[contract.contract_type] || contract.contract_type}
            </h1>
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
              {!['approved', 'active'].includes(contract.status) && (
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
              <StatusBadge status={contract.status as any} />
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span>{contractTypeLabels[contract.contract_type] || contract.contract_type}</span>
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
              <span>{format(new Date(contract.created_at), 'MMM dd, yyyy')}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span>{format(startDate, 'MMM dd, yyyy')}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">End Date</span>
              <span className={daysUntilEnd <= 30 && daysUntilEnd > 0 ? 'text-destructive font-medium' : ''}>
                {format(endDate, 'MMM dd, yyyy')}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Renewal</span>
              <span>{renewalLabels[contract.renewal_frequency] || contract.renewal_frequency}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Value</span>
              <span className="font-semibold">₹{Number(contract.value).toLocaleString('en-IN')}</span>
            </div>

            {/* Progress bar for active contracts */}
            {contract.status === 'active' && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="text-muted-foreground">{Math.round(progressPercent)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  {daysUntilEnd > 0 ? (
                    <p className="text-xs text-muted-foreground">{daysUntilEnd} days remaining</p>
                  ) : (
                    <p className="text-xs text-destructive font-medium">Contract has ended</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* External Contract File Card */}
        {(contract as any).is_external && (contract as any).file_url && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Uploaded Contract File
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{(contract as any).file_name || 'Contract file'}</p>
                    <p className="text-xs text-muted-foreground">
                      {(contract as any).file_type || 'Document'}
                    </p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleViewFile}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Status Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {lifecycleStages.map((stage, index) => {
                const Icon = stage.icon;
                const colorClass = stage.reached
                  ? (statusColorMap[stage.status] || 'bg-muted text-muted-foreground')
                  : 'bg-muted/50 text-muted-foreground/50';
                const isLast = index === lifecycleStages.length - 1;

                return (
                  <div key={stage.id} className="flex gap-4 pb-6 last:pb-0">
                    {/* Line + Icon */}
                    <div className="flex flex-col items-center">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      {!isLast && (
                        <div className="w-px flex-1 mt-1 bg-border" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={stage.status as any} />
                        {stage.fromStatus && (
                          <span className="text-xs text-muted-foreground">
                            from <StatusBadge status={stage.fromStatus as any} className="text-[10px] px-1.5 py-0" />
                          </span>
                        )}
                      </div>
                      {stage.note && (
                        <p className={`mt-1 text-sm ${stage.reached ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                          {stage.note}
                        </p>
                      )}
                      {stage.date && stage.reached && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(stage.date), 'MMM dd, yyyy · h:mm a')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {lifecycleStages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No status changes recorded yet. Changes will appear here as the contract progresses.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Send Email Dialog */}
      <AlertDialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Contract to Client</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Send contract to <strong>{client?.email}</strong>?
                </p>
                {contract.status === 'draft' && (
                  <p className="text-muted-foreground">The contract status will be updated to "Sent".</p>
                )}
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
                                checked ? [...prev, contact.email!] : prev.filter(e => e !== contact.email!)
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
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSendEmail} disabled={isSending}>
              {isSending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />Send Email</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Contract Dialog */}
      <ContractFormDialog
        key={editDialogKey}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={(data) => updateContractMutation.mutate(data)}
        initialData={editFormData}
        clients={clients as any}
        projects={projects as any}
        templates={templates}
        isSubmitting={updateContractMutation.isPending}
        mode="edit"
      />

      {/* Share Link Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Contract Link</DialogTitle>
            <DialogDescription>Share this link with your client so they can view the contract.</DialogDescription>
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
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
                <div className="flex items-center gap-2">
                  <Input value={sharePassword} readOnly className="flex-1 font-mono tracking-widest text-lg" />
                  <Button onClick={() => { navigator.clipboard.writeText(sharePassword); toast.success('Password copied!'); }} variant="secondary">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Share both the link and password with your client. The link expires in 30 days.</p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsShareDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Preview Dialog */}
      <ProposalPreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        template={previewTemplate}
        proposalData={previewData!}
      />
    </div>
  );
}
