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
} from '@/components/ui/dialog';
import { TemplateFormDialog } from '@/components/templates/TemplateFormDialog';
import { mockTemplates } from '@/lib/mock-data';
import { TemplateType } from '@/lib/types';
import { toast } from 'sonner';

export default function Templates() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof mockTemplates[0] | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<typeof mockTemplates[0] | null>(null);

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

  const handleDuplicate = (template: typeof mockTemplates[0]) => {
    toast.success(`Template "${template.name}" duplicated!`);
  };

  const handleEdit = (template: typeof mockTemplates[0]) => {
    setSelectedTemplate(null);
    setEditingTemplate(template);
  };

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Templates"
        description="Manage document templates for proposals, contracts, and AMCs"
        actions={
          <Button size="lg" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        }
      />

      <TemplateFormDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
      />

      <TemplateFormDialog 
        open={!!editingTemplate} 
        onOpenChange={(open) => !open && setEditingTemplate(null)}
        template={editingTemplate}
      />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {mockTemplates.map(template => (
          <Card key={template.id} className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                    <FileCode className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <Badge 
                      variant="secondary" 
                      className={`mt-1.5 text-xs ${templateTypeColors[template.type]}`}
                    >
                      {templateTypeLabels[template.type]}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(template)}>
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
              <div className="rounded-xl bg-muted/50 p-4">
                <pre className="line-clamp-4 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                  {template.content}
                </pre>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
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
          <div className="rounded-xl bg-muted/50 p-6">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {selectedTemplate?.content}
            </pre>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Close
            </Button>
            <Button onClick={() => selectedTemplate && handleEdit(selectedTemplate)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
