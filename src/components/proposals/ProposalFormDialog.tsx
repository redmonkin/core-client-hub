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
import { ScopeOfWorkEditor } from './ScopeOfWorkEditor';
import { CostBreakdownTable } from './CostBreakdownTable';
import { FileText, IndianRupee, Settings, LayoutTemplate } from 'lucide-react';
import { Template } from '@/hooks/useTemplates';

type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'change_requested';

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

interface Client {
  id: string;
  client_name: string;
  email: string | null;
}

interface Project {
  id: string;
  project_name: string;
  client_id: string;
}

interface ProposalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProposalFormData & { templateId?: string }) => void;
  initialData?: ProposalFormData;
  initialTemplateId?: string;
  clients: Client[];
  projects: Project[];
  templates?: Template[];
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
}

const emptyFormData: ProposalFormData = {
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

export function ProposalFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  initialTemplateId = '',
  clients,
  projects,
  templates = [],
  isSubmitting = false,
  mode = 'create',
}: ProposalFormDialogProps) {
  const [formData, setFormData] = useState<ProposalFormData>(initialData || emptyFormData);
  const [activeTab, setActiveTab] = useState('details');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId);

  const proposalTemplates = templates.filter(t => t.type === 'proposal');

  useEffect(() => {
    if (open) {
      setFormData(initialData || emptyFormData);
      setActiveTab('details');
      setSelectedTemplateId(initialTemplateId || '');
    }
  }, [open, initialData, initialTemplateId]);

  const filteredProjects = projects.filter(p => p.client_id === formData.clientId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, templateId: selectedTemplateId || undefined });
  };

  const isValid = formData.title.trim() && formData.clientId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create New Proposal' : 'Edit Proposal'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Create a professional proposal with detailed scope and pricing.'
              : 'Update proposal details, scope, and pricing.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="details" className="gap-2">
                <Settings className="hidden h-4 w-4 sm:block" />
                <span>Details</span>
              </TabsTrigger>
              <TabsTrigger value="scope" className="gap-2">
                <FileText className="hidden h-4 w-4 sm:block" />
                <span className="sm:hidden">Scope</span><span className="hidden sm:inline">Scope of Work</span>
              </TabsTrigger>
              <TabsTrigger value="pricing" className="gap-2">
                <IndianRupee className="hidden h-4 w-4 sm:block" />
                <span>Pricing</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-1">
              <TabsContent value="details" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Proposal Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Website Redesign Proposal for Acme Corp"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client">Client *</Label>
                    <Select
                      value={formData.clientId}
                      onValueChange={(value) => setFormData({ ...formData, clientId: value, projectId: '' })}
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
                    <Label htmlFor="project">Project (Optional)</Label>
                    <Select
                      value={formData.projectId}
                      onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                      disabled={!formData.clientId}
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

                {proposalTemplates.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="template">
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
                        {proposalTemplates.map((tmpl) => (
                          <SelectItem key={tmpl.id} value={tmpl.id}>
                            {tmpl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose a template to preview the final proposal with your data filled in.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="validityDate">Valid Until</Label>
                    <Input
                      id="validityDate"
                      type="date"
                      value={formData.validityDate}
                      onChange={(e) => setFormData({ ...formData, validityDate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Project Duration</Label>
                    <Input
                      id="duration"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      placeholder="e.g., 3 months"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value as ProposalStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="change_requested">Change Requested</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="scope" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>Customer Goals</Label>
                  <p className="text-sm text-muted-foreground">
                    Describe the client's objectives and desired outcomes for this project.
                  </p>
                  <ScopeOfWorkEditor
                    content={formData.customerGoals}
                    onChange={(content) => setFormData({ ...formData, customerGoals: content })}
                    placeholder="e.g., Increase online conversions by 30%, improve mobile experience..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Scope of Work</Label>
                  <p className="text-sm text-muted-foreground">
                    Define deliverables using nested bullet points. Use Tab to indent items.
                  </p>
                  <ScopeOfWorkEditor
                    content={formData.scopeOfWork}
                    onChange={(content) => setFormData({ ...formData, scopeOfWork: content })}
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
                    value={formData.costBreakdown}
                    onChange={(value) => setFormData({ ...formData, costBreakdown: value })}
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
                : (mode === 'create' ? 'Create Proposal' : 'Save Changes')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
