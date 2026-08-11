// Invoices intentionally use a simpler, single-table line-item shape than
// proposals/contracts' CostBreakdownTable -- an invoice is a single finalized
// bill, not a set of selectable pricing plans, so there's no "plans" concept
// here at all.

export interface InvoiceLineItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
}

export interface InvoiceLineItemsData {
  items: InvoiceLineItem[];
  additionalDiscount: number;
  taxRate: number;
  notes: string;
}

export const INVOICE_UNITS = ['hr', 'day', 'week', 'month', 'fixed', 'pcs'] as const;

export const createEmptyInvoiceLineItem = (): InvoiceLineItem => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  quantity: 1,
  unit: 'hr',
  unitPrice: 0,
  discount: 0,
});

// Invoices start with no line items -- the user adds the first one explicitly
// (from the catalog or as a custom item) rather than editing a pre-seeded
// blank row.
export const buildDefaultInvoiceLineItems = (): InvoiceLineItemsData => ({
  items: [],
  additionalDiscount: 0,
  taxRate: 0,
  notes: '',
});

export function parseInvoiceLineItems(value: string | null | undefined): InvoiceLineItemsData {
  if (!value) return buildDefaultInvoiceLineItems();
  try {
    const parsed = JSON.parse(value);
    if (parsed && Array.isArray(parsed.items)) {
      return {
        items: parsed.items.map((i: Partial<InvoiceLineItem>) => ({
          id: i.id || crypto.randomUUID(),
          name: i.name || '',
          description: i.description || '',
          quantity: i.quantity ?? 1,
          unit: i.unit || 'hr',
          unitPrice: i.unitPrice ?? 0,
          discount: i.discount ?? 0,
        })),
        additionalDiscount: parsed.additionalDiscount ?? 0,
        taxRate: parsed.taxRate ?? 0,
        notes: parsed.notes ?? '',
      };
    }
    return buildDefaultInvoiceLineItems();
  } catch {
    return buildDefaultInvoiceLineItems();
  }
}

export function calculateInvoiceLineTotal(item: InvoiceLineItem): number {
  const subtotal = item.quantity * item.unitPrice;
  return subtotal - subtotal * (item.discount / 100);
}

export function getInvoiceTotals(data: InvoiceLineItemsData) {
  const subtotal = data.items.reduce((acc, item) => acc + calculateInvoiceLineTotal(item), 0);
  const additionalDiscountAmount = subtotal * (data.additionalDiscount / 100);
  const afterDiscount = subtotal - additionalDiscountAmount;
  const taxAmount = afterDiscount * (data.taxRate / 100);
  const total = afterDiscount + taxAmount;
  return { subtotal, additionalDiscountAmount, taxAmount, total };
}

export function getInvoiceTotalFromJson(costBreakdownJson: string | null | undefined): number {
  return getInvoiceTotals(parseInvoiceLineItems(costBreakdownJson)).total;
}

// Used to escape any user-editable text (client billing address, company
// address, bank/payment details, notes, terms) before it's interpolated into
// the raw HTML string handed to pdf-export.ts, which injects it via
// container.innerHTML into a live DOM node -- unescaped markup there is a
// real injection vector (e.g. an <img onerror=...> in a pasted address).
export const escapeInvoiceHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const formatInvoiceCurrency = (amount: number, currency = 'INR'): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

// Indian numbering system (lakh/crore) words, matching how Zoho and Indian
// invoicing conventions spell out amounts -- e.g. 150000 -> "One Lakh Fifty
// Thousand".
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens];
}

function threeDigitsToWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(' ');
}

export function numberToIndianWords(amount: number): string {
  const rupees = Math.floor(Math.round(amount * 100) / 100);
  const paise = Math.round((amount - rupees) * 100);

  if (rupees === 0 && paise === 0) return 'Zero';

  let n = rupees;
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsToWords(hundred));

  let words = parts.join(' ') || 'Zero';
  if (paise > 0) words += ` and ${twoDigitsToWords(paise)} Paise`;
  return words;
}

const UNIT_LABELS: Record<string, string> = {
  hr: 'hr', day: 'day', week: 'wk', month: 'mo', fixed: 'fixed', pcs: 'pcs',
};

/** Renders the # | Description | Qty | Rate | Amount table used on the
 * invoice PDF/portal, plus Sub Total / Discount / Tax rows -- Balance Due and
 * Total In Words are rendered separately by the caller since they also need
 * amount_paid, which isn't part of the line-item data. */
export function buildInvoiceLineItemsHtml(costBreakdownJson: string | null | undefined, currency = 'INR'): { tableHtml: string; totals: ReturnType<typeof getInvoiceTotals> } {
  const data = parseInvoiceLineItems(costBreakdownJson);
  const totals = getInvoiceTotals(data);
  const fmt = (n: number) => formatInvoiceCurrency(n, currency);

  const rows = data.items.map((item, idx) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f1f1;color:#6b7280;">${idx + 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f1f1;">
        ${item.name ? `<div style="font-weight:600;">${escapeInvoiceHtml(item.name)}</div>` : ''}
        ${item.description ? `<div style="${item.name ? 'font-size:11px;color:#6b7280;margin-top:2px;' : ''}">${escapeInvoiceHtml(item.description)}</div>` : ''}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f1f1;text-align:right;white-space:nowrap;">${item.quantity.toFixed(2)}<div style="font-size:11px;color:#9ca3af;">${UNIT_LABELS[item.unit] || item.unit}</div></td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f1f1;text-align:right;">${fmt(item.unitPrice)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f1f1;text-align:right;">${fmt(calculateInvoiceLineTotal(item))}</td>
    </tr>
  `).join('');

  const tableHtml = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#c0392b;color:#fff;">
          <th style="padding:10px 12px;text-align:left;font-weight:600;">#</th>
          <th style="padding:10px 12px;text-align:left;font-weight:600;">Item &amp; Description</th>
          <th style="padding:10px 12px;text-align:right;font-weight:600;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-weight:600;">Rate</th>
          <th style="padding:10px 12px;text-align:right;font-weight:600;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:12px;">
      <table style="font-size:13px;min-width:260px;">
        <tr><td style="padding:4px 12px;color:#6b7280;">Sub Total</td><td style="padding:4px 12px;text-align:right;">${fmt(totals.subtotal)}</td></tr>
        ${data.additionalDiscount > 0 ? `<tr><td style="padding:4px 12px;color:#6b7280;">Discount (${data.additionalDiscount}%)</td><td style="padding:4px 12px;text-align:right;color:#c0392b;">-${fmt(totals.additionalDiscountAmount)}</td></tr>` : ''}
        ${data.taxRate > 0 ? `<tr><td style="padding:4px 12px;color:#6b7280;">Tax (${data.taxRate}%)</td><td style="padding:4px 12px;text-align:right;">+${fmt(totals.taxAmount)}</td></tr>` : ''}
        <tr><td style="padding:8px 12px;font-weight:700;border-top:1px solid #e5e7eb;">Total</td><td style="padding:8px 12px;text-align:right;font-weight:700;border-top:1px solid #e5e7eb;">${fmt(totals.total)}</td></tr>
      </table>
    </div>
  `;

  return { tableHtml, totals };
}
