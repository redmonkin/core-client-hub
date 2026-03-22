import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, FileSignature, MoreHorizontal, Calendar, Loader2, Pencil, Trash2, Eye, Copy, Send, LinkIcon, Users } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { ContractStatus } from "@/lib/types";

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

export default function Contracts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "all">("all");
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
  const [sharePassword, setSharePassword] = useState("");
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  const { user } = useAuth();
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
          user_id: user.id,
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
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setIsDialogOpen(false);
      uiToast({ title: "Contract created successfully" });

      const client = clients.find(c => c.id === variables.client_id);
      if (client?.email) {
        supabase.functions.invoke('send-notification-email', {
          body: {
            type: 'contract_created',
            recipientEmail: client.email,
            recipientName: client.primary_contact_name || client.client_name,
            data: {
              contractType: variables.contract_type,
              startDate: variables.start_date,
              endDate: variables.end_date,
              value: computeValueFromCostBreakdown(variables.cost_breakdown),
              renewalFrequency: variables.renewal_frequency,
              scopeOfWork: variables.scope_of_work,
              senderName: user?.user_metadata?.full_name || 'Your Team',
            },
          },
        }).then(res => {
          if (res.error) console.error('Failed to send contract email:', res.error);
        });
      }
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
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setIsEditDialogOpen(false);
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
      title: `${contractTypeLabels[contract.contract_type] || contract.contract_type} Contract`,
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
    setPreviewData(buildContractPreviewData(contract));
    setPreviewTemplate(contractTemplates[0]);
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
      const { data: brandingData } = await supabase
        .from('branding_settings')
        .select('support_email')
        .eq('user_id', user?.id)
        .maybeSingle();

      const { error } = await supabase.functions.invoke('send-notification-email', {
        body: {
          type: 'contract_sent',
          recipientEmail: clientEmail,
          recipientName: clientName,
          data: {
            contractType: selectedContract.contract_type,
            startDate: selectedContract.start_date,
            endDate: selectedContract.end_date,
            value: selectedContract.value,
            renewalFrequency: selectedContract.renewal_frequency,
            senderName: user?.user_metadata?.full_name || 'Your Team',
            supportEmail: brandingData?.support_email || null,
          },
          ccEmails: selectedCcEmails.length > 0 ? selectedCcEmails : undefined,
        },
      });

      if (error) throw error;

      // Update status to 'sent' if currently draft
      if (selectedContract.status === 'draft') {
        await supabase
          .from('contracts')
          .update({ status: 'sent' })
          .eq('id', selectedContract.id);
        queryClient.invalidateQueries({ queryKey: ['contracts'] });
      }

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
    setSharePassword('');
    setIsShareDialogOpen(true);
    setIsGeneratingLink(true);

    try {
      const tokenArray = new Uint8Array(32);
      crypto.getRandomValues(tokenArray);
      const token = Array.from(tokenArray, b => b.toString(16).padStart(2, '0')).join('');

      const passArray = new Uint8Array(4);
      crypto.getRandomValues(passArray);
      const password = Array.from(passArray, b => b.toString(36).padStart(2, '0')).join('').substring(0, 6).toUpperCase();

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
      const passwordHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error } = await supabase.from('contract_access_tokens').insert({
        contract_id: contract.id,
        token,
        expires_at: expiresAt.toISOString(),
        password_hash: passwordHash,
      } as any);

      if (error) throw error;

      const link = `${window.location.origin}/portal?token=${token}`;
      setShareLink(link);
      setSharePassword(password);
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

  const contractTypeLabels: Record<string, string> = {
    amc: "Annual Maintenance Contract",
    fixed: "Fixed",
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
    <div className="space-y-6 p-8">
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
      </div>

      {filteredContracts.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Grid Header */}
          <div className="hidden md:grid md:grid-cols-[1fr_140px_140px_100px_200px_120px_48px] items-center gap-4 border-b border-border bg-muted/40 px-6 py-3">
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
                  className="group grid grid-cols-1 md:grid-cols-[1fr_140px_140px_100px_200px_120px_48px] items-center gap-3 md:gap-4 px-6 py-4 transition-colors hover:bg-muted/30"
                >
                  {/* Contract */}
                  <div className="min-w-0">
                    <Link to={`/contracts/${contract.id}`}>
                      <h3 className="truncate font-medium text-foreground group-hover:text-primary transition-colors cursor-pointer">
                        {contractTypeLabels[contract.contract_type] || contract.contract_type} Contract
                      </h3>
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Renewal: {renewalLabels[contract.renewal_frequency] || contract.renewal_frequency}
                    </p>
                  </div>

                  {/* Client */}
                  <div className="min-w-0">
                    <Link
                      to={`/clients/${contract.client_id}`}
                      className="truncate text-sm text-muted-foreground hover:text-primary transition-colors block"
                    >
                      {getClientName(contract.client_id)}
                    </Link>
                  </div>

                  {/* Project */}
                  <div className="min-w-0">
                    <p className="truncate text-sm text-muted-foreground">
                      {getProjectName(contract.project_id)}
                    </p>
                  </div>

                  {/* Value */}
                  <div className="min-w-0">
                    <span className="font-semibold text-sm text-foreground">
                      ₹{Number(contract.value).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Duration */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground hidden md:block" />
                      <span className={`truncate ${isExpiringSoon ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {format(startDate, "MMM dd")} – {format(endDate, "MMM dd, yyyy")}
                      </span>
                    </div>
                    {isExpiringSoon && (
                      <p className="mt-0.5 text-xs font-medium text-destructive">Expires in {daysUntilEnd} days</p>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <StatusBadge status={contract.status as ContractStatus} />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end">
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
                        <DropdownMenuItem onClick={() => handleEdit(contract)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
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
                        <DropdownMenuItem
                          onClick={() => handleDelete(contract)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
                <div className="flex items-center gap-2">
                  <Input value={sharePassword} readOnly className="flex-1 font-mono tracking-widest text-lg" />
                  <Button onClick={() => { navigator.clipboard.writeText(sharePassword); toast.success('Password copied!'); }} variant="secondary">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Share both the link and password with your client. The link expires in 30 days.
              </p>
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
