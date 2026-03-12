import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Loader2, FileText, Clock, CheckCircle2, XCircle, Send, PenLine, MessageSquare, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Separator } from '@/components/ui/separator';
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
import { toast } from 'sonner';

const statusIconMap: Record<string, React.ElementType> = {
  draft: PenLine,
  sent: Send,
  approved: CheckCircle2,
  rejected: XCircle,
  change_requested: MessageSquare,
};

const statusColorMap: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/10 text-primary',
  approved: 'bg-green-500/10 text-green-600',
  rejected: 'bg-destructive/10 text-destructive',
  change_requested: 'bg-orange-500/10 text-orange-600',
};

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { data: proposal, isLoading: proposalLoading, refetch: refetchProposal } = useQuery({
    queryKey: ['proposal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: client } = useQuery({
    queryKey: ['client', proposal?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, company_name, email')
        .eq('id', proposal!.client_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!proposal?.client_id,
  });

  const { data: project } = useQuery({
    queryKey: ['project', proposal?.project_id],
    queryFn: async () => {
      if (!proposal?.project_id) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name')
        .eq('id', proposal.project_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!proposal?.project_id,
  });

  const { data: statusHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['proposal-status-history', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_status_history')
        .select('*')
        .eq('proposal_id', id!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleSendEmail = () => {
    if (!client?.email) {
      toast.error('This client does not have an email address configured');
      return;
    }
    setIsSendDialogOpen(true);
  };

  const confirmSendEmail = async () => {
    if (!proposal || !client?.email) return;
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-proposal-email', {
        body: {
          proposalId: proposal.id,
          clientEmail: client.email,
          clientName: client.client_name,
          proposalTitle: proposal.title,
          scopeOfWork: proposal.scope_of_work,
          costBreakdown: proposal.cost_breakdown,
          validityDate: proposal.validity_date,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send email');

      if (proposal.status === 'draft') {
        await supabase
          .from('proposals')
          .update({ status: 'sent' })
          .eq('id', proposal.id);
        refetchProposal();
      }

      toast.success(`Proposal sent to ${client.email}`);
      setIsSendDialogOpen(false);
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  if (proposalLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Proposal not found.</p>
        <Link to="/proposals">
          <Button variant="outline" className="mt-4">Back to Proposals</Button>
        </Link>
      </div>
    );
  }

  // Build a combined timeline: creation + status history
  const timelineItems = [
    {
      id: 'created',
      status: 'draft',
      note: 'Proposal created',
      created_at: proposal.created_at,
      from_status: null as string | null,
      to_status: 'draft',
    },
    ...statusHistory.map((h: any) => ({
      id: h.id,
      status: h.to_status,
      note: h.note,
      created_at: h.created_at,
      from_status: h.from_status,
      to_status: h.to_status,
    })),
  ];

  return (
    <div className="space-y-6 p-8">
      {/* Back button & header */}
      <div className="flex items-center gap-4">
        <Link to="/proposals">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{proposal.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            {client && (
              <Link to={`/clients/${client.id}`} className="hover:text-primary transition-colors">
                {client.client_name}
              </Link>
            )}
            {project && (
              <>
                <span>·</span>
                <Link to={`/projects/${project.id}`} className="hover:text-primary transition-colors">
                  {project.project_name}
                </Link>
              </>
            )}
          </div>
        </div>
        <Button onClick={handleSendEmail} variant="default" size="sm">
          <Mail className="mr-2 h-4 w-4" />
          Send to Client
        </Button>
        <StatusBadge status={proposal.status as any} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={proposal.status as any} />
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(proposal.created_at), 'MMM dd, yyyy')}</span>
            </div>
            {proposal.validity_date && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valid Until</span>
                  <span>{format(new Date(proposal.validity_date), 'MMM dd, yyyy')}</span>
                </div>
              </>
            )}
            {proposal.duration && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span>{proposal.duration}</span>
                </div>
              </>
            )}
            {client?.email && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client Email</span>
                  <span className="text-right truncate max-w-[180px]">{client.email}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Timeline Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Status Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="relative">
                {timelineItems.map((item, index) => {
                  const Icon = statusIconMap[item.to_status] || FileText;
                  const colorClass = statusColorMap[item.to_status] || 'bg-muted text-muted-foreground';
                  const isLast = index === timelineItems.length - 1;

                  return (
                    <div key={item.id} className="flex gap-4 pb-6 last:pb-0">
                      {/* Line + Icon */}
                      <div className="flex flex-col items-center">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {!isLast && (
                          <div className="w-px flex-1 bg-border mt-1" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-1">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={item.to_status as any} />
                          {item.from_status && (
                            <span className="text-xs text-muted-foreground">
                              from <StatusBadge status={item.from_status as any} className="text-[10px] px-1.5 py-0" />
                            </span>
                          )}
                        </div>
                        {item.note && (
                          <p className="mt-1 text-sm text-foreground">{item.note}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(item.created_at), 'MMM dd, yyyy · h:mm a')}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {timelineItems.length <= 1 && !historyLoading && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No status changes recorded yet. Changes will appear here as the proposal progresses.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Send Email Confirmation Dialog */}
      <AlertDialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Proposal to Client</AlertDialogTitle>
            <AlertDialogDescription>
              Send "{proposal.title}" to{' '}
              <strong>{client?.email}</strong>?
              {proposal.status === 'draft' && (
                <span className="block mt-2 text-muted-foreground">
                  The proposal status will be updated to "Sent".
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSendEmail} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Email
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
