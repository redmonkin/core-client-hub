// Server-side invoice PDF, used where there is no browser to render the
// invoice HTML (the recurring-invoice cron job). Mirrors the layout of
// buildInvoicePdfHtml in src/pages/Invoices.tsx; keep the two in step.
//
// Line-item math is mirrored from src/lib/invoice-utils.ts (pure arithmetic,
// duplicated rather than shared across the Vite bundle and Deno).

import { jsPDF } from "npm:jspdf@4.2.1";

// ---------------------------------------------------------------------------
// Line items
// ---------------------------------------------------------------------------

type DiscountType = "percent" | "flat";

export interface InvoiceLineItem {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  discountType: DiscountType;
}

export interface InvoiceLineItemsData {
  items: InvoiceLineItem[];
  additionalDiscount: number;
  additionalDiscountType: DiscountType;
  taxRate: number;
}

export function parseInvoiceLineItems(value: string | null | undefined): InvoiceLineItemsData {
  const empty: InvoiceLineItemsData = { items: [], additionalDiscount: 0, additionalDiscountType: "percent", taxRate: 0 };
  if (!value) return empty;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || !Array.isArray(parsed.items)) return empty;
    return {
      items: parsed.items.map((i: Partial<InvoiceLineItem>) => ({
        name: i.name || "",
        description: i.description || "",
        quantity: i.quantity ?? 1,
        unit: i.unit || "hr",
        unitPrice: i.unitPrice ?? 0,
        discount: i.discount ?? 0,
        discountType: i.discountType === "flat" ? "flat" : "percent",
      })),
      additionalDiscount: parsed.additionalDiscount ?? 0,
      additionalDiscountType: parsed.additionalDiscountType === "flat" ? "flat" : "percent",
      taxRate: parsed.taxRate ?? 0,
    };
  } catch {
    return empty;
  }
}

export function calculateInvoiceLineTotal(item: InvoiceLineItem): number {
  const subtotal = item.quantity * item.unitPrice;
  const discountAmount = item.discountType === "flat" ? Math.min(item.discount, subtotal) : subtotal * (item.discount / 100);
  return subtotal - discountAmount;
}

export function getInvoiceTotals(data: InvoiceLineItemsData) {
  const subtotal = data.items.reduce((acc, item) => acc + calculateInvoiceLineTotal(item), 0);
  const additionalDiscountAmount = data.additionalDiscountType === "flat"
    ? Math.min(data.additionalDiscount, subtotal)
    : subtotal * (data.additionalDiscount / 100);
  const afterDiscount = subtotal - additionalDiscountAmount;
  const taxAmount = afterDiscount * (data.taxRate / 100);
  return { subtotal, additionalDiscountAmount, taxAmount, total: afterDiscount + taxAmount };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const UNIT_LABELS: Record<string, string> = { hr: "hr", day: "day", week: "wk", month: "mo", fixed: "fixed", pcs: "pcs" };
const PAYMENT_TERMS_LABELS: Record<string, string> = { net15: "Net 15", net30: "Net 30", net45: "Net 45", net60: "Net 60", custom: "Custom" };

/** "2026-09-28" -> "28/09/2026", matching the browser PDF's dd/MM/yyyy. */
function formatDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens];
}

function threeDigitsToWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(" ");
}

/** Indian numbering (lakh/crore), mirrored from numberToIndianWords. */
export function numberToIndianWords(amount: number): string {
  const rupees = Math.floor(Math.round(amount * 100) / 100);
  const paise = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero";

  let n = rupees;
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (n) parts.push(threeDigitsToWords(n));

  let words = parts.join(" ") || "Zero";
  if (paise > 0) words += ` and ${twoDigitsToWords(paise)} Paise`;
  return words;
}

// ---------------------------------------------------------------------------
// Fonts and logo
// ---------------------------------------------------------------------------

// Poppins matches the browser-rendered invoice PDF and includes the ₹ glyph,
// which jsPDF's built-in fonts lack. Loaded at runtime (OFL-licensed, from the
// Google Fonts repository); if that fails we fall back to Helvetica and "Rs.".
const FONT_BASE_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins";
let fontCache: Promise<{ regular: string; bold: string } | null> | null = null;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function fetchBytes(url: string, maxBytes: number, timeoutMs = 8000): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.byteLength <= maxBytes ? bytes : null;
  } catch {
    return null;
  }
}

function loadFonts(): Promise<{ regular: string; bold: string } | null> {
  fontCache ??= (async () => {
    const [regular, bold] = await Promise.all([
      fetchBytes(`${FONT_BASE_URL}/Poppins-Regular.ttf`, 1_000_000),
      fetchBytes(`${FONT_BASE_URL}/Poppins-SemiBold.ttf`, 1_000_000),
    ]);
    if (!regular || !bold) {
      console.warn("invoice-pdf: couldn't load Poppins, falling back to Helvetica");
      fontCache = null; // retry on the next invoice
      return null;
    }
    return { regular: toBase64(regular), bold: toBase64(bold) };
  })();
  return fontCache;
}

/** Only fetch logos from this project's public storage, never arbitrary URLs. */
async function loadLogo(url: string | null | undefined): Promise<{ data: Uint8Array; format: "PNG" | "JPEG" } | null> {
  const storagePrefix = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/`;
  if (!url || !url.startsWith(storagePrefix)) return null;
  const bytes = await fetchBytes(url, 2_000_000, 5000);
  if (!bytes) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { data: bytes, format: "PNG" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { data: bytes, format: "JPEG" };
  return null; // SVG/WebP etc. aren't supported by jsPDF; render without a logo
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export interface InvoicePdfInput {
  invoiceNumber: string;
  issuedDate: string;
  dueDate: string | null;
  paymentTerms: string | null;
  notes: string | null;
  costBreakdown: string | null;
  amountPaid?: number;
  branding: {
    company_name?: string | null;
    company_logo_url?: string | null;
    company_address?: string | null;
    support_email?: string | null;
  } | null;
  client: {
    client_name?: string | null;
    company_name?: string | null;
    billing_address?: string | null;
  };
  settings: {
    bank_account_name?: string | null;
    account_number?: string | null;
    swift_code?: string | null;
    ifsc_code?: string | null;
    pan?: string | null;
    upi_id?: string | null;
    payment_instructions?: string | null;
    terms_and_conditions?: string | null;
  } | null;
}

type RGB = [number, number, number];
const INK: RGB = [31, 41, 55];        // #1f2937
const MUTED: RGB = [107, 114, 128];   // #6b7280
const FAINT: RGB = [156, 163, 175];   // #9ca3af
const ACCENT: RGB = [192, 57, 43];    // #c0392b, header band and balance due
const RULE: RGB = [229, 231, 235];    // #e5e7eb

/** Renders the invoice and returns it as a base64 string (for email attachments). */
export async function renderInvoicePdfBase64(input: InvoicePdfInput): Promise<string> {
  const [fonts, logo] = await Promise.all([loadFonts(), loadLogo(input.branding?.company_logo_url)]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let family = "helvetica";
  if (fonts) {
    doc.addFileToVFS("Poppins-Regular.ttf", fonts.regular);
    doc.addFont("Poppins-Regular.ttf", "Poppins", "normal");
    doc.addFileToVFS("Poppins-SemiBold.ttf", fonts.bold);
    doc.addFont("Poppins-SemiBold.ttf", "Poppins", "bold");
    family = "Poppins";
  }

  const money = (n: number) => {
    const s = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    return fonts ? s : s.replace("₹", "Rs. ");
  };

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 16;                 // page margin
  const right = pageW - M;
  const contentW = pageW - M * 2;
  const lh = (size: number) => size * 0.3528 * 1.45; // pt -> mm line height

  const style = (size: number, color: RGB = INK, bold = false) => {
    doc.setFont(family, bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  /** Draws wrapped text; returns the y just below it. */
  const write = (text: string, x: number, y: number, opts: { size?: number; color?: RGB; bold?: boolean; width?: number; align?: "left" | "right" } = {}) => {
    const size = opts.size ?? 10;
    style(size, opts.color, opts.bold);
    const lines: string[] = opts.width ? doc.splitTextToSize(text, opts.width) : text.split("\n");
    lines.forEach((line, i) => doc.text(line, x, y + i * lh(size), { align: opts.align ?? "left", baseline: "top" }));
    return y + lines.length * lh(size);
  };

  let y = M;
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - M) {
      doc.addPage();
      y = M;
    }
  };

  const data = parseInvoiceLineItems(input.costBreakdown);
  const totals = getInvoiceTotals(data);
  const balanceDue = totals.total - (input.amountPaid ?? 0);

  // Header: company (left), invoice number and balance due (right)
  let leftY = y;
  if (logo) {
    // Fit within 60mm x 14mm, keeping the aspect ratio.
    const props = doc.getImageProperties(logo.data);
    const aspect = props.width / props.height;
    const h = Math.min(14, 60 / aspect);
    doc.addImage(logo.data, logo.format, M, leftY, h * aspect, h);
    leftY += h + 3;
  }
  const b = input.branding;
  if (b?.company_name) leftY = write(b.company_name, M, leftY, { size: 12, bold: true, width: contentW * 0.55 });
  if (b?.company_address) leftY = write(b.company_address, M, leftY + 1, { size: 9, color: MUTED, width: contentW * 0.55 });
  if (b?.support_email) leftY = write(b.support_email, M, leftY + 1, { size: 9, color: MUTED });

  let rightY = write(`# ${input.invoiceNumber}`, right, y, { size: 16, bold: true, align: "right" });
  rightY = write("BALANCE DUE", right, rightY + 4, { size: 8, color: MUTED, align: "right" });
  rightY = write(money(balanceDue), right, rightY + 0.5, { size: 16, bold: true, color: ACCENT, align: "right" });
  y = Math.max(leftY, rightY) + 10;

  // Bill to (left) and dates (right)
  const c = input.client;
  const billTo = `${c.client_name || ""}${c.company_name ? ` (${c.company_name})` : ""}`;
  leftY = write(billTo, M, y, { size: 10, bold: true, width: contentW * 0.55 });
  if (c.billing_address) leftY = write(c.billing_address, M, leftY + 1, { size: 9, color: MUTED, width: contentW * 0.55 });

  const dateRows: [string, string][] = [["Invoice Date:", formatDate(input.issuedDate)]];
  if (input.paymentTerms) dateRows.push(["Terms:", PAYMENT_TERMS_LABELS[input.paymentTerms] || input.paymentTerms]);
  if (input.dueDate) dateRows.push(["Due Date:", formatDate(input.dueDate)]);
  rightY = y;
  for (const [label, value] of dateRows) {
    write(label, right - 32, rightY, { size: 9.5, color: MUTED, align: "right" });
    rightY = write(value, right, rightY, { size: 9.5, bold: true, align: "right" }) + 1;
  }
  y = Math.max(leftY, rightY) + 8;

  // Line items table
  const col = { idx: M + 3, desc: M + 12, qty: right - 62, rate: right - 32, amount: right - 3 };
  const descW = col.qty - 18 - col.desc;
  const drawTableHeader = () => {
    doc.setFillColor(...ACCENT);
    doc.rect(M, y, contentW, 9, "F");
    style(9, [255, 255, 255], true);
    doc.text("#", col.idx, y + 5.8);
    doc.text("Item & Description", col.desc, y + 5.8);
    doc.text("Qty", col.qty, y + 5.8, { align: "right" });
    doc.text("Rate", col.rate, y + 5.8, { align: "right" });
    doc.text("Amount", col.amount, y + 5.8, { align: "right" });
    y += 9;
  };
  drawTableHeader();

  data.items.forEach((item, i) => {
    style(9.5, INK, true);
    const nameLines: string[] = item.name ? doc.splitTextToSize(item.name, descW) : [];
    style(8.5, MUTED);
    const descLines: string[] = item.description ? doc.splitTextToSize(item.description, descW) : [];
    const rowH = Math.max(nameLines.length * lh(9.5) + descLines.length * lh(8.5), lh(9.5) + lh(8)) + 6;
    if (y + rowH > pageH - M) {
      doc.addPage();
      y = M;
      drawTableHeader();
    }
    const top = y + 3;
    write(String(i + 1), col.idx, top, { size: 9.5, color: MUTED });
    let dy = top;
    if (nameLines.length) dy = write(nameLines.join("\n"), col.desc, dy, { size: 9.5, bold: true });
    if (descLines.length) write(descLines.join("\n"), col.desc, dy, { size: 8.5, color: MUTED });
    const qtyBottom = write(item.quantity.toFixed(2), col.qty, top, { size: 9.5, align: "right" });
    write(UNIT_LABELS[item.unit] || item.unit, col.qty, qtyBottom, { size: 8, color: FAINT, align: "right" });
    write(money(item.unitPrice), col.rate, top, { size: 9.5, align: "right" });
    write(money(calculateInvoiceLineTotal(item)), col.amount, top, { size: 9.5, align: "right" });
    y += rowH;
    doc.setDrawColor(241, 241, 241);
    doc.line(M, y, right, y);
  });

  // Totals
  const totalRows: [string, string, RGB?][] = [["Sub Total", money(totals.subtotal)]];
  if (data.additionalDiscount > 0) {
    totalRows.push([`Discount${data.additionalDiscountType === "flat" ? "" : ` (${data.additionalDiscount}%)`}`, `-${money(totals.additionalDiscountAmount)}`, ACCENT]);
  }
  if (data.taxRate > 0) totalRows.push([`Tax (${data.taxRate}%)`, `+${money(totals.taxAmount)}`]);
  ensureSpace(totalRows.length * 7 + 22);
  y += 4;
  const labelX = right - 70;
  for (const [label, value, color] of totalRows) {
    write(label, labelX, y, { size: 9.5, color: MUTED });
    y = write(value, col.amount, y, { size: 9.5, color: color ?? INK, align: "right" }) + 1.5;
  }
  doc.setDrawColor(...RULE);
  doc.line(labelX - 3, y + 0.5, right, y + 0.5);
  y += 2.5;
  write("Total", labelX, y, { size: 10.5, bold: true });
  y = write(money(totals.total), col.amount, y, { size: 10.5, bold: true, align: "right" }) + 3;

  y = write(`Total In Words: Indian Rupee ${numberToIndianWords(totals.total)} Only`, right, y, { size: 8.5, color: MUTED, align: "right", width: contentW }) + 8;

  // Payment instructions, bank details, notes, terms
  const s = input.settings;
  const thanks = `Thank you for your business! Please make the payment by the due date noted above. ${s?.payment_instructions || ""}`.trim();
  style(9.5);
  const thanksLines: string[] = doc.splitTextToSize(thanks, contentW);
  ensureSpace(thanksLines.length * lh(9.5));
  y = write(thanksLines.join("\n"), M, y, { size: 9.5, color: [55, 65, 81] }) + 5;

  const bank = [
    s?.bank_account_name,
    s?.account_number ? `Account: #${s.account_number}` : null,
    s?.swift_code ? `SWIFT: ${s.swift_code}` : null,
    s?.ifsc_code ? `IFSC: ${s.ifsc_code}` : null,
    s?.pan ? `PAN: ${s.pan}` : null,
    s?.upi_id ? `UPI: ${s.upi_id}` : null,
  ].filter(Boolean) as string[];
  if (bank.length) {
    ensureSpace(lh(10) + bank.length * lh(9.5) + 2);
    y = write("Bank Transfer Details", M, y, { size: 10, bold: true }) + 1;
    y = write(bank.join("\n"), M, y, { size: 9.5, color: [55, 65, 81] }) + 5;
  }

  if (input.notes) {
    style(9.5);
    const noteLines: string[] = doc.splitTextToSize(input.notes, contentW);
    ensureSpace(noteLines.length * lh(9.5));
    y = write(noteLines.join("\n"), M, y, { size: 9.5, color: MUTED }) + 5;
  }

  const terms = (s?.terms_and_conditions || "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (terms.length) {
    ensureSpace(14);
    doc.setDrawColor(...RULE);
    doc.line(M, y, right, y);
    y = write("Terms and Conditions", M, y + 4, { size: 8.5, bold: true, color: MUTED }) + 1.5;
    terms.forEach((t, i) => {
      style(8);
      const lines: string[] = doc.splitTextToSize(t, contentW - 6);
      ensureSpace(lines.length * lh(8) + 1);
      write(`${i + 1}.`, M, y, { size: 8, color: MUTED });
      y = write(lines.join("\n"), M + 6, y, { size: 8, color: MUTED }) + 1;
    });
  }

  return doc.output("datauristring").split(",")[1];
}
