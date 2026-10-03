import { useState, useEffect } from 'react';
import { Plus, Trash2, Package, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { useInvoiceItems, InvoiceItem } from '@/components/invoices/InvoiceItemsCatalog';
import {
  InvoiceLineItem,
  DiscountType,
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
  const { workspaceUserId } = useWorkspaceUser();
  const { data: catalogItems = [] } = useInvoiceItems(workspaceUserId);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [data, setData] = useState(() => parseInvoiceLineItems(value));

  useEffect(() => {
    setData(parseInvoiceLineItems(value));
  }, [value]);

  const persist = (next: typeof data) => {
    setData(next);
    onChange?.(JSON.stringify(next));
  };

  const clampField = (field: keyof InvoiceLineItem, value: number, discountType: DiscountType): number => {
    if (field === 'discount') return discountType === 'percent' ? Math.min(100, Math.max(0, value)) : Math.max(0, value);
    if (field === 'quantity' || field === 'unitPrice') return Math.max(0, value);
    return value;
  };

  const updateItem = (itemId: string, field: keyof InvoiceLineItem, fieldValue: string | number) => {
    const item = data.items.find((i) => i.id === itemId);
    const clamped = typeof fieldValue === 'number' ? clampField(field, fieldValue, item?.discountType ?? 'percent') : fieldValue;
    persist({ ...data, items: data.items.map((i) => (i.id === itemId ? { ...i, [field]: clamped } : i)) });
  };

  const setItemDiscountType = (itemId: string, discountType: DiscountType) => {
    persist({ ...data, items: data.items.map((i) => (i.id === itemId ? { ...i, discountType } : i)) });
  };

  const addItem = () => {
    persist({ ...data, items: [...data.items, createEmptyInvoiceLineItem()] });
  };

  const addFromCatalog = (catalogItem: InvoiceItem) => {
    const newItem: InvoiceLineItem = {
      ...createEmptyInvoiceLineItem(),
      name: catalogItem.title,
      description: catalogItem.description || '',
      unit: catalogItem.unit,
      unitPrice: catalogItem.cost,
    };
    persist({ ...data, items: [...data.items, newItem] });
    setIsPickerOpen(false);
  };

  const removeItem = (itemId: string) => {
    persist({ ...data, items: data.items.filter((i) => i.id !== itemId) });
  };

  const totals = getInvoiceTotals(data);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-input overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[240px]">Item &amp; Description</TableHead>
              <TableHead className="w-20 text-right">Qty</TableHead>
              <TableHead className="w-24">Unit</TableHead>
              <TableHead className="w-28 text-right">Rate</TableHead>
              <TableHead className="w-32 text-right">Discount</TableHead>
              <TableHead className="w-32 text-right">Amount</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                  No line items yet — add one below.
                </TableCell>
              </TableRow>
            )}
            {data.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="space-y-1">
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      placeholder="e.g. Senior Web Consultant"
                      className="h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input focus-visible:ring-1 focus-visible:ring-offset-0 font-medium"
                    />
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      placeholder="Description (optional)"
                      className="h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input focus-visible:ring-1 focus-visible:ring-offset-0 text-xs text-muted-foreground"
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.5}
                    className="h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input focus-visible:ring-1 focus-visible:ring-offset-0 text-right"
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
                    className="h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input focus-visible:ring-1 focus-visible:ring-offset-0 text-right"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Input
                      type="number"
                      value={item.discount}
                      onChange={(e) => updateItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                      min={0}
                      max={item.discountType === 'percent' ? 100 : undefined}
                      step={item.discountType === 'percent' ? 1 : 0.01}
                      className="h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input focus-visible:ring-1 focus-visible:ring-offset-0 text-right w-14"
                    />
                    <Select value={item.discountType} onValueChange={(v) => setItemDiscountType(item.id, v as DiscountType)}>
                      <SelectTrigger className="h-8 w-16 border-0 shadow-none focus:ring-0 px-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="flat">₹ flat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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

      <div className="flex flex-col gap-2 sm:flex-row">
        <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="flex-1 border-dashed">
              <Package className="mr-2 h-4 w-4" />
              Add From Catalog
              <ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search items..." />
              <CommandList>
                <CommandEmpty>
                  {catalogItems.length === 0 ? 'No saved items yet. Add some from the Items tab.' : 'No matching items.'}
                </CommandEmpty>
                <CommandGroup>
                  {catalogItems.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.title}
                      onSelect={() => addFromCatalog(item)}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.title}</div>
                        {item.description && (
                          <div className="truncate text-xs text-muted-foreground">{item.description}</div>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatInvoiceCurrency(item.cost)}/{item.unit}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button type="button" variant="outline" size="sm" onClick={addItem} className="flex-1 border-dashed">
          <Plus className="mr-2 h-4 w-4" />
          Add Custom Item
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground w-32">Discount</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={data.additionalDiscount}
                onChange={(e) => {
                  const raw = parseFloat(e.target.value) || 0;
                  const clamped = data.additionalDiscountType === 'percent' ? Math.min(100, Math.max(0, raw)) : Math.max(0, raw);
                  persist({ ...data, additionalDiscount: clamped });
                }}
                min={0}
                max={data.additionalDiscountType === 'percent' ? 100 : undefined}
                step={data.additionalDiscountType === 'percent' ? 1 : 0.01}
                className="w-20 text-right"
              />
              <Select
                value={data.additionalDiscountType}
                onValueChange={(v) => persist({ ...data, additionalDiscountType: v as DiscountType })}
              >
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">%</SelectItem>
                  <SelectItem value="flat">₹ flat</SelectItem>
                </SelectContent>
              </Select>
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
              <span className="text-muted-foreground">Discount{data.additionalDiscountType === 'flat' ? '' : ` (${data.additionalDiscount}%)`}</span>
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
