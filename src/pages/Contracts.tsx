import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, FileSignature, MoreHorizontal, Calendar, Loader2, Pencil, Trash2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useTemplates } from "@/hooks/useTemplates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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

  const { user } = useAuth();
  const { toast } = useToast();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setIsDialogOpen(false);
      toast({ title: "Contract created successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to create contract", description: error.message, variant: "destructive" });
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
          value: parseFloat(contractData.value),
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
      toast({ title: "Contract updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to update contract", description: error.message, variant: "destructive" });
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
      toast({ title: "Contract deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to delete contract", description: error.message, variant: "destructive" });
    },
  });

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.client_name || "Unknown Client";
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

  const contractTypeLabels: Record<string, string> = {
    amc: "AMC",
    fixed: "Fixed",
    retainer: "Retainer",
  };

  const renewalLabels: Record<string, string> = {
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
      value: String(selectedContract.value),
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
          <Button size="lg" onClick={() => setIsDialogOpen(true)}>
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
              {filteredContracts.map((contract) => {
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
                        <p className="text-sm text-muted-foreground">{getProjectName(contract.project_id)}</p>
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
                        <span className={isExpiringSoon ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {format(startDate, "MMM dd")} - {format(endDate, "MMM dd, yyyy")}
                        </span>
                      </div>
                      {isExpiringSoon && (
                        <p className="mt-1 text-xs font-medium text-destructive">Expires in {daysUntilEnd} days</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {renewalLabels[contract.renewal_frequency] || contract.renewal_frequency}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={contract.status as "active" | "expired" | "pending-renewal"} />
                    </TableCell>
                    <TableCell>
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
                          <DropdownMenuItem onClick={() => handleEdit(contract)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
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
        onOpenChange={setIsDialogOpen}
        onSubmit={(data) => createContractMutation.mutate(data)}
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
    </div>
  );
}
