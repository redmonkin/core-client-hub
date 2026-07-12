import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  InvoiceLineItem,
  INVOICE_UNITS,
  parseInvoiceLineItems,
  calculateInvoiceLineTotal,
  getInvoiceTotals,
  createEmptyInvoiceLineItem,
  formatInvoiceCurrency,
} from '@/lib/invoice-utils';

interface InvoiceLineItemsProps {
  value?: string;
  onChange?: (value: string) => void;
}

/** Single flat line-item table for invoices -- no multi-plan tabs like
 * proposals/contracts use, since an invoice is one finalized bill. */
export function InvoiceLineItems({ value, onChange }: InvoiceLineItemsProps) {
  const [data, setData] = useState(() => parseInvoiceLineItems(value));

  useEffect(() => {
    setData(parseInvoiceLineItems(value));
  }, [value]);

  const persist = (next: typeof data) => {
    setData(next);
    onChange?.(JSON.stringify(next));
  };

  const clampField = (field: keyof InvoiceLineItem, value: number): number => {
    if (field === 'discount') return Math.min(100, Math.max(0, value));
    if (field === 'quantity' || field === 'unitPrice') return Math.max(0, value);
    return value;
  };

  const updateItem = (itemId: string, field: keyof InvoiceLineItem, fieldValue: string | number) => {
    const clamped = typeof fieldValue === 'number' ? clampField(field, fieldValue) : fieldValue;
    persist({ ...data, items: data.items.map((i) => (i.id === itemId ? { ...i, [field]: clamped } : i)) });
  };

  const addItem = () => {
    persist({ ...data, items: [...data.items, createEmptyInvoiceLineItem()] });
  };

  const removeItem = (itemId: string) => {
    if (data.items.length <= 1) return;
    persist({ ...data, items: data.items.filter((i) => i.id !== itemId) });
  };

  const totals = getInvoiceTotals(data);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-input overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[200px]">Description</TableHead>
              <TableHead className="w-20 text-right">Qty</TableHead>
              <TableHead className="w-24">Unit</TableHead>
              <TableHead className="w-28 text-right">Rate</TableHead>
              <TableHead className="w-20 text-right">Disc %</TableHead>
              <TableHead className="w-32 text-right">Amount</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="e.g. Senior Web Consultant"
                    className="border-0 p-0 h-auto shadow-none focus-visible:ring-0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.5}
                    className="border-0 p-0 h-auto shadow-none focus-visible:ring-0 text-right"
                  />
                </TableCell>
                <TableCell>
                  <Select value={item.unit} onValueChange={(v) => updateItem(item.id, 'unit', v)}>
                    <SelectTrigger className="h-8 border-0 shadow-none focus:ring-0 px-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVOICE_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.01}
                    className="border-0 p-0 h-auto shadow-none focus-visible:ring-0 text-right"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.discount}
                    onChange={(e) => updateItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                    min={0}
                    max={100}
                    step={1}
                    className="border-0 p-0 h-auto shadow-none focus-visible:ring-0 text-right"
                  />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatInvoiceCurrency(calculateInvoiceLineTotal(item))}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    disabled={data.items.length <= 1}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full border-dashed">
        <Plus className="mr-2 h-4 w-4" />
        Add Line Item
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground w-32">Discount</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={data.additionalDiscount}
                onChange={(e) => persist({ ...data, additionalDiscount: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                min={0}
                max={100}
                step={1}
                className="w-20 text-right"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground w-32">Tax Rate (GST)</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={data.taxRate}
                onChange={(e) => persist({ ...data, taxRate: Math.max(0, parseFloat(e.target.value) || 0) })}
                min={0}
                max={100}
                step={1}
                className="w-20 text-right"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Sub Total</span>
            <span>{formatInvoiceCurrency(totals.subtotal)}</span>
          </div>
          {data.additionalDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount ({data.additionalDiscount}%)</span>
              <span className="text-destructive">-{formatInvoiceCurrency(totals.additionalDiscountAmount)}</span>
            </div>
          )}
          {data.taxRate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({data.taxRate}%)</span>
              <span>+{formatInvoiceCurrency(totals.taxAmount)}</span>
            </div>
          )}
          <div className="border-t border-border pt-2 mt-2">
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-lg">{formatInvoiceCurrency(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
