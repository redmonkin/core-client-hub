import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TemplateEditor } from './TemplateEditor';
import { Template, TemplateType, CreateTemplateData, UpdateTemplateData } from '@/hooks/useTemplates';

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template | null;
  onSubmit: (data: CreateTemplateData | UpdateTemplateData) => void;
  isSubmitting?: boolean;
}

export function TemplateFormDialog({ 
  open, 
  onOpenChange, 
  template, 
  onSubmit,
  isSubmitting = false 
}: TemplateFormDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<TemplateType | ''>('');
  const [content, setContent] = useState('');

  const isEditing = !!template;

  // Sync state when template prop changes (for edit mode)
  useEffect(() => {
    if (template) {
      setName(template.name);
      setType(template.type);
      setContent(template.content);
    } else {
      setName('');
      setType('');
      setContent('');
    }
  }, [template]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open && !template) {
      setName('');
      setType('');
      setContent('');
    }
  }, [open, template]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !type || !content.trim()) {
      return;
    }

    if (isEditing && template) {
      onSubmit({
        id: template.id,
        name: name.trim(),
        type: type as TemplateType,
        content: content,
      });
    } else {
      onSubmit({
        name: name.trim(),
        type: type as TemplateType,
        content: content,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <DialogTitle>{isEditing ? 'Edit Template' : 'Create New Template'}</DialogTitle>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          {/* Meta fields */}
          <div className="flex-shrink-0 px-6 py-4 border-b bg-muted/30">
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="templateName" className="text-xs">Template Name</Label>
                <Input 
                  id="templateName" 
                  placeholder="Enter template name" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required 
                  className="h-9"
                />
              </div>
              <div className="w-48 space-y-1.5">
                <Label htmlFor="templateType" className="text-xs">Template Type</Label>
                <Select value={type} onValueChange={(value) => setType(value as TemplateType)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Use the toolbar to format text and insert placeholders that will be replaced with actual values.
            </p>
          </div>
          
          {/* Editor - takes remaining space */}
          <div className="flex-1 overflow-hidden p-4">
            <TemplateEditor 
              content={content} 
              onChange={setContent}
              placeholder="Start writing your template content..."
              templateType={type || undefined}
            />
          </div>
          
          {/* Footer */}
          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t bg-muted/30">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim() || !type || !content.trim()}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Template'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
