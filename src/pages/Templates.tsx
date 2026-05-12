import { useState } from 'react';
import { Plus, FileCode, MoreHorizontal, Copy, Pencil, Trash2, Eye, Globe, User } from 'lucide-react';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ViewToggle } from '@/components/ui/view-toggle';
import { useViewMode } from '@/hooks/useViewMode';
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
  const [viewMode, setViewMode] = useViewMode('templates', 'grid');
  const { workspaceUserId } = useWorkspaceUser();

  const { 
    templates, 
    isLoading, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate, 
    duplicateTemplate 
  } = useTemplates();

  const isOwn = (template: Template) => template.user_id === workspaceUserId;

  const templateTypeLabels: Record<TemplateType, string> = {
    'proposal': 'Proposal',
    'contract': 'Contract',
  };

  const templateTypeColors: Record<TemplateType, string> = {
    'proposal': 'bg-primary/10 text-primary',
    'contract': 'bg-secondary text-secondary-foreground',
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

      {templates.length > 0 && (
        <div className="flex justify-end">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      )}

      {templates.length > 0 ? (
        viewMode === 'grid' ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <Card key={template.id} className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base leading-snug">{template.name}</CardTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${templateTypeColors[template.type]}`}
                      >
                        {templateTypeLabels[template.type]}
                      </Badge>
                      {template.is_public && (
                        <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1">
                          <Globe className="h-3 w-3" />
                          Public
                        </Badge>
                      )}
                      {!isOwn(template) && (
                        <Badge variant="outline" className="text-xs">Shared</Badge>
                      )}
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
                      {isOwn(template) && (
                        <DropdownMenuItem onClick={() => handleEdit(template)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      {isOwn(template) && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeletingTemplate(template)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                {template.creator_name && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    By {template.creator_name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Created {format(new Date(template.created_at), 'MMM dd, yyyy')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(template => (
                  <TableRow key={template.id} className="group">
                    <TableCell>
                      <button
                        onClick={() => setPreviewingTemplate(template)}
                        className="font-medium text-foreground hover:text-primary transition-colors text-left"
                      >
                        {template.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${templateTypeColors[template.type]}`}>
                        {templateTypeLabels[template.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(template.created_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
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
