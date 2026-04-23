import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, GripVertical, X, Pencil, Check } from 'lucide-react';
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
import { cn } from '@/lib/utils';

export interface CostLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface CostPlan {
  id: string;
  name: string;
  items: CostLineItem[];
  additionalDiscount: number;
  taxRate: number;
  notes: string;
}

export interface CostBreakdownData {
  // Legacy single-plan fields (kept for backwards compatibility)
  items: CostLineItem[];
  additionalDiscount: number;
  taxRate: number;
  notes: string;
  // New multi-plan field. When present and length > 0, this is the source of truth.
  plans?: CostPlan[];
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

const createEmptyPlan = (name: string): CostPlan => ({
  id: crypto.randomUUID(),
  name,
  items: [createEmptyItem()],
  additionalDiscount: 0,
  taxRate: 0,
  notes: '',
});

const buildDefaultData = (): CostBreakdownData => {
  const plan = createEmptyPlan('Plan 1');
  return {
    items: plan.items,
    additionalDiscount: plan.additionalDiscount,
    taxRate: plan.taxRate,
    notes: plan.notes,
    plans: [plan],
  };
};

/**
 * Normalize any incoming shape into a guaranteed `plans` array. Legacy data
 * (no `plans`) is wrapped into a single "Plan 1".
 */
const parseValue = (value: string | undefined): CostBreakdownData => {
  if (!value) return buildDefaultData();
  try {
    const parsed = JSON.parse(value);
    if (parsed && Array.isArray(parsed.plans) && parsed.plans.length > 0) {
      return {
        items: parsed.items ?? parsed.plans[0].items ?? [],
        additionalDiscount: parsed.additionalDiscount ?? 0,
        taxRate: parsed.taxRate ?? 0,
        notes: parsed.notes ?? '',
        plans: parsed.plans,
      };
    }
    if (parsed && Array.isArray(parsed.items)) {
      const plan: CostPlan = {
        id: crypto.randomUUID(),
        name: 'Plan 1',
        items: parsed.items,
        additionalDiscount: parsed.additionalDiscount ?? 0,
        taxRate: parsed.taxRate ?? 0,
        notes: parsed.notes ?? '',
      };
      return { ...parsed, plans: [plan] };
    }
    return buildDefaultData();
  } catch {
    const def = buildDefaultData();
    return { ...def, notes: value, plans: def.plans };
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
  const [activePlanId, setActivePlanId] = useState<string>(() => {
    const initial = parseValue(value);
    return initial.plans?.[0]?.id ?? '';
  });
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseValue(value);
    setData(parsed);
    if (!parsed.plans?.find(p => p.id === activePlanId)) {
      setActivePlanId(parsed.plans?.[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const plans = data.plans ?? [];
  const activePlan = plans.find(p => p.id === activePlanId) ?? plans[0];

  const persist = useCallback((nextPlans: CostPlan[]) => {
    // Mirror first plan into legacy top-level fields so older readers still work.
    const first = nextPlans[0];
    const next: CostBreakdownData = {
      items: first?.items ?? [],
      additionalDiscount: first?.additionalDiscount ?? 0,
      taxRate: first?.taxRate ?? 0,
      notes: first?.notes ?? '',
      plans: nextPlans,
    };
    setData(next);
    onChange?.(JSON.stringify(next));
  }, [onChange]);

  const updatePlan = (planId: string, patch: Partial<CostPlan>) => {
    persist(plans.map(p => (p.id === planId ? { ...p, ...patch } : p)));
  };

  const addPlan = () => {
    const newPlan = createEmptyPlan(`Plan ${plans.length + 1}`);
    persist([...plans, newPlan]);
    setActivePlanId(newPlan.id);
  };

  const removePlan = (planId: string) => {
    if (plans.length <= 1) return;
    const next = plans.filter(p => p.id !== planId);
    persist(next);
    if (activePlanId === planId) {
      setActivePlanId(next[0].id);
    }
  };

  const renamePlan = (planId: string, name: string) => {
    updatePlan(planId, { name: name.trim() || 'Plan' });
  };

  const addItem = () => {
    if (!activePlan) return;
    updatePlan(activePlan.id, { items: [...activePlan.items, createEmptyItem()] });
  };

  const removeItem = (itemId: string) => {
    if (!activePlan || activePlan.items.length <= 1) return;
    updatePlan(activePlan.id, { items: activePlan.items.filter(i => i.id !== itemId) });
  };

  const updateItem = (itemId: string, field: keyof CostLineItem, fieldValue: string | number) => {
    if (!activePlan) return;
    updatePlan(activePlan.id, {
      items: activePlan.items.map(i => (i.id === itemId ? { ...i, [field]: fieldValue } : i)),
    });
  };

  const calculateLineTotal = (item: CostLineItem): number => {
    const subtotal = item.quantity * item.unitPrice;
    return subtotal - subtotal * (item.discount / 100);
  };

  if (!activePlan) return null;

  const subtotal = activePlan.items.reduce((acc, item) => acc + calculateLineTotal(item), 0);
  const additionalDiscountAmount = subtotal * (activePlan.additionalDiscount / 100);
  const afterDiscount = subtotal - additionalDiscountAmount;
  const taxAmount = afterDiscount * (activePlan.taxRate / 100);
  const total = afterDiscount + taxAmount;

  return (
    <div className="space-y-4">
      {/* Plan tabs */}
      <div className="flex items-center gap-1 flex-wrap border-b border-border pb-2">
        {plans.map((plan) => {
          const isActive = plan.id === activePlanId;
          const isEditing = editingPlanId === plan.id;
          return (
            <div
              key={plan.id}
              className={cn(
                'group flex items-center gap-1 rounded-t-md border border-b-0 px-3 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-background border-border text-foreground font-medium'
                  : 'bg-muted/40 border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {isEditing ? (
                <Input
                  autoFocus
                  defaultValue={plan.name}
                  onBlur={(e) => { renamePlan(plan.id, e.target.value); setEditingPlanId(null); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { renamePlan(plan.id, (e.target as HTMLInputElement).value); setEditingPlanId(null); }
                    if (e.key === 'Escape') { setEditingPlanId(null); }
                  }}
                  className="h-6 w-32 px-1 py-0 text-sm"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActivePlanId(plan.id)}
                  onDoubleClick={() => setEditingPlanId(plan.id)}
                  className="outline-none"
                >
                  {plan.name}
                </button>
              )}
              {isActive && !isEditing && (
                <button
                  type="button"
                  onClick={() => setEditingPlanId(plan.id)}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  aria-label="Rename plan"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              {isActive && isEditing && (
                <button
                  type="button"
                  onClick={() => setEditingPlanId(null)}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  aria-label="Done renaming"
                >
                  <Check className="h-3 w-3" />
                </button>
              )}
              {plans.length > 1 && isActive && !isEditing && (
                <button
                  type="button"
                  onClick={() => removePlan(plan.id)}
                  className="ml-1 text-muted-foreground hover:text-destructive"
                  aria-label="Remove plan"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addPlan}
          className="h-7 gap-1 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Plan
        </Button>
      </div>

      {plans.length > 1 && (
        <p className="text-xs text-muted-foreground -mt-2">
          Each plan renders as its own table in the proposal output, stacked one below the other.
        </p>
      )}

      {/* Line Items Table for active plan */}
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
            {activePlan.items.map((item) => (
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
                    disabled={activePlan.items.length <= 1}
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
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Label htmlFor="additionalDiscount" className="text-sm text-muted-foreground w-32">
              Additional Discount
            </Label>
            <div className="flex items-center gap-1">
              <Input
                id="additionalDiscount"
                type="number"
                value={activePlan.additionalDiscount}
                onChange={(e) => updatePlan(activePlan.id, { additionalDiscount: parseFloat(e.target.value) || 0 })}
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
                value={activePlan.taxRate}
                onChange={(e) => updatePlan(activePlan.id, { taxRate: parseFloat(e.target.value) || 0 })}
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
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {activePlan.additionalDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount ({activePlan.additionalDiscount}%)</span>
              <span className="text-destructive">-{formatCurrency(additionalDiscountAmount)}</span>
            </div>
          )}
          {activePlan.taxRate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({activePlan.taxRate}%)</span>
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
          value={activePlan.notes}
          onChange={(e) => updatePlan(activePlan.id, { notes: e.target.value })}
          placeholder="e.g., 50% advance, balance on completion. Quote valid for 30 days."
        />
      </div>
    </div>
  );
}
