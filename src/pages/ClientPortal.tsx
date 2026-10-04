import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { format, formatDistanceToNow } from 'date-fns';
import DOMPurify from 'dompurify';
import SignatureCanvas from 'react-signature-canvas';
import { FileText, Check, X, Loader2, AlertCircle, Clock, Globe, Mail, Download, ShieldCheck, ShieldX, Lock, MessageSquare, Send as SendIcon, Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { replacePlaceholders, ProposalData } from '@/lib/proposal-utils';
import { buildInvoiceLineItemsHtml, formatInvoiceCurrency, numberToIndianWords, escapeInvoiceHtml } from '@/lib/invoice-utils';
import { exportToPdf } from '@/lib/pdf-export';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const PORTAL_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-portal`;

type PortalProposal = {
  id: string;
  title: string;
  scope_of_work: string | null;
  cost_breakdown: string | null;
  validity_date: string | null;
  status: string;
  client_name: string | null;
  company_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_designation: string | null;
  client_address: string | null;
  project_name: string | null;
  customer_goals: string | null;
  duration: string | null;
  created_at: string;
};

type BrandingSettings = {
  company_name: string | null;
  company_logo_url: string | null;
  company_address?: string | null;
  primary_color: string | null;
  accent_color: string | null;
  tagline: string | null;
  website_url: string | null;
  support_email: string | null;
};

type PortalInvoiceSettings = {
  bank_account_name: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  swift_code: string | null;
  pan: string | null;
  upi_id: string | null;
  payment_instructions: string | null;
  terms_and_conditions: string | null;
};

type TemplateData = {
  content: string;
  name: string;
} | null;

type PortalInvoice = {
  id: string;
  invoice_number: string;
  status: string;
  currency: string;
  cost_breakdown: string | null;
  due_date: string | null;
  issued_date: string;
  payment_terms: string | null;
  notes: string | null;
  total_amount: number | null;
  amount_paid: number | null;
  client_name: string | null;
  company_name: string | null;
  client_email: string | null;
  client_address: string | null;
};

export default function ClientPortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [proposal, setProposal] = useState<PortalProposal | null>(null);
  const [invoice, setInvoice] = useState<PortalInvoice | null>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<PortalInvoiceSettings | null>(null);
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [template, setTemplate] = useState<TemplateData>(null);
  const [comments, setComments] = useState<{ id: string; author_type: string; author_name: string; content: string; created_at: string }[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentAuthorName, setCommentAuthorName] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const signaturePadRef = useRef<SignatureCanvas>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [responded, setResponded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | 'request_changes' | null>(null);
  const [changeNotes, setChangeNotes] = useState('');
  const [signatureName, setSignatureName] = useState('');
  const [documentType, setDocumentType] = useState<'proposal' | 'contract' | 'invoice'>('proposal');
  
  // Password gate state
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [verifiedPassword, setVerifiedPassword] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const primaryColor = branding?.primary_color || '#0284C7';
  const accentColor = branding?.accent_color || '#0EA5E9';

  useEffect(() => {
    if (!token) {
      setError('Invalid link. Please use the link provided in your email.');
      setLoading(false);
      return;
    }
    fetchProposal();
  }, [token]);

  const fetchProposal = async (plainPassword?: string) => {
    try {
      const baseUrl = `${PORTAL_FUNCTION_URL}?token=${token}`;
      
      let response: Response;
      if (plainPassword) {
        // Send password via POST body for server-side verification
        response = await fetch(baseUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: plainPassword }),
        });
      } else {
        response = await fetch(baseUrl, { method: 'GET' });
      }
      const result = await response.json();
      
      if (result.password_required) {
        setPasswordRequired(true);
        setLoading(false);
        return;
      }
      
      if (response.status === 403 || response.status === 429) {
        setPasswordError(response.status === 429 ? result.error : 'Incorrect password. Please try again.');
        setVerifyingPassword(false);
        return;
      }
      
      if (!response.ok) throw new Error(result.error || 'Failed to load proposal');
      
      if (result.document_type === 'invoice') {
        setInvoice(result.invoice);
        setInvoiceSettings(result.invoiceSettings || null);
      } else {
        setProposal(result.proposal);
        setTemplate(result.template);
      }
      setBranding(result.branding);
      setComments(result.comments || []);
      setDocumentType(result.document_type || 'proposal');
      setAuthenticated(true);
      setPasswordRequired(false);
      if (plainPassword) setVerifiedPassword(plainPassword);
    } catch (err: any) {
      console.error('Error fetching proposal:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setVerifyingPassword(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setVerifyingPassword(true);
    setPasswordError('');
    await fetchProposal(password.trim().toUpperCase());
  };

  const handleAction = async (action: 'approve' | 'reject' | 'request_changes') => {
    if (!token) return;
    setSubmitting(true);
    setConfirmAction(null);
    try {
      const body: any = { token, action };
      if (action === 'request_changes' && changeNotes.trim()) {
        body.notes = changeNotes.trim();
      }
      if (action === 'approve' && documentType === 'contract' && signatureName.trim()) {
        body.signature_name = signatureName.trim();
      }
      if (action === 'approve' && documentType === 'contract' && signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
        body.signature_image = signaturePadRef.current.toDataURL('image/png');
      }
      if (verifiedPassword) {
        body.password = verifiedPassword;
      }
      const response = await fetch(
        PORTAL_FUNCTION_URL,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update proposal');
      setResponded(true);
      setProposal(prev => prev ? { ...prev, status: result.status } : null);
      // The status banner is at the top of the page; bring it into view.
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const docLabel = documentType === 'contract' ? 'Contract' : 'Proposal';
      const messages: Record<string, string> = {
        approve: `${docLabel} approved successfully!`,
        reject: `${docLabel} declined`,
        request_changes: 'Change request sent successfully!',
      };
      toast.success(messages[action]);
      setChangeNotes('');
      setSignatureName(''); signaturePadRef.current?.clear();
    } catch (err: any) {
      console.error('Error updating proposal:', err);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostComment = async () => {
    if (!token || !commentText.trim()) return;
    setPostingComment(true);
    try {
      const body: any = { token, action: 'comment', comment_content: commentText.trim() };
      if (commentAuthorName.trim()) body.comment_author_name = commentAuthorName.trim();
      if (verifiedPassword) body.password = verifiedPassword;
      const response = await fetch(
        PORTAL_FUNCTION_URL,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to post comment');
      setComments(result.comments || []);
      setCommentText('');
      toast.success('Comment posted');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPostingComment(false);
    }
  };

  // Portal links carry access tokens; never let search engines index any state.
  const portalHead = (
    <Helmet>
      <title>Client Portal — Clientra</title>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}08, ${accentColor}05)` }}>
        {portalHead}
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: primaryColor }} />
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        {portalHead}
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">This link can't be opened</h2>
                <p className="text-muted-foreground mt-2 text-sm">{/[.!?]$/.test(error) ? error : `${error}.`}</p>
                <p className="text-muted-foreground mt-3 text-sm">Please ask the sender to share a new link.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (passwordRequired && !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        {portalHead}
        <Card className="max-w-sm w-full shadow-lg">
          <CardContent className="pt-8 pb-8">
            <form onSubmit={handlePasswordSubmit} className="flex flex-col items-center text-center gap-5">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <div>
                {branding?.company_name && (
                  <p className="mb-1 text-sm font-medium text-muted-foreground">{branding.company_name}</p>
                )}
                <h2 className="text-xl font-semibold text-foreground">Password required</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Enter the access password from the email you received.
                </p>
              </div>
              <div className="w-full space-y-3">
                <Input
                  type="password"
                  aria-label="Access password"
                  autoComplete="off"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                  className="text-center font-mono tracking-widest text-lg uppercase"
                  autoFocus
                />
                {passwordError && (
                  <p className="text-sm text-destructive">{passwordError}</p>
                )}
                <Button type="submit" className="w-full" disabled={verifyingPassword || !password.trim()}>
                  {verifyingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Continue'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderCommentsSection = () => (
    <div className="mt-6 space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageSquare className="h-4 w-4" />
        Comments {comments.length > 0 && `(${comments.length})`}
      </h3>
      {comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {comment.author_name}
                  {comment.author_type === 'team' && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Team</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{comment.content}</p>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <Input
          placeholder="Your name (optional)"
          value={commentAuthorName}
          onChange={(e) => setCommentAuthorName(e.target.value)}
        />
        <div className="flex gap-2">
          <Textarea
            placeholder="Add a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="min-h-[60px]"
          />
          <Button
            size="icon"
            onClick={handlePostComment}
            disabled={!commentText.trim() || postingComment}
            className="self-end"
            aria-label="Post comment"
            style={{ backgroundColor: primaryColor }}
          >
            {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );

  if (documentType === 'invoice') {
    if (!invoice) return null;

    const { tableHtml } = buildInvoiceLineItemsHtml(invoice.cost_breakdown, invoice.currency || 'INR');
    const portalTableHtml = buildInvoiceLineItemsHtml(invoice.cost_breakdown, invoice.currency || 'INR', primaryColor).tableHtml;
    const formatCurrency = (amount: number) => formatInvoiceCurrency(amount, invoice.currency || 'INR');
    const balanceDue = invoice.total_amount != null ? invoice.total_amount - (invoice.amount_paid ?? 0) : null;
    const paymentTermsLabel: Record<string, string> = { net15: 'Net 15', net30: 'Net 30', net45: 'Net 45', net60: 'Net 60', custom: 'Custom' };
    const isOverdue = ['sent', 'partial'].includes(invoice.status) && !!invoice.due_date && new Date(invoice.due_date) < new Date();
    const statusBadge = isOverdue
      ? { label: 'Overdue', className: 'bg-red-50 text-red-700 ring-red-200' }
      : ({
          paid: { label: 'Paid', className: 'bg-green-50 text-green-700 ring-green-200' },
          partial: { label: 'Partially paid', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
          sent: { label: 'Awaiting payment', className: 'bg-sky-50 text-sky-800 ring-sky-200' },
          void: { label: 'Void', className: 'bg-muted text-muted-foreground ring-border' },
        } as Record<string, { label: string; className: string }>)[invoice.status]
        ?? { label: invoice.status.replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase()), className: 'bg-muted text-muted-foreground ring-border' };
    const paymentDetails = [
      invoiceSettings?.bank_account_name && ['Account name', invoiceSettings.bank_account_name],
      invoiceSettings?.account_number && ['Account number', invoiceSettings.account_number],
      invoiceSettings?.ifsc_code && ['IFSC', invoiceSettings.ifsc_code],
      invoiceSettings?.swift_code && ['SWIFT', invoiceSettings.swift_code],
      invoiceSettings?.upi_id && ['UPI', invoiceSettings.upi_id],
    ].filter(Boolean) as [string, string][];

    const handleExportInvoicePdf = async () => {
      setIsExporting(true);
      const toastId = toast.loading('Generating PDF...');
      try {
        const bankRows = [
          invoiceSettings?.bank_account_name ? `<div>${escapeInvoiceHtml(invoiceSettings.bank_account_name)}</div>` : '',
          invoiceSettings?.account_number ? `<div>Account: #${escapeInvoiceHtml(invoiceSettings.account_number)}</div>` : '',
          invoiceSettings?.swift_code ? `<div>SWIFT: ${escapeInvoiceHtml(invoiceSettings.swift_code)}</div>` : '',
          invoiceSettings?.ifsc_code ? `<div>IFSC: ${escapeInvoiceHtml(invoiceSettings.ifsc_code)}</div>` : '',
          invoiceSettings?.pan ? `<div>PAN: ${escapeInvoiceHtml(invoiceSettings.pan)}</div>` : '',
          invoiceSettings?.upi_id ? `<div>UPI: ${escapeInvoiceHtml(invoiceSettings.upi_id)}</div>` : '',
        ].filter(Boolean).join('');
        const termsItems = (invoiceSettings?.terms_and_conditions || '').split('\n').map((l) => l.trim()).filter(Boolean);

        const html = `
          <div style="font-family: Poppins, sans-serif; padding: 40px; max-width: 760px; color: #1f2937; font-size: 13px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                ${branding?.company_logo_url ? `<img src="${escapeInvoiceHtml(branding.company_logo_url)}" alt="Logo" style="max-height:56px; margin-bottom:8px;" />` : ''}
                <div style="font-weight:700; font-size:16px;">${escapeInvoiceHtml(branding?.company_name || '')}</div>
                ${branding?.company_address ? `<div style="color:#6b7280; white-space:pre-line; margin-top:4px;">${escapeInvoiceHtml(branding.company_address)}</div>` : ''}
                ${branding?.support_email ? `<div style="color:#6b7280; margin-top:4px;">${escapeInvoiceHtml(branding.support_email)}</div>` : ''}
              </div>
              <div style="text-align:right;">
                <div style="font-size:20px; font-weight:700;"># ${escapeInvoiceHtml(invoice.invoice_number)}</div>
                <div style="margin-top:12px; color:#6b7280; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Balance Due</div>
                <div style="font-size:22px; font-weight:700; color:#c0392b;">${balanceDue != null ? formatCurrency(balanceDue) : '—'}</div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; margin-top:32px;">
              <div>
                <div style="font-weight:700; margin-bottom:4px;">${escapeInvoiceHtml(invoice.client_name || '')}${invoice.company_name ? ` (${escapeInvoiceHtml(invoice.company_name)})` : ''}</div>
                ${invoice.client_address ? `<div style="color:#6b7280; white-space:pre-line;">${escapeInvoiceHtml(invoice.client_address)}</div>` : ''}
              </div>
              <table style="font-size:13px;">
                <tr><td style="padding:2px 12px 2px 0; color:#6b7280;">Invoice Date:</td><td style="padding:2px 0; text-align:right; font-weight:600;">${format(new Date(invoice.issued_date), 'dd/MM/yyyy')}</td></tr>
                ${invoice.payment_terms ? `<tr><td style="padding:2px 12px 2px 0; color:#6b7280;">Terms:</td><td style="padding:2px 0; text-align:right; font-weight:600;">${escapeInvoiceHtml(paymentTermsLabel[invoice.payment_terms] || invoice.payment_terms)}</td></tr>` : ''}
                ${invoice.due_date ? `<tr><td style="padding:2px 12px 2px 0; color:#6b7280;">Due Date:</td><td style="padding:2px 0; text-align:right; font-weight:600;">${format(new Date(invoice.due_date), 'dd/MM/yyyy')}</td></tr>` : ''}
              </table>
            </div>

            <div style="margin-top:24px;">${tableHtml}</div>

            ${invoice.total_amount != null ? `<p style="text-align:right; margin-top:8px; color:#6b7280; font-size:12px;">Total In Words: <strong style="color:#1f2937;">Indian Rupee ${escapeInvoiceHtml(numberToIndianWords(invoice.total_amount))} Only</strong></p>` : ''}

            <p style="margin-top:32px; color:#374151;">Thank you for your business! Please make the payment by the due date noted above. ${escapeInvoiceHtml(invoiceSettings?.payment_instructions || '')}</p>

            ${bankRows ? `
            <div style="margin-top:16px;">
              <div style="font-weight:700; margin-bottom:4px;">Bank Transfer Details</div>
              <div style="color:#374151;">${bankRows}</div>
            </div>` : ''}

            ${invoice.notes ? `<p style="margin-top:16px; color:#6b7280;">${escapeInvoiceHtml(invoice.notes)}</p>` : ''}

            ${termsItems.length > 0 ? `
            <div style="margin-top:24px; padding-top:16px; border-top:1px solid #e5e7eb; font-size:11px; color:#6b7280;">
              <div style="font-weight:700; margin-bottom:6px;">Terms and Conditions</div>
              <ol style="margin:0; padding-left:18px;">
                ${termsItems.map((t) => `<li style="margin-bottom:4px;">${escapeInvoiceHtml(t)}</li>`).join('')}
              </ol>
            </div>` : ''}
          </div>
        `;
        await exportToPdf(html, `${invoice.invoice_number}.pdf`);
        toast.success('PDF downloaded successfully', { id: toastId });
      } catch {
        toast.error('Failed to generate PDF', { id: toastId });
      } finally {
        setIsExporting(false);
      }
    };

    return (
      <div className="min-h-screen" style={{ background: `linear-gradient(180deg, ${primaryColor}06 0%, hsl(var(--background)) 40%)` }}>
        {portalHead}
        <div className="mx-auto max-w-2xl px-4 py-10">
          {branding?.company_name && (
            <p className="mb-6 text-center text-sm font-medium text-muted-foreground">{branding.company_name}</p>
          )}
          <Card className="shadow-lg">
            <CardContent className="space-y-6 p-4 sm:p-6 lg:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-foreground">Invoice <span className="whitespace-nowrap">{invoice.invoice_number}</span></h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Issued {format(new Date(invoice.issued_date), 'MMMM d, yyyy')}
                    {invoice.due_date && ` · Due ${format(new Date(invoice.due_date), 'MMMM d, yyyy')}`}
                  </p>
                </div>
                <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${statusBadge.className}`}>
                  {statusBadge.label}
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill to</p>
                <p className="mt-1 text-sm text-foreground">{invoice.client_name}{invoice.company_name ? ` (${invoice.company_name})` : ''}</p>
              </div>

              {invoice.cost_breakdown && (
                <div
                  className="overflow-x-auto text-sm [&_table]:w-full"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(portalTableHtml) }}
                />
              )}

              {balanceDue != null && (
                <div className="ml-auto w-full max-w-xs space-y-1.5 border-t pt-4 text-sm">
                  {(invoice.amount_paid ?? 0) > 0 && (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Invoice total</span><span>{formatCurrency(invoice.total_amount!)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Paid</span><span>−{formatCurrency(invoice.amount_paid ?? 0)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-base font-bold text-foreground">
                    <span>Balance due</span><span>{formatCurrency(balanceDue)}</span>
                  </div>
                </div>
              )}

              {balanceDue != null && balanceDue > 0 && invoice.status !== 'void' && (paymentDetails.length > 0 || invoiceSettings?.payment_instructions) && (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <p className="mb-2 font-semibold text-foreground">How to pay</p>
                  {invoiceSettings?.payment_instructions && (
                    <p className="mb-2 text-muted-foreground">{invoiceSettings.payment_instructions}</p>
                  )}
                  {paymentDetails.length > 0 && (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                      {paymentDetails.map(([label, value]) => (
                        <div key={label} className="contents">
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="break-all font-medium text-foreground">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )}

              {invoice.notes && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{invoice.notes}</p>
              )}

              <Button onClick={handleExportInvoicePdf} disabled={isExporting} className="w-full" style={{ backgroundColor: primaryColor }}>
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download PDF
              </Button>

              {renderCommentsSection()}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!proposal) return null;

  const isExpired = proposal.validity_date && new Date(proposal.validity_date) < new Date();
  const canRespond = ['sent', 'draft'].includes(proposal.status) && !isExpired && !responded;
  const hasResponded = ['approved', 'rejected', 'change_requested'].includes(proposal.status) || responded;

  const getRenderedContent = () => {
    if (!template?.content) return null;
    const proposalData: ProposalData = {
      title: proposal.title,
      clientName: proposal.client_name || '',
      clientDesignation: proposal.client_designation || '',
      clientEmail: proposal.client_email || '',
      clientPhone: proposal.client_phone || '',
      companyName: proposal.company_name || '',
      companyAddress: proposal.client_address || '',
      projectName: proposal.project_name || '',
      projectWebsite: '',
      customerGoals: proposal.customer_goals || '',
      scopeOfWork: proposal.scope_of_work || '',
      costBreakdown: proposal.cost_breakdown || '',
      validityDate: proposal.validity_date || '',
      duration: proposal.duration || '',
      createdAt: proposal.created_at,
      approvedDate: proposal.status === 'approved' ? '' : '',
      contractType: (proposal as any).contract_type || '',
      renewalFrequency: (proposal as any).renewal_frequency || '',
      startDate: (proposal as any).start_date || '',
      endDate: (proposal as any).end_date || '',
      clientSignature: (proposal as any).client_signature || '',
      clientSignatureImageUrl: (proposal as any).client_signature_image_url || '',
      mySignature: (proposal as any).my_signature || '',
    };
    return replacePlaceholders(template.content, proposalData, false);
  };

  const renderedContent = getRenderedContent();

  const handleExportPdf = async () => {
    if (!renderedContent) return;
    setIsExporting(true);
    const toastId = toast.loading('Generating PDF...');
    try {
      const filename = `${proposal.title.replace(/[^a-z0-9]/gi, '_')}_proposal.pdf`;
      await exportToPdf(renderedContent, filename);
      toast.success('PDF downloaded successfully', { id: toastId });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(180deg, ${primaryColor}06 0%, hsl(var(--background)) 40%)` }}>
      <Helmet>
        <title>{proposal?.title ? `${proposal.title} — Client Portal` : 'Client Portal — Clientra'}</title>
        <meta name="description" content="Secure client portal to review and respond to the proposal or contract shared with you." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Top branded bar */}
      <div className="w-full py-4 px-6 border-b border-border/40 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding?.company_logo_url ? (
              <img
                src={branding.company_logo_url}
                alt={branding.company_name || 'Company logo'}
                className="h-8 w-auto max-w-[160px] object-contain"
              />
            ) : branding?.company_name ? (
              <span className="text-lg font-semibold text-foreground">{branding.company_name}</span>
            ) : (
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" style={{ color: primaryColor }} />
                <span className="text-lg font-semibold text-foreground capitalize">{documentType}</span>
              </div>
            )}
            {branding?.tagline && (
              <span className="hidden sm:inline text-xs text-muted-foreground border-l border-border pl-3 ml-1">{branding.tagline}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {renderedContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={isExporting}
                className="text-xs"
              >
                {isExporting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                )}
                Download PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Status Banners */}
        {hasResponded && (
          <div
            className="rounded-xl p-4 flex items-center justify-center gap-3 text-sm font-medium shadow-sm"
            style={{
              backgroundColor: proposal.status === 'approved' ? '#f0fdf4' : proposal.status === 'change_requested' ? '#fffbeb' : '#fef2f2',
              border: `1px solid ${proposal.status === 'approved' ? '#bbf7d0' : proposal.status === 'change_requested' ? '#fde68a' : '#fecaca'}`,
              color: proposal.status === 'approved' ? '#166534' : proposal.status === 'change_requested' ? '#92400e' : '#991b1b',
            }}
          >
            {proposal.status === 'approved' ? (
              <>
                <ShieldCheck className="h-5 w-5" />
                <span>{documentType === 'contract' ? 'This contract has been signed' : 'This proposal has been approved'}</span>
              </>
            ) : proposal.status === 'change_requested' ? (
              <>
                <Clock className="h-5 w-5" />
                <span>Changes have been requested for this {documentType}</span>
              </>
            ) : (
              <>
                <ShieldX className="h-5 w-5" />
                <span>This {documentType} has been declined</span>
              </>
            )}
          </div>
        )}

        {isExpired && proposal.status === 'sent' && (
          <div
            className="rounded-xl p-4 flex items-center justify-center gap-3 text-sm font-medium shadow-sm"
            style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
            }}
          >
            <Clock className="h-5 w-5" />
            <span>This {documentType} has expired</span>
          </div>
        )}

        {/* Proposal Content */}
        <div className="bg-card rounded-xl shadow-sm border border-border/60 overflow-hidden">
          <div className="p-6 sm:p-10">
            {renderedContent ? (
              <div
                className="prose prose-sm sm:prose-base max-w-none text-foreground
                  prose-headings:text-foreground prose-headings:font-bold
                  prose-p:text-foreground/90
                  prose-strong:text-foreground
                  prose-li:text-foreground/90
                  prose-td:text-foreground/80
                  prose-th:text-foreground
                  [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm max-sm:[&_table]:block max-sm:[&_table]:overflow-x-auto
                  [&_th]:bg-muted/30 [&_th]:border-b-2 [&_th]:border-border [&_th]:py-2.5 [&_th]:px-3
                  [&_td]:border-b [&_td]:border-border/40 [&_td]:py-2.5 [&_td]:px-3
                  [&_tfoot_td]:font-semibold [&_tfoot_td]:border-t-2 [&_tfoot_td]:border-border
                  [&_hr]:border-border/40"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderedContent) }}
              />
            ) : (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-foreground">{proposal.title}</h1>
                {proposal.project_name && (
                  <p className="text-muted-foreground">Project: {proposal.project_name}</p>
                )}
                {proposal.scope_of_work && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Scope of Work</h3>
                    <div
                      className="bg-muted/20 rounded-lg p-5 prose prose-sm max-w-none text-foreground"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(proposal.scope_of_work) }}
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-6 pt-4 border-t border-border/40">
                  {proposal.validity_date && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valid Until</p>
                      <p className="text-sm font-medium mt-1 text-foreground">
                        {format(new Date(proposal.validity_date), 'MMMM dd, yyyy')}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sent On</p>
                    <p className="text-sm font-medium mt-1 text-foreground">
                      {format(new Date(proposal.created_at), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons inside the card */}
          {canRespond && (
            <div
              className="px-6 sm:px-10 py-5 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4"
              style={{ backgroundColor: `${primaryColor}04` }}
            >
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Please review the {documentType} above and approve or decline.
              </p>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-3">
                <Button
                  onClick={() => setConfirmAction('reject')}
                  variant="outline"
                  disabled={submitting}
                >
                  <X className="mr-1.5 h-4 w-4" />
                  Decline
                </Button>
                <Button
                  onClick={() => setConfirmAction('request_changes')}
                  variant="outline"
                  disabled={submitting}
                >
                  <Clock className="mr-1.5 h-4 w-4" />
                  Request Changes
                </Button>
                <Button
                  onClick={() => setConfirmAction('approve')}
                  className="col-span-2 order-first sm:order-none sm:px-6 text-white font-semibold shadow-md hover:shadow-lg transition-shadow"
                  style={{ backgroundColor: primaryColor }}
                  disabled={submitting}
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  Approve
                </Button>
              </div>
            </div>
          )}

          <div className="px-6 sm:px-10 pb-8">{renderCommentsSection()}</div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-3 pt-4 pb-8">
          {(branding?.support_email || branding?.website_url) && (
            <div className="flex items-center justify-center gap-4 text-xs">
              {branding.support_email && (
                <a
                  href={`mailto:${branding.support_email}`}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {branding.support_email}
                </a>
              )}
              {branding.website_url && (
                <a
                  href={branding.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Visit Website
                </a>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Questions? Contact the sender directly for assistance.
          </p>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => { setConfirmAction(null); setSignatureName(''); signaturePadRef.current?.clear(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'approve' ? `Approve this ${documentType}?` : confirmAction === 'request_changes' ? `Request changes to this ${documentType}?` : `Decline this ${documentType}?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {confirmAction === 'approve'
                    ? `By approving, you agree to the terms and pricing outlined in this ${documentType}. This action cannot be undone.`
                    : confirmAction === 'request_changes'
                    ? 'Please describe what changes you would like. The sender will be notified.'
                    : `Are you sure you want to decline this ${documentType}? The sender will be notified of your decision.`}
                </p>
                {confirmAction === 'approve' && documentType === 'contract' && (
                  <div className="space-y-3 text-left">
                    <div className="space-y-2">
                      <label htmlFor="portal-signature-name" className="text-sm font-medium text-foreground">Your full name (as signature) *</label>
                      <Input
                        id="portal-signature-name"
                        placeholder="Enter your full name"
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                        className="text-base"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Draw your signature (optional)</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => signaturePadRef.current?.clear()}>
                          <Eraser className="mr-1 h-3 w-3" />
                          Clear
                        </Button>
                      </div>
                      <div className="rounded-md border bg-white">
                        <SignatureCanvas
                          ref={signaturePadRef}
                          penColor="#111827"
                          canvasProps={{ className: 'w-full h-32' }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your typed name is required and used as the signature of record; the drawn signature (if provided) is shown alongside it.
                    </p>
                  </div>
                )}
                {confirmAction === 'request_changes' && (
                  <Textarea
                    placeholder="Describe the changes you'd like..."
                    value={changeNotes}
                    onChange={(e) => setChangeNotes(e.target.value)}
                    className="min-h-[100px]"
                  />
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} onClick={() => { setChangeNotes(''); setSignatureName(''); signaturePadRef.current?.clear(); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && handleAction(confirmAction)}
              disabled={submitting || (confirmAction === 'request_changes' && !changeNotes.trim()) || (confirmAction === 'approve' && documentType === 'contract' && !signatureName.trim())}
              style={confirmAction === 'approve' ? { backgroundColor: primaryColor } : undefined}
              className={confirmAction === 'reject' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmAction === 'approve' ? (documentType === 'contract' ? 'Sign contract' : 'Approve proposal') : confirmAction === 'request_changes' ? 'Send request' : 'Decline'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
