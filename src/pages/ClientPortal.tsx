import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import { FileText, Check, X, Loader2, AlertCircle, Clock, Globe, Mail, Download, ShieldCheck, ShieldX, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { replacePlaceholders, ProposalData } from '@/lib/proposal-utils';
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
  primary_color: string | null;
  accent_color: string | null;
  tagline: string | null;
  website_url: string | null;
  support_email: string | null;
};

type TemplateData = {
  content: string;
  name: string;
} | null;

export default function ClientPortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [proposal, setProposal] = useState<PortalProposal | null>(null);
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [template, setTemplate] = useState<TemplateData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [responded, setResponded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | 'request_changes' | null>(null);
  const [changeNotes, setChangeNotes] = useState('');
  const [signatureName, setSignatureName] = useState('');
  const [documentType, setDocumentType] = useState<'proposal' | 'contract'>('proposal');
  
  // Password gate state
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
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
      const baseUrl = `https://jizouqjrdyfshhztqucd.supabase.co/functions/v1/client-portal?token=${token}`;
      
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
      
      if (response.status === 403) {
        setPasswordError('Incorrect password. Please try again.');
        setVerifyingPassword(false);
        return;
      }
      
      if (!response.ok) throw new Error(result.error || 'Failed to load proposal');
      
      setProposal(result.proposal);
      setBranding(result.branding);
      setTemplate(result.template);
      setDocumentType(result.document_type || 'proposal');
      setAuthenticated(true);
      setPasswordRequired(false);
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
    await fetchProposal(password.toUpperCase());
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
      const response = await fetch(
        `https://jizouqjrdyfshhztqucd.supabase.co/functions/v1/client-portal`,
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
      const docLabel = documentType === 'contract' ? 'Contract' : 'Proposal';
      const messages: Record<string, string> = {
        approve: `${docLabel} approved successfully!`,
        reject: `${docLabel} declined`,
        request_changes: 'Change request sent successfully!',
      };
      toast.success(messages[action]);
      setChangeNotes('');
      setSignatureName('');
    } catch (err: any) {
      console.error('Error updating proposal:', err);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}08, ${accentColor}05)` }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: primaryColor }} />
          <p className="text-muted-foreground text-sm">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Unable to Load Proposal</h2>
                <p className="text-muted-foreground mt-2 text-sm">{error}</p>
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
        <Card className="max-w-sm w-full shadow-lg">
          <CardContent className="pt-8 pb-8">
            <form onSubmit={handlePasswordSubmit} className="flex flex-col items-center text-center gap-5">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Password Required</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Enter the password provided by the sender to view this proposal.
                </p>
              </div>
              <div className="w-full space-y-3">
                <Input
                  type="text"
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
                    'Access Proposal'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
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
    <div className="min-h-screen" style={{ background: `linear-gradient(180deg, ${primaryColor}06 0%, #ffffff 40%)` }}>
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
                <span className="text-lg font-semibold text-foreground">Proposal</span>
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
                <span>This proposal has been approved</span>
              </>
            ) : proposal.status === 'change_requested' ? (
              <>
                <Clock className="h-5 w-5" />
                <span>Changes have been requested for this proposal</span>
              </>
            ) : (
              <>
                <ShieldX className="h-5 w-5" />
                <span>This proposal has been declined</span>
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
            <span>This proposal has expired</span>
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
                  [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm
                  [&_th]:bg-muted/30 [&_th]:border-b-2 [&_th]:border-border [&_th]:py-2.5 [&_th]:px-3
                  [&_td]:border-b [&_td]:border-border/40 [&_td]:py-2.5 [&_td]:px-3
                  [&_tfoot_td]:font-semibold [&_tfoot_td]:border-t-2 [&_tfoot_td]:border-border
                  [&_hr]:border-border/40"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderedContent) }}
              />
            ) : (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-foreground">{proposal.title}</h2>
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
                Please review the proposal above and approve or decline.
              </p>
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <Button
                  onClick={() => setConfirmAction('reject')}
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={submitting}
                >
                  <X className="mr-1.5 h-4 w-4" />
                  Decline
                </Button>
                <Button
                  onClick={() => setConfirmAction('request_changes')}
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={submitting}
                >
                  <Clock className="mr-1.5 h-4 w-4" />
                  Request Changes
                </Button>
                <Button
                  onClick={() => setConfirmAction('approve')}
                  className="flex-1 sm:flex-none sm:px-6 text-white font-semibold shadow-md hover:shadow-lg transition-shadow"
                  style={{ backgroundColor: primaryColor }}
                  disabled={submitting}
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  Approve
                </Button>
              </div>
            </div>
          )}
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
      <AlertDialog open={!!confirmAction} onOpenChange={() => { setConfirmAction(null); setSignatureName(''); }}>
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
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Your Full Name (as signature) *</label>
                    <Input
                      placeholder="Enter your full name"
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      className="text-base"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                      Your name will appear as the digital signature on this contract.
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
            <AlertDialogCancel disabled={submitting} onClick={() => { setChangeNotes(''); setSignatureName(''); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && handleAction(confirmAction)}
              disabled={submitting || (confirmAction === 'request_changes' && !changeNotes.trim()) || (confirmAction === 'approve' && documentType === 'contract' && !signatureName.trim())}
              style={confirmAction === 'approve' ? { backgroundColor: primaryColor } : undefined}
              className={confirmAction === 'reject' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmAction === 'approve' ? 'Yes, Approve' : confirmAction === 'request_changes' ? 'Send Request' : 'Yes, Decline'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
