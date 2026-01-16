import { useState } from 'react';
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
import { TemplateType } from '@/lib/types';
import { toast } from 'sonner';

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: {
    id: string;
    name: string;
    type: TemplateType;
    content: string;
  } | null;
}

export function TemplateFormDialog({ open, onOpenChange, template }: TemplateFormDialogProps) {
  const [name, setName] = useState(template?.name || '');
  const [type, setType] = useState<TemplateType | ''>(template?.type || '');
  const [content, setContent] = useState(template?.content || '');

  const isEditing = !!template;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    
    if (!type) {
      toast.error('Please select a template type');
      return;
    }
    
    if (!content.trim()) {
      toast.error('Please add some content to the template');
      return;
    }

    toast.success(isEditing ? 'Template updated successfully!' : 'Template created successfully!');
    onOpenChange(false);
    
    // Reset form
    setName('');
    setType('');
    setContent('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Template' : 'Create New Template'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name</Label>
              <Input 
                id="templateName" 
                placeholder="Enter template name" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateType">Template Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as TemplateType)}>
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
            <Label>Template Content</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Use the toolbar to format text and insert placeholders that will be replaced with actual values.
            </p>
            <TemplateEditor 
              content={content} 
              onChange={setContent}
              placeholder="Start writing your template content..."
            />
          </div>
          
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? 'Save Changes' : 'Create Template'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
