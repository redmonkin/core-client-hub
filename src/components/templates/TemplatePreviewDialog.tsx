import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Template, TemplateType } from '@/hooks/useTemplates';
import { Eye, Pencil, X } from 'lucide-react';

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  onEdit?: (template: Template) => void;
}

// Sample data for placeholder replacement
const sampleData: Record<string, string> = {
  '{{clientName}}': 'Acme Corporation',
  '{{clientEmail}}': 'contact@acmecorp.com',
  '{{clientPhone}}': '+1 (555) 123-4567',
  '{{clientAddress}}': '123 Business Ave, Suite 100, New York, NY 10001',
  '{{projectName}}': 'Website Redesign Project',
  '{{projectType}}': 'Web Development',
  '{{projectStartDate}}': 'February 15, 2026',
  '{{projectEndDate}}': 'May 30, 2026',
  '{{proposalTitle}}': 'Website Redesign Proposal',
  '{{proposalDate}}': 'February 1, 2026',
  '{{validityDate}}': 'March 1, 2026',
  '{{totalAmount}}': '$24,500.00',
  '{{yourCompanyName}}': 'Your Company Inc.',
};

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

function replacePlaceholders(content: string): string {
  let result = content;
  for (const [placeholder, value] of Object.entries(sampleData)) {
    // Replace all occurrences, escaping special regex characters
    const escapedPlaceholder = placeholder.replace(/[{}]/g, '\\$&');
    result = result.replace(new RegExp(escapedPlaceholder, 'g'), `<span class="bg-primary/20 text-primary px-1 rounded font-medium">${value}</span>`);
  }
  return result;
}

export function TemplatePreviewDialog({ 
  open, 
  onOpenChange, 
  template, 
  onEdit 
}: TemplatePreviewDialogProps) {
  if (!template) return null;

  const previewContent = replacePlaceholders(template.content);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-primary" />
              <div>
                <DialogTitle>{template.name}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  Preview with sample data
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${templateTypeColors[template.type]}`}
                  >
                    {templateTypeLabels[template.type]}
                  </Badge>
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Legend */}
        <div className="flex-shrink-0 rounded-lg bg-muted/50 p-3 text-sm">
          <p className="text-muted-foreground">
            <span className="bg-primary/20 text-primary px-1 rounded font-medium">Highlighted text</span>
            {' '}shows where placeholders will be replaced with actual data.
          </p>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto rounded-lg border bg-card p-6">
          <div 
            className="prose prose-sm max-w-none dark:prose-invert
              prose-headings:text-foreground 
              prose-p:text-foreground 
              prose-strong:text-foreground
              prose-li:text-foreground"
            dangerouslySetInnerHTML={{ __html: previewContent }}
          />
        </div>

        {/* Sample Data Reference */}
        <div className="flex-shrink-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Sample Data Used:</p>
          <div className="grid gap-1 text-xs max-h-32 overflow-y-auto">
            {Object.entries(sampleData).slice(0, 6).map(([placeholder, value]) => (
              <div key={placeholder} className="flex items-center gap-2">
                <code className="bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  {placeholder}
                </code>
                <span className="text-muted-foreground">→</span>
                <span className="text-foreground">{value}</span>
              </div>
            ))}
            {Object.keys(sampleData).length > 6 && (
              <p className="text-muted-foreground">+ {Object.keys(sampleData).length - 6} more...</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex justify-end gap-3 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
          {onEdit && (
            <Button onClick={() => {
              onOpenChange(false);
              onEdit(template);
            }}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Template
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
