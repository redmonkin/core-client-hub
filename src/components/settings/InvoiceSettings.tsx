import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Receipt, Landmark } from 'lucide-react';
import { toast } from 'sonner';

interface InvoiceSettingsForm {
  invoice_prefix: string;
  next_invoice_number: number;
  number_padding: number;
  bank_account_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  swift_code: string;
  pan: string;
  upi_id: string;
  payment_instructions: string;
  terms_and_conditions: string;
}

const defaultForm: InvoiceSettingsForm = {
  invoice_prefix: 'INV-',
  next_invoice_number: 1,
  number_padding: 4,
  bank_account_name: '',
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  swift_code: '',
  pan: '',
  upi_id: '',
  payment_instructions: 'Payments can be made via Bank transfer / RazorPay / UPI.',
  terms_and_conditions: '',
};

export function InvoiceSettings() {
  const { workspaceUserId, role, loading: workspaceLoading } = useWorkspaceUser();
  const queryClient = useQueryClient();
  const canManage = role === 'owner' || role === 'admin';
  const [form, setForm] = useState<InvoiceSettingsForm>(defaultForm);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['invoice-settings', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_settings').select('*').eq('user_id', workspaceUserId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceUserId && !workspaceLoading,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        invoice_prefix: settings.invoice_prefix,
        next_invoice_number: settings.next_invoice_number,
        number_padding: settings.number_padding,
        bank_account_name: settings.bank_account_name || '',
        bank_name: settings.bank_name || '',
        account_number: settings.account_number || '',
        ifsc_code: settings.ifsc_code || '',
        swift_code: settings.swift_code || '',
        pan: settings.pan || '',
        upi_id: settings.upi_id || '',
        payment_instructions: settings.payment_instructions || defaultForm.payment_instructions,
        terms_and_conditions: settings.terms_and_conditions || '',
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const candidateNumber = `${form.invoice_prefix}${String(form.next_invoice_number).padStart(form.number_padding, '0')}`;
      const { data: collision, error: collisionError } = await supabase
        .from('invoices')
        .select('id')
        .eq('user_id', workspaceUserId!)
        .eq('invoice_number', candidateNumber)
        .maybeSingle();
      if (collisionError) throw collisionError;
      if (collision) {
        throw new Error(`Invoice ${candidateNumber} already exists — pick a higher "Next Number" to avoid a duplicate.`);
      }

      const { error } = await supabase.from('invoice_settings').upsert({
        user_id: workspaceUserId!,
        ...form,
      }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-settings'] });
      toast.success('Invoice settings saved');
    },
    onError: (error: Error) => toast.error('Failed to save: ' + error.message),
  });

  const previewNumber = `${form.invoice_prefix}${String(form.next_invoice_number).padStart(form.number_padding, '0')}`;

  if (isLoading || workspaceLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle>Invoice Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle>Invoice Settings</CardTitle>
          </div>
          <CardDescription>Only the account owner or an admin can manage invoice settings.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <CardTitle>Invoice Settings</CardTitle>
        </div>
        <CardDescription>
          Invoice numbering, bank/payment details, and default terms shown on every invoice PDF and email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Numbering */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Invoice Numbering</Label>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="invoicePrefix" className="text-xs text-muted-foreground">Prefix</Label>
              <Input
                id="invoicePrefix"
                value={form.invoice_prefix}
                onChange={(e) => setForm((p) => ({ ...p, invoice_prefix: e.target.value }))}
                placeholder="INV-"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nextNumber" className="text-xs text-muted-foreground">Next Number</Label>
              <Input
                id="nextNumber"
                type="number"
                min={1}
                value={form.next_invoice_number}
                onChange={(e) => setForm((p) => ({ ...p, next_invoice_number: parseInt(e.target.value, 10) || 1 }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="padding" className="text-xs text-muted-foreground">Digits</Label>
              <Input
                id="padding"
                type="number"
                min={1}
                max={10}
                value={form.number_padding}
                onChange={(e) => setForm((p) => ({ ...p, number_padding: parseInt(e.target.value, 10) || 1 }))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Next invoice will be numbered <span className="font-mono font-medium text-foreground">{previewNumber}</span>.
            {' '}If you're migrating from another tool, set this to continue your existing sequence.
          </p>
        </div>

        {/* Bank details */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-semibold">
            <Landmark className="h-3.5 w-3.5" />
            Payment Details
          </Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bankAccountName" className="text-xs text-muted-foreground">Account Holder Name</Label>
              <Input id="bankAccountName" value={form.bank_account_name} onChange={(e) => setForm((p) => ({ ...p, bank_account_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankName" className="text-xs text-muted-foreground">Bank Name</Label>
              <Input id="bankName" value={form.bank_name} onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))} placeholder="e.g. ICICI Bank" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accountNumber" className="text-xs text-muted-foreground">Account Number</Label>
              <Input id="accountNumber" value={form.account_number} onChange={(e) => setForm((p) => ({ ...p, account_number: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ifsc" className="text-xs text-muted-foreground">IFSC Code</Label>
              <Input id="ifsc" value={form.ifsc_code} onChange={(e) => setForm((p) => ({ ...p, ifsc_code: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="swift" className="text-xs text-muted-foreground">SWIFT Code</Label>
              <Input id="swift" value={form.swift_code} onChange={(e) => setForm((p) => ({ ...p, swift_code: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pan" className="text-xs text-muted-foreground">PAN</Label>
              <Input id="pan" value={form.pan} onChange={(e) => setForm((p) => ({ ...p, pan: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upi" className="text-xs text-muted-foreground">UPI ID</Label>
              <Input id="upi" value={form.upi_id} onChange={(e) => setForm((p) => ({ ...p, upi_id: e.target.value }))} placeholder="yourname@bank" />
            </div>
          </div>
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="paymentInstructions" className="text-xs text-muted-foreground">Payment Instructions (shown above bank details)</Label>
            <Input
              id="paymentInstructions"
              value={form.payment_instructions}
              onChange={(e) => setForm((p) => ({ ...p, payment_instructions: e.target.value }))}
            />
          </div>
        </div>

        {/* Terms and conditions */}
        <div className="space-y-1.5">
          <Label htmlFor="terms" className="text-sm font-semibold">Default Terms &amp; Conditions</Label>
          <Textarea
            id="terms"
            value={form.terms_and_conditions}
            onChange={(e) => setForm((p) => ({ ...p, terms_and_conditions: e.target.value }))}
            placeholder={'One per line, e.g.:\nA late fee of 3.5% per month applies to invoices unpaid past the due date.\nAll contracts are formally closed 60 days after the invoice due date.'}
            className="min-h-[120px]"
          />
          <p className="text-xs text-muted-foreground">One item per line — rendered as a numbered list on every invoice.</p>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Invoice Settings
        </Button>
      </CardContent>
    </Card>
  );
}
