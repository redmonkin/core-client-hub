import { useState } from 'react';
import { Plus, FileCode, MoreHorizontal, Copy, Pencil, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { TemplateFormDialog } from '@/components/templates/TemplateFormDialog';
import { TemplatePreviewDialog } from '@/components/templates/TemplatePreviewDialog';
import { useTemplates, Template, TemplateType, CreateTemplateData, UpdateTemplateData } from '@/hooks/useTemplates';

export default function Templates() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);
  const [previewingTemplate, setPreviewingTemplate] = useState<Template | null>(null);

  const { 
    templates, 
    isLoading, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate, 
    duplicateTemplate 
  } = useTemplates();

  const templateTypeLabels: Record<TemplateType, string> = {
    'proposal': 'Proposal',
    'contract': 'Contract',
  };

  const templateTypeColors: Record<TemplateType, string> = {
    'proposal': 'bg-primary/10 text-primary',
    'contract': 'bg-accent text-accent-foreground',
  };

  const handleDuplicate = (template: Template) => {
    duplicateTemplate.mutate(template);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
  };

  const handleDelete = () => {
    if (deletingTemplate) {
      deleteTemplate.mutate(deletingTemplate.id);
      setDeletingTemplate(null);
    }
  };

  const handleCreateSubmit = (data: CreateTemplateData | UpdateTemplateData) => {
    createTemplate.mutate(data as CreateTemplateData, {
      onSuccess: () => setIsDialogOpen(false),
    });
  };

  const handleEditSubmit = (data: CreateTemplateData | UpdateTemplateData) => {
    updateTemplate.mutate(data as UpdateTemplateData, {
      onSuccess: () => setEditingTemplate(null),
    });
  };

  // Strip HTML tags for preview
  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <PageHeader
          title="Templates"
          description="Manage document templates for proposals and contracts"
        />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-11 w-11 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="mt-4 h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Templates"
        description="Manage document templates for proposals and contracts"
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
        onSubmit={handleCreateSubmit}
        isSubmitting={createTemplate.isPending}
      />

      <TemplateFormDialog 
        open={!!editingTemplate} 
        onOpenChange={(open) => !open && setEditingTemplate(null)}
        template={editingTemplate}
        onSubmit={handleEditSubmit}
        isSubmitting={updateTemplate.isPending}
      />

      <TemplatePreviewDialog
        open={!!previewingTemplate}
        onOpenChange={(open) => !open && setPreviewingTemplate(null)}
        template={previewingTemplate}
        onEdit={(template) => {
          setPreviewingTemplate(null);
          setEditingTemplate(template);
        }}
      />

      <AlertDialog open={!!deletingTemplate} onOpenChange={(open) => !open && setDeletingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTemplate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {templates.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
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
                      <DropdownMenuItem onClick={() => setPreviewingTemplate(template)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(template)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => setDeletingTemplate(template)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="line-clamp-4 text-sm text-muted-foreground">
                    {stripHtml(template.content) || 'No content'}
                  </p>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Created {format(new Date(template.created_at), 'MMM dd, yyyy')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileCode}
          title="No templates yet"
          description="Create reusable templates for proposals and contracts"
          actionLabel="New Template"
          onAction={() => setIsDialogOpen(true)}
        />
      )}
    </div>
  );
}
