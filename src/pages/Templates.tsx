import { useState } from 'react';
import { Plus, FileCode, MoreHorizontal, Copy, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockTemplates } from '@/lib/mock-data';
import { TemplateType } from '@/lib/types';
import { toast } from 'sonner';

export default function Templates() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof mockTemplates[0] | null>(null);

  const templateTypeLabels: Record<TemplateType, string> = {
    'proposal': 'Proposal',
    'contract': 'Contract',
    'amc': 'AMC',
  };

  const templateTypeColors: Record<TemplateType, string> = {
    'proposal': 'bg-primary/10 text-primary',
    'contract': 'bg-accent text-accent-foreground',
    'amc': 'bg-secondary/10 text-secondary-foreground',
  };

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Template created successfully!');
    setIsDialogOpen(false);
  };

  const handleDuplicate = (template: typeof mockTemplates[0]) => {
    toast.success(`Template "${template.name}" duplicated!`);
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Templates"
        description="Manage document templates for proposals, contracts, and AMCs"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Template</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTemplate} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="templateName">Template Name</Label>
                    <Input id="templateName" placeholder="Enter template name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="templateType">Template Type</Label>
                    <Select required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="amc">AMC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="templateContent">Template Content</Label>
                  <p className="text-xs text-muted-foreground">
                    Use placeholders like {'{{clientName}}'}, {'{{projectName}}'}, {'{{startDate}}'}, etc.
                  </p>
                  <Textarea 
                    id="templateContent" 
                    placeholder="Enter template content with placeholders..."
                    rows={15}
                    className="font-mono text-sm"
                    required 
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Template</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockTemplates.map(template => (
          <Card key={template.id} className="transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileCode className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <Badge 
                      variant="secondary" 
                      className={`mt-1 text-xs ${templateTypeColors[template.type]}`}
                    >
                      {templateTypeLabels[template.type]}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSelectedTemplate(template)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted/50 p-3">
                <pre className="line-clamp-4 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                  {template.content}
                </pre>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Created {format(template.createdAt, 'MMM dd, yyyy')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {mockTemplates.length === 0 && (
        <EmptyState
          icon={FileCode}
          title="No templates yet"
          description="Create reusable templates for proposals, contracts, and AMCs"
          actionLabel="New Template"
          onAction={() => setIsDialogOpen(true)}
        />
      )}

      {/* Template Preview Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {selectedTemplate?.content}
            </pre>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Close
            </Button>
            <Button>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
