import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, FileSignature, MoreHorizontal, Calendar, Loader2, Pencil, Trash2, Eye, Copy, Send, LinkIcon, Users, FileText, RefreshCw, AlertTriangle } from "lucide-react";
import { format, differenceInDays, differenceInCalendarDays } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ViewToggle } from "@/components/ui/view-toggle";
import { useViewMode } from "@/hooks/useViewMode";
import { Checkbox } from "@/components/ui/checkbox";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContractFormDialog } from "@/components/contracts/ContractFormDialog";
import { ProposalPreviewDialog } from "@/components/proposals/ProposalPreviewDialog";
import { ProposalData } from "@/lib/proposal-utils";
import { useTemplates, Template } from "@/hooks/useTemplates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceUser } from "@/hooks/useWorkspaceUser";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { ContractStatus } from "@/lib/types";
import { getOrCreateContractPortalAccess, regenerateContractPortalAccess } from "@/lib/contract-portal-access";

type Contract = {
  id: string;
  client_id: string;
  project_id: string | null;
  contract_type: string;
  start_date: string;
  end_date: string;
  value: number;
  renewal_frequency: string;
  status: string;
  scope_of_work: string | null;
  cost_breakdown: string | null;
  template_id: string | null;
  updated_at: string;
  is_external?: boolean | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
};

type ContractFormData = {
  client_id: string;
  project_id: string;
  contract_type: string;
  start_date: string;
  end_date: string;
  renewal_frequency: string;
  status: string;
  scope_of_work: string;
  cost_breakdown: string;
  template_id?: string;
  is_external?: boolean;
  file_url?: string;
  file_name?: string;
  file_type?: string;
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

type ContractExpiryInfo = { kind: 'expired' | 'expiring'; days: number; label: string } | null;

function getContractExpiryInfo(endDate: string | null, status: string): ContractExpiryInfo {
  if (!endDate) return null;
  // Don't warn for terminal/non-active states
  if (status === 'rejected' || status === 'draft') return null;
  const days = differenceInCalendarDays(new Date(endDate), new Date());
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

export default function Contracts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "all">("all");
  const [viewMode, setViewMode] = useViewMode('contracts', 'list');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [editFormKey, setEditFormKey] = useState(0);

  // Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewData, setPreviewData] = useState<ProposalData | null>(null);

  // Send email state
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedCcEmails, setSelectedCcEmails] = useState<string[]>([]);

  // Share link state
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [sharePassword, setSharePassword] = useState<string | null>(null);
  const [isExistingLink, setIsExistingLink] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = useState(false);
  const [regenerateContext, setRegenerateContext] = useState<'share' | 'send' | null>(null);
  const [regenerateBeforeSend, setRegenerateBeforeSend] = useState(false);

  const { user } = useAuth();
  const { workspaceUserId } = useWorkspaceUser();
  const { toast: uiToast } = useToast();
  const queryClient = useQueryClient();
  const { templates } = useTemplates();

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Contract[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("client_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("project_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch contacts for the selected contract's client
  const { data: selectedClientContacts = [] } = useQuery({
    queryKey: ["client-contacts", selectedContract?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("*")
        .eq("client_id", selectedContract!.client_id)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedContract?.client_id,
  });

  const createContractMutation = useMutation({
    mutationFn: async (contractData: ContractFormData) => {
      if (!user?.id) throw new Error("User not authenticated");
      const { data, error } = await supabase
        .from("contracts")
        .insert({
          user_id: workspaceUserId!,
          client_id: contractData.client_id,
          project_id: contractData.project_id || null,
          contract_type: contractData.contract_type,
          start_date: contractData.start_date,
          end_date: contractData.end_date,
          value: computeValueFromCostBreakdown(contractData.cost_breakdown),
          renewal_frequency: contractData.renewal_frequency,
          status: contractData.status,
          scope_of_work: contractData.scope_of_work || null,
          cost_breakdown: contractData.cost_breakdown || null,
          template_id: contractData.template_id || null,
          is_external: !!contractData.is_external,
          file_url: contractData.file_url || null,
          file_name: contractData.file_name || null,
          file_type: contractData.file_type || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setIsDialogOpen(false);
      uiToast({ title: "Contract created successfully" });

      // Log initial status in history
      await supabase.from('contract_status_history' as any).insert({
        contract_id: data.id,
        user_id: user?.id,
        from_status: null,
        to_status: variables.status || 'draft',
        note: 'Contract created',
      } as any);
    },
    onError: (error) => {
      uiToast({ title: "Failed to create contract", description: error.message, variant: "destructive" });
    },
  });

  const updateContractMutation = useMutation({
    mutationFn: async ({ id, ...contractData }: { id: string } & ContractFormData) => {
      const { data, error } = await supabase
        .from("contracts")
        .update({
          client_id: contractData.client_id,
          project_id: contractData.project_id || null,
          contract_type: contractData.contract_type,
          start_date: contractData.start_date,
          end_date: contractData.end_date,
          value: computeValueFromCostBreakdown(contractData.cost_breakdown),
          renewal_frequency: contractData.renewal_frequency,
          status: contractData.status,
          scope_of_work: contractData.scope_of_work || null,
          cost_breakdown: contractData.cost_breakdown || null,
          template_id: contractData.template_id || null,
          is_external: !!contractData.is_external,
          file_url: contractData.file_url || null,
          file_name: contractData.file_name || null,
          file_type: contractData.file_type || null,
        } as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setIsEditDialogOpen(false);

      // Log status change if it changed
      if (selectedContract && selectedContract.status !== variables.status) {
        supabase.from('contract_status_history' as any).insert({
          contract_id: variables.id,
          user_id: user?.id,
          from_status: selectedContract.status,
          to_status: variables.status,
          note: null,
        } as any);
      }

      setSelectedContract(null);
      uiToast({ title: "Contract updated successfully" });
    },
    onError: (error) => {
      uiToast({ title: "Failed to update contract", description: error.message, variant: "destructive" });
    },
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setIsDeleteDialogOpen(false);
      setSelectedContract(null);
      uiToast({ title: "Contract deleted successfully" });
    },
    onError: (error) => {
      uiToast({ title: "Failed to delete contract", description: error.message, variant: "destructive" });
    },
  });

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.client_name || "Unknown Client";
  };

  const getClientEmail = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.email || null;
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return "No Project";
    const project = projects.find((p) => p.id === projectId);
    return project?.project_name || "Unknown Project";
  };

  const filteredContracts = contracts.filter((contract) => {
    const clientName = getClientName(contract.client_id).toLowerCase();
    const projectName = getProjectName(contract.project_id).toLowerCase();
    const matchesSearch =
      clientName.includes(searchQuery.toLowerCase()) || projectName.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleEdit = (contract: Contract) => {
    setSelectedContract(contract);
    setEditFormKey((k) => k + 1);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (contract: Contract) => {
    setSelectedContract(contract);
    setIsDeleteDialogOpen(true);
  };

  const buildContractPreviewData = (contract: Contract): ProposalData => {
    const client = clients.find(c => c.id === contract.client_id);
    const project = projects.find(p => p.id === contract.project_id);
    return {
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
      approvedDate: contract.status === 'approved' ? new Date().toISOString() : '',
    };
  };

  const handlePreview = (contract: Contract) => {
    const contractTemplates = templates.filter(t => t.type === 'contract');
    if (contractTemplates.length === 0) {
      toast.error('No contract templates found. Create a template first.');
      return;
    }

    const savedTemplate = contract.template_id
      ? contractTemplates.find((template) => template.id === contract.template_id)
      : null;

    setPreviewData(buildContractPreviewData(contract));
    setPreviewTemplate(savedTemplate || contractTemplates[0]);
    setIsPreviewOpen(true);
  };

  const handleDuplicate = (contract: Contract) => {
    setSelectedContract(null);
    // Open the create dialog pre-filled with duplicated data
    setIsDialogOpen(true);
    // We need a slight delay for the dialog to mount, so we use a workaround
    // by setting initial data via a state update after dialog opens
    setTimeout(() => {
      const createDialog = document.querySelector('[data-contract-create-dialog]');
      // Instead, we'll use a dedicated state for duplicate initial data
    }, 0);
  };

  // Duplicate state
  const [duplicateInitialData, setDuplicateInitialData] = useState<ContractFormData | undefined>(undefined);

  const handleDuplicateContract = (contract: Contract) => {
    setDuplicateInitialData({
      client_id: contract.client_id,
      project_id: contract.project_id || '',
      contract_type: contract.contract_type,
      start_date: '',
      end_date: '',
      renewal_frequency: contract.renewal_frequency,
      status: 'draft',
      scope_of_work: contract.scope_of_work || '',
      cost_breakdown: contract.cost_breakdown || '',
    });
    setIsDialogOpen(true);
  };

  const handleSendEmail = (contract: Contract) => {
    const clientEmail = getClientEmail(contract.client_id);
    if (!clientEmail) {
      toast.error('This client does not have an email address configured');
      return;
    }
    setSelectedContract(contract);
    setSelectedCcEmails([]);
    setRegenerateBeforeSend(false);
    setIsSendDialogOpen(true);
  };

  const confirmSendEmail = async () => {
    if (!selectedContract) return;

    const clientEmail = getClientEmail(selectedContract.client_id);
    const clientName = getClientName(selectedContract.client_id);

    if (!clientEmail) {
      toast.error('Client email not found');
      return;
    }

    setIsSending(true);
    try {
      // Reuse existing portal link by default; regenerate only if user opted in
      const portal = regenerateBeforeSend
        ? await regenerateContractPortalAccess(selectedContract.id, window.location.origin)
        : await getOrCreateContractPortalAccess(selectedContract.id, window.location.origin);
      const portalLink = portal.link;
      const password = portal.password; // null when reusing existing token

      const { data: brandingData } = await supabase
        .from('branding_settings')
        .select('support_email, company_name')
        .eq('user_id', user?.id)
        .maybeSingle();

      const contractTypeLabelsLocal: Record<string, string> = {
        amc: "Annual Maintenance Contract",
        fixed: "Fixed Contract",
        retainer: "Retainer Contract",
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
          recipientEmail: clientEmail,
          recipientName: clientName,
          data: {
            contractTitle: contractTypeLabelsLocal[selectedContract.contract_type] || selectedContract.contract_type,
            contractType: selectedContract.contract_type,
            startDate: selectedContract.start_date,
            endDate: selectedContract.end_date,
            totalAmount: selectedContract.value ? formatCurrency(selectedContract.value) : null,
            renewalFrequency: renewalLabelsLocal[selectedContract.renewal_frequency] || selectedContract.renewal_frequency,
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

      const previousStatus = selectedContract.status;
      if (previousStatus === 'draft') {
        await supabase
          .from('contracts')
          .update({ status: 'sent' })
          .eq('id', selectedContract.id);
      }

      // Always log send action in history
      await supabase.from('contract_status_history' as any).insert({
        contract_id: selectedContract.id,
        user_id: user?.id,
        from_status: previousStatus,
        to_status: previousStatus === 'draft' ? 'sent' : previousStatus,
        note: `Contract emailed to ${clientEmail}${selectedCcEmails.length > 0 ? ` (CC: ${selectedCcEmails.join(', ')})` : ''}`,
      } as any);

      queryClient.invalidateQueries({ queryKey: ['contracts'] });

      const ccNote = selectedCcEmails.length > 0 ? ` (CC: ${selectedCcEmails.join(', ')})` : '';
      toast.success(`Contract sent to ${clientEmail}${ccNote}`);
      setIsSendDialogOpen(false);
      setSelectedContract(null);
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleShareLink = async (contract: Contract) => {
    setSelectedContract(contract);
    setShareLink('');
    setSharePassword(null);
    setIsExistingLink(false);
    setIsShareDialogOpen(true);
    setIsGeneratingLink(true);

    try {
      const portal = await getOrCreateContractPortalAccess(contract.id, window.location.origin);
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
    if (!selectedContract) return;
    setIsRegenerating(true);
    try {
      const portal = await regenerateContractPortalAccess(selectedContract.id, window.location.origin);
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
      setRegenerateContext(null);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success('Link copied to clipboard!');
  };

  const contractTypeLabels: Record<string, string> = {
    amc: "Annual Maintenance Contract",
    fixed: "Fixed Contract",
    retainer: "Retainer",
  };

  const renewalLabels: Record<string, string> = {
    '1-month': "1 Month",
    '3-months': "3 Months",
    '6-months': "6 Months",
    '1-year': "1 Year",
    '3-years': "3 Years",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Yearly",
  };

  const getEditInitialData = () => {
    if (!selectedContract) return undefined;
    return {
      client_id: selectedContract.client_id,
      project_id: selectedContract.project_id || "",
      contract_type: selectedContract.contract_type,
      start_date: selectedContract.start_date,
      end_date: selectedContract.end_date,
      renewal_frequency: selectedContract.renewal_frequency,
      status: selectedContract.status,
      scope_of_work: selectedContract.scope_of_work || "",
      cost_breakdown: selectedContract.cost_breakdown || "",
      template_id: selectedContract.template_id || "",
      is_external: !!selectedContract.is_external,
      file_url: selectedContract.file_url || "",
      file_name: selectedContract.file_name || "",
      file_type: selectedContract.file_type || "",
    };
  };

  if (contractsLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <PageHeader
        title="Contracts"
        description="Manage contracts, annual maintenance agreements, master service agreements, work orders"
        actions={
          <Button size="lg" onClick={() => { setDuplicateInitialData(undefined); setIsDialogOpen(true); }}>
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
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ContractStatus | "all")}>
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
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="pending-renewal">Pending Renewal</SelectItem>
          </SelectContent>
        </Select>
        <ViewToggle mode={viewMode} onChange={setViewMode} className="h-12 self-stretch sm:self-auto" />
      </div>

      {filteredContracts.length > 0 ? (
        viewMode === 'list' ? (
        <div className="rounded-xl border border-border overflow-hidden min-w-0">
          {/* Grid Header */}
          <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_110px_minmax(0,1fr)_120px_48px] items-center gap-4 border-b border-border bg-muted/40 px-6 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contract</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Value</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
            <span />
          </div>

          {/* Grid Rows */}
          <div className="divide-y divide-border">
            {filteredContracts.map((contract) => {
              const endDate = new Date(contract.end_date);
              const startDate = new Date(contract.start_date);
              const daysUntilEnd = differenceInDays(endDate, new Date());
              const isExpiringSoon = daysUntilEnd > 0 && daysUntilEnd <= 30;

              return (
                <div
                  key={contract.id}
                  className="group grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_110px_minmax(0,1fr)_120px_48px] items-start lg:items-center gap-3 lg:gap-4 px-4 sm:px-6 py-4 transition-colors hover:bg-muted/30"
                >
                  {/* Contract */}
                  <div className="min-w-0 flex items-start justify-between gap-2 lg:block">
                    <div className="min-w-0 flex-1">
                      <Link to={`/contracts/${contract.id}`}>
                        <h3 className="truncate font-medium text-foreground group-hover:text-primary transition-colors cursor-pointer flex items-center gap-2">
                          {contractTypeLabels[contract.contract_type] || contract.contract_type}
                          {contract.is_external && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                              <FileText className="h-3 w-3 mr-1" />
                              File
                            </Badge>
                          )}
                        </h3>
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Renewal: {renewalLabels[contract.renewal_frequency] || contract.renewal_frequency}
                      </p>
                    </div>
                    {/* Mobile-only inline status + actions */}
                    <div className="flex items-center gap-1 shrink-0 lg:hidden">
                      <StatusBadge status={contract.status as ContractStatus} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => handlePreview(contract)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Preview
                          </DropdownMenuItem>
                          {!['approved', 'active'].includes(contract.status) && (
                            <DropdownMenuItem onClick={() => handleEdit(contract)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDuplicateContract(contract)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSendEmail(contract)}>
                            <Send className="mr-2 h-4 w-4" />
                            Send to Client
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShareLink(contract)}>
                            <LinkIcon className="mr-2 h-4 w-4" />
                            Get Share Link
                          </DropdownMenuItem>
                          {!['approved', 'active'].includes(contract.status) && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(contract)}
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

                  {/* Client */}
                  <div className="min-w-0 flex items-baseline gap-2 lg:block">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground lg:hidden shrink-0">Client</span>
                    <Link
                      to={`/clients/${contract.client_id}`}
                      className="truncate text-sm text-muted-foreground hover:text-primary transition-colors block min-w-0"
                    >
                      {getClientName(contract.client_id)}
                    </Link>
                  </div>

                  {/* Project */}
                  <div className="min-w-0 flex items-baseline gap-2 lg:block">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground lg:hidden shrink-0">Project</span>
                    <p className="truncate text-sm text-muted-foreground min-w-0">
                      {getProjectName(contract.project_id)}
                    </p>
                  </div>

                  {/* Value */}
                  <div className="min-w-0 flex items-baseline gap-2 lg:block">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground lg:hidden shrink-0">Value</span>
                    <span className="font-semibold text-sm text-foreground">
                      ₹{Number(contract.value).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Duration */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm flex-wrap">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground lg:hidden shrink-0">Duration</span>
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground hidden lg:block" />
                      <span className={`truncate ${isExpiringSoon ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {format(startDate, "MMM dd")} – {format(endDate, "MMM dd, yyyy")}
                      </span>
                    </div>
                    {isExpiringSoon && (
                      <p className="mt-0.5 text-xs font-medium text-destructive">Expires in {daysUntilEnd} days</p>
                    )}
                  </div>

                  {/* Status (desktop) */}
                  <div className="hidden lg:block">
                    <StatusBadge status={contract.status as ContractStatus} />
                  </div>

                  {/* Actions (desktop) */}
                  <div className="hidden lg:flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem onClick={() => handlePreview(contract)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </DropdownMenuItem>
                        {!['approved', 'active'].includes(contract.status) && (
                          <DropdownMenuItem onClick={() => handleEdit(contract)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDuplicateContract(contract)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendEmail(contract)}>
                          <Send className="mr-2 h-4 w-4" />
                          Send to Client
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShareLink(contract)}>
                          <LinkIcon className="mr-2 h-4 w-4" />
                          Get Share Link
                        </DropdownMenuItem>
                        {!['approved', 'active'].includes(contract.status) && (
                          <DropdownMenuItem
                            onClick={() => handleDelete(contract)}
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
              );
            })}
          </div>
        </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredContracts.map((contract) => {
              const endDate = new Date(contract.end_date);
              const startDate = new Date(contract.start_date);
              const daysUntilEnd = differenceInDays(endDate, new Date());
              const isExpiringSoon = daysUntilEnd > 0 && daysUntilEnd <= 30;
              return (
                <Card key={contract.id} className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Link to={`/contracts/${contract.id}`} className="block">
                          <h3 className="truncate font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                            {contractTypeLabels[contract.contract_type] || contract.contract_type}
                            {contract.is_external && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                <FileText className="h-3 w-3 mr-1" />
                                File
                              </Badge>
                            )}
                          </h3>
                        </Link>
                        <Link
                          to={`/clients/${contract.client_id}`}
                          className="mt-1 block truncate text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          {getClientName(contract.client_id)}
                        </Link>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => handlePreview(contract)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Preview
                          </DropdownMenuItem>
                          {!['approved', 'active'].includes(contract.status) && (
                            <DropdownMenuItem onClick={() => handleEdit(contract)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDuplicateContract(contract)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSendEmail(contract)}>
                            <Send className="mr-2 h-4 w-4" />
                            Send to Client
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShareLink(contract)}>
                            <LinkIcon className="mr-2 h-4 w-4" />
                            Get Share Link
                          </DropdownMenuItem>
                          {!['approved', 'active'].includes(contract.status) && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(contract)}
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
                      <StatusBadge status={contract.status as ContractStatus} />
                      <Badge variant="outline" className="text-xs">
                        {renewalLabels[contract.renewal_frequency] || contract.renewal_frequency}
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Value</span>
                        <span className="font-semibold text-foreground">₹{Number(contract.value).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className={`truncate ${isExpiringSoon ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          {format(startDate, "MMM dd")} – {format(endDate, "MMM dd, yyyy")}
                        </span>
                      </div>
                      {isExpiringSoon && (
                        <p className="text-xs font-medium text-destructive">Expires in {daysUntilEnd} days</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <EmptyState
          icon={FileSignature}
          title="No contracts found"
          description={
            searchQuery || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Create your first contract to get started"
          }
          actionLabel={!searchQuery && statusFilter === "all" ? "New Contract" : undefined}
          onAction={() => setIsDialogOpen(true)}
        />
      )}

      {/* Create Dialog */}
      <ContractFormDialog
        key="create"
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setDuplicateInitialData(undefined);
        }}
        onSubmit={(data) => createContractMutation.mutate(data)}
        initialData={duplicateInitialData}
        clients={clients}
        projects={projects}
        templates={templates}
        isSubmitting={createContractMutation.isPending}
        mode="create"
      />

      {/* Edit Dialog */}
      <ContractFormDialog
        key={`edit-${editFormKey}`}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={(data) => {
          if (!selectedContract) return;
          updateContractMutation.mutate({ id: selectedContract.id, ...data });
        }}
        initialData={getEditInitialData()}
        clients={clients}
        projects={projects}
        templates={templates}
        isSubmitting={updateContractMutation.isPending}
        mode="edit"
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contract? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedContract && deleteContractMutation.mutate(selectedContract.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteContractMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Email Confirmation Dialog */}
      <AlertDialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Contract</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {selectedContract && (
                  <>
                    <p>
                      Send contract to{' '}
                      <strong>{getClientEmail(selectedContract.client_id)}</strong>?
                    </p>
                    {selectedContract.status === 'draft' && (
                      <p className="text-muted-foreground">
                        The contract status will be updated to "Sent".
                      </p>
                    )}

                    {/* CC Contacts */}
                    {(() => {
                      const clientEmail = getClientEmail(selectedContract.client_id);
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
                  </>
                )}
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

      {/* Share Link Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Contract Link</DialogTitle>
            <DialogDescription>
              Share this link with your client so they can view the contract.
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
                    <Input value={sharePassword} readOnly className="flex-1 font-mono tracking-widest text-lg" />
                    <Button onClick={() => { navigator.clipboard.writeText(sharePassword); toast.success('Password copied!'); }} variant="secondary">
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
              onClick={() => { setRegenerateContext('share'); setIsRegenerateConfirmOpen(true); }}
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
              This will invalidate the existing link and password. Any client who already has the previous link will no longer be able to access the contract until you share the new one.
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
