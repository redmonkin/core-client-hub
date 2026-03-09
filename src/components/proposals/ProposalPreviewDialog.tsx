import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, X } from 'lucide-react';
import { Template } from '@/hooks/useTemplates';
import { CostBreakdownData } from './CostBreakdownTable';
import { format } from 'date-fns';

interface ProposalData {
  title: string;
  clientName: string;
  clientDesignation: string;
  clientEmail: string;
  clientPhone: string;
  companyName: string;
  companyAddress: string;
  projectName: string;
  projectWebsite: string;
  customerGoals: string;
  scopeOfWork: string;
  costBreakdown: string;
  validityDate: string;
  createdAt: string;
}

interface ProposalPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  proposalData: ProposalData;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

function buildCostTableHtml(costBreakdownJson: string): { tableHtml: string; totalAmount: string } {
  try {
    const data: CostBreakdownData = JSON.parse(costBreakdownJson);
    if (!data.items || !Array.isArray(data.items)) {
      return { tableHtml: '', totalAmount: '' };
    }

    const calculateLineTotal = (item: { quantity: number; unitPrice: number; discount: number }) => {
      const subtotal = item.quantity * item.unitPrice;
      return subtotal - subtotal * (item.discount / 100);
    };

    const subtotal = data.items.reduce((acc, item) => acc + calculateLineTotal(item), 0);
    const additionalDiscountAmount = subtotal * ((data.additionalDiscount || 0) / 100);
    const afterDiscount = subtotal - additionalDiscountAmount;
    const taxAmount = afterDiscount * ((data.taxRate || 0) / 100);
    const total = afterDiscount + taxAmount;

    const rows = data.items
      .map(
        (item) => `
      <tr style="border-bottom:1px solid hsl(var(--border));">
        <td style="padding:8px 12px;">${item.description || ''}</td>
        <td style="padding:8px 12px; text-align:right;">${item.quantity}</td>
        <td style="padding:8px 12px; text-align:right;">${formatCurrency(item.unitPrice)}</td>
        <td style="padding:8px 12px; text-align:right;">${item.discount}%</td>
        <td style="padding:8px 12px; text-align:right;">${formatCurrency(calculateLineTotal(item))}</td>
      </tr>`
      )
      .join('');

    let footerRows = `
      <tr style="border-top:2px solid hsl(var(--border));">
        <td colspan="4" style="padding:8px 12px; text-align:right; font-weight:600;">Subtotal</td>
        <td style="padding:8px 12px; text-align:right;">${formatCurrency(subtotal)}</td>
      </tr>`;

    if (data.additionalDiscount && data.additionalDiscount > 0) {
      footerRows += `
      <tr>
        <td colspan="4" style="padding:8px 12px; text-align:right; font-weight:600;">Discount (${data.additionalDiscount}%)</td>
        <td style="padding:8px 12px; text-align:right;">-${formatCurrency(additionalDiscountAmount)}</td>
      </tr>`;
    }

    if (data.taxRate && data.taxRate > 0) {
      footerRows += `
      <tr>
        <td colspan="4" style="padding:8px 12px; text-align:right; font-weight:600;">Tax (${data.taxRate}%)</td>
        <td style="padding:8px 12px; text-align:right;">${formatCurrency(taxAmount)}</td>
      </tr>`;
    }

    footerRows += `
      <tr style="border-top:2px solid hsl(var(--border)); font-size:1.1em;">
        <td colspan="4" style="padding:8px 12px; text-align:right; font-weight:700;">Total</td>
        <td style="padding:8px 12px; text-align:right; font-weight:700;">${formatCurrency(total)}</td>
      </tr>`;

    const tableHtml = `
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
      <tbody>${rows}</tbody>
      <tfoot>${footerRows}</tfoot>
    </table>`;

    return { tableHtml, totalAmount: formatCurrency(total) };
  } catch {
    return { tableHtml: '', totalAmount: '' };
  }
}

// Placeholders that contain raw HTML
const HTML_PLACEHOLDERS = new Set(['{{costing}}', '{{scopeOfWork}}', '{{customerGoals}}']);

function replacePlaceholders(content: string, data: ProposalData): string {
  const { tableHtml, totalAmount } = buildCostTableHtml(data.costBreakdown);

  const proposalDate = data.createdAt
    ? format(new Date(data.createdAt), 'MMMM d, yyyy')
    : '';
  const expiryDate = data.validityDate
    ? format(new Date(data.validityDate), 'MMMM d, yyyy')
    : '';

  const placeholderMap: Record<string, string> = {
    '{{name}}': data.clientName,
    '{{designation}}': data.clientDesignation,
    '{{emailAddress}}': data.clientEmail,
    '{{phoneNumber}}': data.clientPhone,
    '{{companyName}}': data.companyName,
    '{{companyAddress}}': data.companyAddress,
    '{{projectName}}': data.projectName,
    '{{projectWebsite}}': data.projectWebsite,
    '{{proposalTitle}}': data.title,
    '{{proposalDate}}': proposalDate,
    '{{proposalExpiryDate}}': expiryDate,
    '{{customerGoals}}': data.customerGoals || '',
    '{{scopeOfWork}}': data.scopeOfWork || '',
    '{{duration}}': '',
    '{{costing}}': tableHtml,
    '{{totalAmount}}': totalAmount,
  };

  let result = content;
  for (const [placeholder, value] of Object.entries(placeholderMap)) {
    const escaped = placeholder.replace(/[{}]/g, '\\$&');
    if (HTML_PLACEHOLDERS.has(placeholder)) {
      result = result.replace(new RegExp(escaped, 'g'), value);
    } else {
      result = result.replace(
        new RegExp(escaped, 'g'),
        `<span class="bg-primary/20 text-primary px-1 rounded font-medium">${value || '<em>Not provided</em>'}</span>`
      );
    }
  }
  return result;
}

export function ProposalPreviewDialog({
  open,
  onOpenChange,
  template,
  proposalData,
}: ProposalPreviewDialogProps) {
  if (!template) return null;

  const previewContent = replacePlaceholders(template.content, proposalData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-full h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-primary" />
              <div>
                <DialogTitle>{proposalData.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  Preview using template: 
                  <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                    {template.name}
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
            {' '}shows actual data filled from your proposal and client details.
          </p>
        </div>

        {/* Content */}
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

        {/* Actions */}
        <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { ProposalData };
