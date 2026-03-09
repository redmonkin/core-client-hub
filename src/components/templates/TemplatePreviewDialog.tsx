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

// Sample cost breakdown for preview
const sampleCostBreakdownHtml = `
<table style="width:100%; border-collapse:collapse; margin:1em 0;">
  <thead>
    <tr style="background:hsl(var(--muted)); border-bottom:2px solid hsl(var(--border));">
      <th style="padding:8px 12px; text-align:left;">Description</th>
      <th style="padding:8px 12px; text-align:right;">Qty</th>
      <th style="padding:8px 12px; text-align:right;">Unit Price</th>
      <th style="padding:8px 12px; text-align:right;">Disc %</th>
      <th style="padding:8px 12px; text-align:right;">Total</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid hsl(var(--border));">
      <td style="padding:8px 12px;">UI/UX Design</td>
      <td style="padding:8px 12px; text-align:right;">1</td>
      <td style="padding:8px 12px; text-align:right;">₹8,000</td>
      <td style="padding:8px 12px; text-align:right;">0%</td>
      <td style="padding:8px 12px; text-align:right;">₹8,000</td>
    </tr>
    <tr style="border-bottom:1px solid hsl(var(--border));">
      <td style="padding:8px 12px;">Frontend Development</td>
      <td style="padding:8px 12px; text-align:right;">1</td>
      <td style="padding:8px 12px; text-align:right;">₹12,000</td>
      <td style="padding:8px 12px; text-align:right;">0%</td>
      <td style="padding:8px 12px; text-align:right;">₹12,000</td>
    </tr>
    <tr style="border-bottom:1px solid hsl(var(--border));">
      <td style="padding:8px 12px;">CMS Integration</td>
      <td style="padding:8px 12px; text-align:right;">1</td>
      <td style="padding:8px 12px; text-align:right;">₹5,000</td>
      <td style="padding:8px 12px; text-align:right;">10%</td>
      <td style="padding:8px 12px; text-align:right;">₹4,500</td>
    </tr>
  </tbody>
  <tfoot>
    <tr style="border-top:2px solid hsl(var(--border));">
      <td colspan="4" style="padding:8px 12px; text-align:right; font-weight:600;">Subtotal</td>
      <td style="padding:8px 12px; text-align:right;">₹24,500</td>
    </tr>
    <tr>
      <td colspan="4" style="padding:8px 12px; text-align:right; font-weight:600;">Tax (18%)</td>
      <td style="padding:8px 12px; text-align:right;">₹4,410</td>
    </tr>
    <tr style="border-top:2px solid hsl(var(--border)); font-size:1.1em;">
      <td colspan="4" style="padding:8px 12px; text-align:right; font-weight:700;">Total</td>
      <td style="padding:8px 12px; text-align:right; font-weight:700;">₹28,910</td>
    </tr>
  </tfoot>
</table>`;

// Sample data for proposal placeholders
const proposalSampleData: Record<string, string> = {
  '{{proposalTitle}}': 'Website Redesign Proposal',
  '{{clientName}}': 'Acme Corporation',
  '{{companyName}}': 'Acme Corporation Ltd.',
  '{{contactName}}': 'John Smith',
  '{{designation}}': 'Chief Technology Officer',
  '{{emailAddress}}': 'john.smith@acmecorp.com',
  '{{phoneNumber}}': '+1 (555) 123-4567',
  '{{companyAddress}}': '123 Business Ave, Suite 100, New York, NY 10001',
  '{{projectName}}': 'Website Redesign Project',
  '{{proposalDate}}': 'February 1, 2026',
  '{{proposalExpiryDate}}': 'March 1, 2026',
  '{{scopeOfWork}}': 'Complete website redesign including UI/UX improvements, mobile optimization, and CMS integration',
  '{{customerGoals}}': 'Increase online conversions by 30%, improve mobile user experience, and modernize brand presence',
  '{{duration}}': '3 months',
  '{{costing}}': sampleCostBreakdownHtml,
  '{{totalAmount}}': '₹28,910',
};

// Sample data for contract placeholders
const contractSampleData: Record<string, string> = {
  '{{name}}': 'John Smith',
  '{{designation}}': 'Chief Technology Officer',
  '{{emailAddress}}': 'john.smith@acmecorp.com',
  '{{phoneNumber}}': '+1 (555) 123-4567',
  '{{companyName}}': 'Acme Corporation',
  '{{companyAddress}}': '123 Business Ave, Suite 100, New York, NY 10001',
  '{{projectName}}': 'Website Redesign Project',
  '{{projectWebsite}}': 'www.acmecorp.com',
  '{{startDate}}': 'February 15, 2026',
  '{{endDate}}': 'February 15, 2027',
};

const sampleDataByType: Record<TemplateType, Record<string, string>> = {
  proposal: proposalSampleData,
  contract: contractSampleData,
};

const templateTypeLabels: Record<TemplateType, string> = {
  'proposal': 'Proposal',
  'contract': 'Contract',
};

const templateTypeColors: Record<TemplateType, string> = {
  'proposal': 'bg-primary/10 text-primary',
  'contract': 'bg-accent text-accent-foreground',
};

// Placeholders that contain raw HTML and should not be wrapped in a highlight span
const HTML_PLACEHOLDERS = new Set(['{{costing}}']);

function replacePlaceholders(content: string, templateType: TemplateType): string {
  let result = content;
  const sampleData = sampleDataByType[templateType];
  
  for (const [placeholder, value] of Object.entries(sampleData)) {
    const escapedPlaceholder = placeholder.replace(/[{}]/g, '\\$&');
    if (HTML_PLACEHOLDERS.has(placeholder)) {
      // Insert HTML directly (e.g., pricing table)
      result = result.replace(new RegExp(escapedPlaceholder, 'g'), value);
    } else {
      result = result.replace(new RegExp(escapedPlaceholder, 'g'), `<span class="bg-primary/20 text-primary px-1 rounded font-medium">${value}</span>`);
    }
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

  const previewContent = replacePlaceholders(template.content, template.type);
  const sampleData = sampleDataByType[template.type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-full h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
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
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Legend */}
        <div className="flex-shrink-0 mx-6 mt-4 rounded-lg bg-muted/50 p-3 text-sm">
          <p className="text-muted-foreground">
            <span className="bg-primary/20 text-primary px-1 rounded font-medium">Highlighted text</span>
            {' '}shows where placeholders will be replaced with actual data.
          </p>
        </div>

        {/* Preview Content - scrollable */}
        <div className="flex-1 overflow-y-auto mx-6 my-4 rounded-lg border bg-card p-8">
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
        <div className="flex-shrink-0 px-6 py-4 border-t bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground mb-2">Sample Data Used:</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            {Object.entries(sampleData).map(([placeholder, value]) => (
              <div key={placeholder} className="flex items-center gap-1.5">
                <code className="bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  {placeholder}
                </code>
                <span className="text-muted-foreground">→</span>
                <span className="text-foreground truncate max-w-40">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
