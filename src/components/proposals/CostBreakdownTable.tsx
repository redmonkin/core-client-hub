import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface CostLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface CostBreakdownData {
  items: CostLineItem[];
  additionalDiscount: number;
  taxRate: number;
  notes: string;
}

interface CostBreakdownTableProps {
  value?: string;
  onChange?: (value: string) => void;
}

const createEmptyItem = (): CostLineItem => ({
  id: crypto.randomUUID(),
  description: '',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
});

const defaultData: CostBreakdownData = {
  items: [createEmptyItem()],
  additionalDiscount: 0,
  taxRate: 0,
  notes: '',
};

const parseValue = (value: string | undefined): CostBreakdownData => {
  if (!value) return defaultData;
  try {
    const parsed = JSON.parse(value);
    if (parsed.items && Array.isArray(parsed.items)) {
      return parsed;
    }
    return defaultData;
  } catch {
    // If it's plain text, convert to notes
    return { ...defaultData, notes: value };
  }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

export function CostBreakdownTable({ value, onChange }: CostBreakdownTableProps) {
  const [data, setData] = useState<CostBreakdownData>(() => parseValue(value));

  useEffect(() => {
    const parsed = parseValue(value);
    setData(parsed);
  }, [value]);

  const updateData = useCallback((newData: CostBreakdownData) => {
    setData(newData);
    onChange?.(JSON.stringify(newData));
  }, [onChange]);

  const addItem = () => {
    updateData({
      ...data,
      items: [...data.items, createEmptyItem()],
    });
  };

  const removeItem = (id: string) => {
    if (data.items.length <= 1) return;
    updateData({
      ...data,
      items: data.items.filter(item => item.id !== id),
    });
  };

  const updateItem = (id: string, field: keyof CostLineItem, value: string | number) => {
    updateData({
      ...data,
      items: data.items.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };

  const calculateLineTotal = (item: CostLineItem): number => {
    const subtotal = item.quantity * item.unitPrice;
    const discountAmount = subtotal * (item.discount / 100);
    return subtotal - discountAmount;
  };

  const subtotal = data.items.reduce((acc, item) => acc + calculateLineTotal(item), 0);
  const additionalDiscountAmount = subtotal * (data.additionalDiscount / 100);
  const afterDiscount = subtotal - additionalDiscountAmount;
  const taxAmount = afterDiscount * (data.taxRate / 100);
  const total = afterDiscount + taxAmount;

  return (
    <div className="space-y-4">
      {/* Line Items Table */}
      <div className="rounded-lg border border-input overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-8"></TableHead>
              <TableHead className="min-w-[200px]">Description</TableHead>
              <TableHead className="w-24 text-right">Qty</TableHead>
              <TableHead className="w-32 text-right">Unit Price</TableHead>
              <TableHead className="w-24 text-right">Disc %</TableHead>
              <TableHead className="w-32 text-right">Total</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell className="text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                </TableCell>
                <TableCell>
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Enter item description"
                    className="border-0 p-0 h-auto shadow-none focus-visible:ring-0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    min={0}
                    step={1}
                    className="border-0 p-0 h-auto shadow-none focus-visible:ring-0 text-right"
                  />
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
                  {formatCurrency(calculateLineTotal(item))}
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

      {/* Add Item Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        className="w-full border-dashed"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Line Item
      </Button>

      {/* Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Additional Options */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Label htmlFor="additionalDiscount" className="text-sm text-muted-foreground w-32">
              Additional Discount
            </Label>
            <div className="flex items-center gap-1">
              <Input
                id="additionalDiscount"
                type="number"
                value={data.additionalDiscount}
                onChange={(e) => updateData({ ...data, additionalDiscount: parseFloat(e.target.value) || 0 })}
                min={0}
                max={100}
                step={1}
                className="w-20 text-right"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="taxRate" className="text-sm text-muted-foreground w-32">
              Tax Rate (GST)
            </Label>
            <div className="flex items-center gap-1">
              <Input
                id="taxRate"
                type="number"
                value={data.taxRate}
                onChange={(e) => updateData({ ...data, taxRate: parseFloat(e.target.value) || 0 })}
                min={0}
                max={100}
                step={1}
                className="w-20 text-right"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {data.additionalDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount ({data.additionalDiscount}%)</span>
              <span className="text-destructive">-{formatCurrency(additionalDiscountAmount)}</span>
            </div>
          )}
          {data.taxRate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({data.taxRate}%)</span>
              <span>+{formatCurrency(taxAmount)}</span>
            </div>
          )}
          <div className="border-t border-border pt-2 mt-2">
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-lg">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="costNotes" className="text-sm text-muted-foreground">
          Additional Notes (payment terms, validity, etc.)
        </Label>
        <Input
          id="costNotes"
          value={data.notes}
          onChange={(e) => updateData({ ...data, notes: e.target.value })}
          placeholder="e.g., 50% advance, balance on completion. Quote valid for 30 days."
        />
      </div>
    </div>
  );
}
