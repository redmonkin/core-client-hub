import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { FileText, Check, X, Loader2, AlertCircle, Clock, Globe, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { replacePlaceholders, ProposalData } from '@/lib/proposal-utils';

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

  const primaryColor = branding?.primary_color || '#8B5CF6';

  useEffect(() => {
    if (!token) {
      setError('Invalid link. Please use the link provided in your email.');
      setLoading(false);
      return;
    }

    fetchProposal();
  }, [token]);

  const fetchProposal = async () => {
    try {
      const response = await fetch(
        `https://jizouqjrdyfshhztqucd.supabase.co/functions/v1/client-portal?token=${token}`,
        { method: 'GET' }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load proposal');
      }

      setProposal(result.proposal);
      setBranding(result.branding);
      setTemplate(result.template);
    } catch (err: any) {
      console.error('Error fetching proposal:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!token) return;
    
    setSubmitting(true);
    try {
      const response = await fetch(
        `https://jizouqjrdyfshhztqucd.supabase.co/functions/v1/client-portal`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, action }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update proposal');
      }

      setResponded(true);
      setProposal(prev => prev ? { ...prev, status: result.status } : null);
      toast.success(action === 'approve' ? 'Proposal approved!' : 'Proposal rejected');
    } catch (err: any) {
      console.error('Error updating proposal:', err);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: primaryColor }} />
          <p className="text-muted-foreground">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Unable to Load Proposal</h2>
                <p className="text-muted-foreground mt-2">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!proposal) return null;

  const isExpired = proposal.validity_date && new Date(proposal.validity_date) < new Date();
  const canRespond = proposal.status === 'sent' && !isExpired && !responded;

  // Build the rendered template content
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
    };

    return replacePlaceholders(template.content, proposalData, false);
  };

  const renderedContent = getRenderedContent();

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Branded Header */}
        <div className="text-center">
          {branding?.company_logo_url ? (
            <div className="inline-flex items-center justify-center mb-4">
              <img 
                src={branding.company_logo_url} 
                alt={branding.company_name || 'Company logo'} 
                className="h-16 w-auto max-w-[200px] object-contain"
              />
            </div>
          ) : (
            <div 
              className="inline-flex items-center justify-center h-16 w-16 rounded-full mb-4"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <FileText className="h-8 w-8" style={{ color: primaryColor }} />
            </div>
          )}
          
          {branding?.company_name && (
            <h2 className="text-lg font-semibold" style={{ color: primaryColor }}>
              {branding.company_name}
            </h2>
          )}
          {branding?.tagline && (
            <p className="text-sm text-muted-foreground">{branding.tagline}</p>
          )}
        </div>

        {/* Status Banner */}
        {(proposal.status === 'approved' || proposal.status === 'rejected' || responded) && (
          <Card className={proposal.status === 'approved' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-red-500 bg-red-50 dark:bg-red-950/20'}>
            <CardContent className="py-4">
              <div className="flex items-center justify-center gap-2">
                {proposal.status === 'approved' ? (
                  <>
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-700 dark:text-green-400">This proposal has been approved</span>
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-700 dark:text-red-400">This proposal has been rejected</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {isExpired && proposal.status === 'sent' && (
          <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                <span className="font-medium text-amber-700 dark:text-amber-400">This proposal has expired</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Proposal Content */}
        <Card>
          <CardContent className="p-8">
            {renderedContent ? (
              <div
                className="prose prose-sm max-w-none text-foreground
                  prose-headings:text-foreground
                  prose-p:text-foreground
                  prose-strong:text-foreground
                  prose-li:text-foreground
                  prose-td:text-foreground
                  prose-th:text-foreground
                  [&_table]:w-full [&_table]:border-collapse
                  [&_th]:bg-muted/50 [&_th]:border-b-2 [&_th]:border-border
                  [&_td]:border-b [&_td]:border-border/50"
                dangerouslySetInnerHTML={{ __html: renderedContent }}
              />
            ) : (
              /* Fallback: show raw fields if no template */
              <div className="space-y-6">
                <h2 className="text-xl font-bold">{proposal.title}</h2>
                {proposal.project_name && (
                  <p className="text-muted-foreground">Project: {proposal.project_name}</p>
                )}
                {proposal.scope_of_work && (
                  <div>
                    <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-2">
                      Scope of Work
                    </h3>
                    <div 
                      className="bg-muted/50 rounded-lg p-4 prose prose-sm max-w-none text-foreground"
                      dangerouslySetInnerHTML={{ __html: proposal.scope_of_work }}
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-4 pt-4 border-t">
                  {proposal.validity_date && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valid Until</p>
                      <p className="text-sm font-medium mt-1">
                        {format(new Date(proposal.validity_date), 'MMMM dd, yyyy')}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sent On</p>
                    <p className="text-sm font-medium mt-1">
                      {format(new Date(proposal.created_at), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          {canRespond && (
            <CardFooter className="flex-col sm:flex-row gap-3 bg-muted/30 border-t">
              <Button
                onClick={() => handleAction('reject')}
                variant="outline"
                className="w-full sm:w-auto"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                Decline Proposal
              </Button>
              <Button
                onClick={() => handleAction('approve')}
                className="w-full sm:w-auto"
                style={{ backgroundColor: primaryColor }}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Approve Proposal
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Branded Footer */}
        <div className="text-center space-y-3">
          {(branding?.support_email || branding?.website_url) && (
            <div className="flex items-center justify-center gap-4 text-sm">
              {branding.support_email && (
                <a 
                  href={`mailto:${branding.support_email}`}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="h-4 w-4" />
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
                  <Globe className="h-4 w-4" />
                  Visit Website
                </a>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            If you have any questions, please contact the sender directly.
          </p>
        </div>
      </div>
    </div>
  );
}
