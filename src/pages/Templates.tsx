import { useState } from 'react';
import { Plus, FileCode, MoreHorizontal, Copy, Pencil, Trash2, Eye, Globe, User } from 'lucide-react';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { format } from 'date-fns';
import { PageHeader } from '@/components/shared/PageHeader';
import { RequirePermission } from '@/components/shared/RequirePermission';
import { EmptyState } from '@/components/shared/EmptyState';
import { NoAccessState } from '@/components/shared/NoAccessState';
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
  const { workspaceUserId, can, loading: permLoading } = useWorkspaceUser();

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
    'contract': 'bg-slate-500/10 text-slate-700 dark:text-slate-400',
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


  if (isLoading || permLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
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

  if (!can('templates', 'read')) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <PageHeader title="Templates" description="Manage document templates for proposals and contracts" />
        <NoAccessState moduleLabel="templates" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Templates"
        description="Manage document templates for proposals and contracts"
        actions={
          <RequirePermission module="templates" action="create">
            <Button size="lg" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </RequirePermission>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity" aria-label="More actions">
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
          <div className="rounded-xl border border-border overflow-hidden min-w-0">
            {/* Grid Header */}
            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.9fr)_48px] items-center gap-4 border-b border-border bg-muted/40 px-6 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visibility</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created By</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</span>
              <span />
            </div>

            {/* Grid Rows */}
            <div className="divide-y divide-border">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="group grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.9fr)_48px] items-start lg:items-center gap-3 lg:gap-4 px-4 sm:px-6 py-4 transition-colors hover:bg-muted/30"
                >
                  {/* Name */}
                  <div className="min-w-0 flex items-start justify-between gap-2 lg:block">
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => setPreviewingTemplate(template)}
                        className="truncate block font-medium text-foreground hover:text-primary transition-colors text-left"
                      >
                        {template.name}
                      </button>
                    </div>
                    {/* Mobile-only inline actions */}
                    <div className="flex items-center gap-1 shrink-0 lg:hidden">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
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
                  </div>

                  {/* Type */}
                  <div className="min-w-0 flex items-baseline gap-2 lg:block">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground lg:hidden shrink-0">Type</span>
                    <Badge variant="secondary" className={`text-xs ${templateTypeColors[template.type]}`}>
                      {templateTypeLabels[template.type]}
                    </Badge>
                  </div>

                  {/* Visibility */}
                  <div className="min-w-0 flex items-baseline gap-2 lg:block">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground lg:hidden shrink-0">Visibility</span>
                    {template.is_public ? (
                      <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1">
                        <Globe className="h-3 w-3" />
                        Public
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Private</span>
                    )}
                  </div>

                  {/* Created By */}
                  <div className="min-w-0 flex items-baseline gap-2 lg:block">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground lg:hidden shrink-0">Created By</span>
                    <span className="truncate block text-sm text-muted-foreground min-w-0">
                      {template.creator_name || '—'}
                    </span>
                  </div>

                  {/* Created */}
                  <div className="min-w-0 flex items-baseline gap-2 lg:block">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground lg:hidden shrink-0">Created</span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(template.created_at), 'MMM dd, yyyy')}
                    </span>
                  </div>

                  {/* Actions (desktop) */}
                  <div className="hidden lg:flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity" aria-label="More actions">
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
                </div>
              ))}
            </div>
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
