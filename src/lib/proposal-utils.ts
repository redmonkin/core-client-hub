import { format } from 'date-fns';

export interface ProposalData {
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
  duration: string;
  createdAt: string;
  // Contract-specific fields (optional)
  contractType?: string;
  renewalFrequency?: string;
  startDate?: string;
  endDate?: string;
  approvedDate?: string;
  clientSignature?: string;
  mySignature?: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

interface CostPlanLike {
  id?: string;
  name?: string;
  items: Array<{ description?: string; quantity: number; unitPrice: number; discount: number }>;
  additionalDiscount?: number;
  taxRate?: number;
  notes?: string;
}

const calculateLineTotal = (item: { quantity: number; unitPrice: number; discount: number }) => {
  const subtotal = item.quantity * item.unitPrice;
  return subtotal - subtotal * (item.discount / 100);
};

function buildSinglePlanHtml(plan: CostPlanLike, options: { showHeading: boolean }): { html: string; total: number } {
  const items = plan.items || [];
  const additionalDiscount = plan.additionalDiscount || 0;
  const taxRate = plan.taxRate || 0;

  const subtotal = items.reduce((acc, item) => acc + calculateLineTotal(item), 0);
  const additionalDiscountAmount = subtotal * (additionalDiscount / 100);
  const afterDiscount = subtotal - additionalDiscountAmount;
  const taxAmount = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmount;

  const rows = items
    .map(
      (item) => `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:8px 12px;">${item.description || ''}</td>
      <td style="padding:8px 12px; text-align:right;">${item.quantity}</td>
      <td style="padding:8px 12px; text-align:right;">${formatCurrency(item.unitPrice)}</td>
      <td style="padding:8px 12px; text-align:right;">${item.discount}%</td>
      <td style="padding:8px 12px; text-align:right;">${formatCurrency(calculateLineTotal(item))}</td>
    </tr>`
    )
    .join('');

  let footerRows = `
    <tr style="border-top:2px solid #e5e7eb;">
      <td colspan="4" style="padding:8px 12px; text-align:right; font-weight:600;">Subtotal</td>
      <td style="padding:8px 12px; text-align:right;">${formatCurrency(subtotal)}</td>
    </tr>`;

  if (additionalDiscount > 0) {
    footerRows += `
    <tr>
      <td colspan="4" style="padding:8px 12px; text-align:right; font-weight:600;">Discount (${additionalDiscount}%)</td>
      <td style="padding:8px 12px; text-align:right;">-${formatCurrency(additionalDiscountAmount)}</td>
    </tr>`;
  }

  if (taxRate > 0) {
    footerRows += `
    <tr>
      <td colspan="4" style="padding:8px 12px; text-align:right; font-weight:600;">Tax (${taxRate}%)</td>
      <td style="padding:8px 12px; text-align:right;">${formatCurrency(taxAmount)}</td>
    </tr>`;
  }

  footerRows += `
    <tr style="border-top:2px solid #e5e7eb; font-size:1.1em;">
      <td colspan="4" style="padding:8px 12px; text-align:right; font-weight:700;">Total</td>
      <td style="padding:8px 12px; text-align:right; font-weight:700;">${formatCurrency(total)}</td>
    </tr>`;

  const heading = options.showHeading && plan.name
    ? `<h3 style="margin:1.5em 0 0.5em 0; font-size:1.15em; font-weight:600; color:#111827;">${plan.name}</h3>`
    : '';

  const notesHtml = plan.notes
    ? `<p style="margin:0.25em 0 1em 0; font-size:0.9em; color:#6b7280; font-style:italic;">${plan.notes}</p>`
    : '';

  const tableHtml = `
  ${heading}
  <table style="width:100%; border-collapse:collapse; margin:0.5em 0 1em 0;">
    <thead>
      <tr style="background:#f3f4f6; border-bottom:2px solid #e5e7eb;">
        <th style="padding:8px 12px; text-align:left;">Description</th>
        <th style="padding:8px 12px; text-align:right;">Qty</th>
        <th style="padding:8px 12px; text-align:right;">Unit Price</th>
        <th style="padding:8px 12px; text-align:right;">Disc %</th>
        <th style="padding:8px 12px; text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>${footerRows}</tfoot>
  </table>
  ${notesHtml}`;

  return { html: tableHtml, total };
}

export function buildCostTableHtml(costBreakdownJson: string): { tableHtml: string; totalAmount: string } {
  try {
    const data = JSON.parse(costBreakdownJson);

    // Resolve plans: prefer `plans` array; fall back to legacy single-plan shape.
    let plans: CostPlanLike[] = [];
    if (Array.isArray(data?.plans) && data.plans.length > 0) {
      plans = data.plans;
    } else if (Array.isArray(data?.items)) {
      plans = [{
        name: 'Plan 1',
        items: data.items,
        additionalDiscount: data.additionalDiscount,
        taxRate: data.taxRate,
        notes: data.notes,
      }];
    }

    if (plans.length === 0) return { tableHtml: '', totalAmount: '' };

    const showHeading = plans.length > 1;
    const rendered = plans.map((p) => buildSinglePlanHtml(p, { showHeading }));
    const tableHtml = rendered.map((r) => r.html).join('\n');
    const totalAmount = showHeading
      ? rendered.map((r, i) => `${plans[i].name || `Plan ${i + 1}`}: ${formatCurrency(r.total)}`).join(' • ')
      : formatCurrency(rendered[0].total);

    return { tableHtml, totalAmount };
  } catch {
    return { tableHtml: '', totalAmount: '' };
  }
}

const HTML_PLACEHOLDERS = new Set(['{{costing}}', '{{scopeOfWork}}', '{{customerGoals}}', '{{clientSignature}}', '{{mySignature}}']);

/**
 * Replace template placeholders with actual data.
 * @param highlight - if true, wraps values in styled spans (for preview). If false, plain text (for PDF).
 */
export function replacePlaceholders(content: string, data: ProposalData, highlight = true): string {
  const { tableHtml, totalAmount } = buildCostTableHtml(data.costBreakdown);

  const proposalDate = data.createdAt
    ? format(new Date(data.createdAt), 'MMMM d, yyyy')
    : '';
  const expiryDate = data.validityDate
    ? format(new Date(data.validityDate), 'MMMM d, yyyy')
    : '';

  const contractTypeLabels: Record<string, string> = {
    amc: 'Annual Maintenance Contract',
    fixed: 'Fixed',
    retainer: 'Retainer',
  };

  const renewalLabels: Record<string, string> = {
    '1-month': '1 Month',
    '3-months': '3 Months',
    '6-months': '6 Months',
    '1-year': '1 Year',
    '3-years': '3 Years',
  };

  const startDateFormatted = data.startDate
    ? format(new Date(data.startDate), 'MMMM d, yyyy')
    : '';
  const endDateFormatted = data.endDate
    ? format(new Date(data.endDate), 'MMMM d, yyyy')
    : '';
  const approvedDateFormatted = data.approvedDate
    ? format(new Date(data.approvedDate), 'MMMM d, yyyy')
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
    '{{duration}}': data.duration || '',
    '{{costing}}': tableHtml,
    '{{totalAmount}}': totalAmount,
    '{{approvedDate}}': approvedDateFormatted,
    // Contract-specific placeholders
    '{{contractType}}': contractTypeLabels[data.contractType || ''] || data.contractType || '',
    '{{renewalFrequency}}': renewalLabels[data.renewalFrequency || ''] || data.renewalFrequency || '',
    '{{startDate}}': startDateFormatted,
    '{{endDate}}': endDateFormatted,
    '{{clientSignature}}': data.clientSignature
      ? `<span style="font-family:'Hurricane',cursive;font-size:2em;color:#1a1a1a;">${data.clientSignature}</span>`
      : '',
    '{{mySignature}}': data.mySignature
      ? `<span style="font-family:'Hurricane',cursive;font-size:2em;color:#1a1a1a;">${data.mySignature}</span>`
      : '',
  };

  let result = content;
  for (const [placeholder, value] of Object.entries(placeholderMap)) {
    const escaped = placeholder.replace(/[{}]/g, '\\$&');
    if (HTML_PLACEHOLDERS.has(placeholder)) {
      result = result.replace(new RegExp(escaped, 'g'), value);
    } else if (highlight) {
      result = result.replace(
        new RegExp(escaped, 'g'),
        `<span class="bg-primary/20 text-primary px-1 rounded font-medium">${value || '<em>Not provided</em>'}</span>`
      );
    } else {
      result = result.replace(new RegExp(escaped, 'g'), value || '');
    }
  }
  return result;
}
