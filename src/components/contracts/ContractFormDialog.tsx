import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScopeOfWorkEditor } from '@/components/proposals/ScopeOfWorkEditor';
import { CostBreakdownTable } from '@/components/proposals/CostBreakdownTable';
import { FileText, DollarSign, Settings, LayoutTemplate } from 'lucide-react';
import { Template } from '@/hooks/useTemplates';

interface ContractFormData {
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
}

interface Client {
  id: string;
  client_name: string;
}

interface Project {
  id: string;
  project_name: string;
  client_id: string;
}

interface ContractFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ContractFormData & { templateId?: string }) => void;
  initialData?: ContractFormData;
  clients: Client[];
  projects: Project[];
  templates?: Template[];
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
}

const emptyFormData: ContractFormData = {
  client_id: '',
  project_id: '',
  contract_type: '',
  start_date: '',
  end_date: '',
  renewal_frequency: '',
  status: 'draft',
  scope_of_work: '',
  cost_breakdown: '',
};

export function ContractFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  clients,
  projects,
  templates = [],
  isSubmitting = false,
  mode = 'create',
}: ContractFormDialogProps) {
  const [formData, setFormData] = useState<ContractFormData>(initialData || emptyFormData);
  const [activeTab, setActiveTab] = useState('details');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const contractTemplates = templates.filter(t => t.type === 'contract');

  useEffect(() => {
    if (open) {
      setFormData(initialData || emptyFormData);
      setActiveTab('details');
      setSelectedTemplateId(initialData?.template_id || '');
    }
  }, [open, initialData]);

  const filteredProjects = projects.filter(p => p.client_id === formData.client_id);

  // Auto-calculate end date from start date + renewal frequency
  useEffect(() => {
    if (formData.start_date && formData.renewal_frequency) {
      const start = new Date(formData.start_date);
      const frequencyMap: Record<string, { months: number }> = {
        '1-month': { months: 1 },
        '3-months': { months: 3 },
        '6-months': { months: 6 },
        '1-year': { months: 12 },
        '3-years': { months: 36 },
      };
      const freq = frequencyMap[formData.renewal_frequency];
      if (freq) {
        const end = new Date(start);
        end.setMonth(end.getMonth() + freq.months);
        const endStr = end.toISOString().split('T')[0];
        if (endStr !== formData.end_date) {
          setFormData(prev => ({ ...prev, end_date: endStr }));
        }
      }
    }
  }, [formData.start_date, formData.renewal_frequency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, template_id: selectedTemplateId || undefined });
  };

  const isValid = formData.client_id && formData.contract_type && formData.start_date && formData.end_date && formData.renewal_frequency;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create New Contract' : 'Edit Contract'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a new contract with scope of work and pricing details.'
              : 'Update contract details, scope, and pricing.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="details" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Details</span>
              </TabsTrigger>
              <TabsTrigger value="scope" className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Scope of Work</span>
              </TabsTrigger>
              <TabsTrigger value="pricing" className="gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Pricing</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-1">
              <TabsContent value="details" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Client *</Label>
                    <Select
                      value={formData.client_id}
                      onValueChange={(value) => setFormData({ ...formData, client_id: value, project_id: '' })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.client_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Project (Optional)</Label>
                    <Select
                      value={formData.project_id}
                      onValueChange={(value) => setFormData({ ...formData, project_id: value })}
                      disabled={!formData.client_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.project_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contract Type *</Label>
                    <Select
                      value={formData.contract_type}
                      onValueChange={(value) => setFormData({ ...formData, contract_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amc">Annual Maintenance Contract</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="retainer">Retainer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date *</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date *</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Renewal Frequency *</Label>
                    <Select
                      value={formData.renewal_frequency}
                      onValueChange={(value) => setFormData({ ...formData, renewal_frequency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-month">1 Month</SelectItem>
                        <SelectItem value="3-months">3 Months</SelectItem>
                        <SelectItem value="6-months">6 Months</SelectItem>
                        <SelectItem value="1-year">1 Year</SelectItem>
                        <SelectItem value="3-years">3 Years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
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

                {contractTemplates.length > 0 && (
                  <div className="space-y-2">
                    <Label>
                      <span className="flex items-center gap-1.5">
                        <LayoutTemplate className="h-3.5 w-3.5" />
                        Template (Optional)
                      </span>
                    </Label>
                    <Select
                      value={selectedTemplateId}
                      onValueChange={setSelectedTemplateId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template for preview" />
                      </SelectTrigger>
                      <SelectContent>
                        {contractTemplates.map((tmpl) => (
                          <SelectItem key={tmpl.id} value={tmpl.id}>
                            {tmpl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose a template to preview the final contract with your data filled in.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="scope" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>Scope of Work</Label>
                  <p className="text-sm text-muted-foreground">
                    Define deliverables, responsibilities, and terms using nested bullet points. Use Tab to indent items.
                  </p>
                  <ScopeOfWorkEditor
                    content={formData.scope_of_work}
                    onChange={(content) => setFormData({ ...formData, scope_of_work: content })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="pricing" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>Cost Breakdown</Label>
                  <p className="text-sm text-muted-foreground">
                    Add line items with quantity, pricing, and optional discounts.
                  </p>
                  <CostBreakdownTable
                    value={formData.cost_breakdown}
                    onChange={(value) => setFormData({ ...formData, cost_breakdown: value })}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isValid}>
              {isSubmitting
                ? (mode === 'create' ? 'Creating...' : 'Saving...')
                : (mode === 'create' ? 'Create Contract' : 'Save Changes')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
