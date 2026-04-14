import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Globe, Mail, Building2, Send, CheckCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

const projectTypeLabels: Record<string, string> = {
  'one-time': 'One-time',
  'amc': 'AMC',
  'retainer': 'Retainer',
};

export default function Portfolio() {
  const { userId } = useParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<'details' | 'questionnaire' | 'success'>('details');
  const [submitting, setSubmitting] = useState(false);

  // Client details form
  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    project_name: '',
    project_type: 'one-time',
  });

  // Questionnaire
  const [questionnaire, setQuestionnaire] = useState<Record<string, string>>({
    'What is the primary goal of this project?': '',
    'What is your estimated budget range?': '',
    'What is your expected timeline?': '',
    'Do you have any specific requirements or preferences?': '',
    'How did you hear about us?': '',
  });

  const { data: branding } = useQuery({
    queryKey: ['portfolio-branding', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_portfolio_branding' as any)
        .select('user_id, company_name, company_logo_url, tagline, primary_color, accent_color, website_url')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as {
        user_id: string;
        company_name: string | null;
        company_logo_url: string | null;
        tagline: string | null;
        primary_color: string | null;
        accent_color: string | null;
        website_url: string | null;
      } | null;
    },
    enabled: !!userId,
  });

  const { data: featuredProjects = [] } = useQuery({
    queryKey: ['portfolio-projects', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, project_type, status, feature_image_url, client_id')
        .eq('user_id', userId!)
        .eq('is_featured', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch client names for featured projects
  const clientIds = [...new Set(featuredProjects.map(p => p.client_id))];
  const { data: clients = [] } = useQuery({
    queryKey: ['portfolio-clients', clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      const { data, error } = await supabase
        .from('public_portfolio_clients' as any)
        .select('id, client_name, company_name')
        .in('id', clientIds);
      if (error) throw error;
      return data as unknown as { id: string; client_name: string; company_name: string | null }[];
    },
    enabled: clientIds.length > 0,
  });

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.company_name || client?.client_name || '';
  };

  const handleSubmitDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name.trim() || !clientForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setStep('questionnaire');
  };

  const handleSubmitQuestionnaire = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('portfolio-onboard', {
        body: {
          user_id: userId,
          name: clientForm.name.trim(),
          email: clientForm.email.trim(),
          phone: clientForm.phone.trim(),
          company_name: clientForm.company_name.trim(),
          project_name: clientForm.project_name.trim(),
          project_type: clientForm.project_type,
          questionnaire: Object.fromEntries(
            Object.entries(questionnaire).filter(([, v]) => v.trim())
          ),
        },
      });
      if (error) throw error;
      setStep('success');
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep('details');
    setClientForm({ name: '', email: '', phone: '', company_name: '', project_name: '', project_type: 'one-time' });
    setQuestionnaire(Object.fromEntries(Object.keys(questionnaire).map(k => [k, ''])));
    setDialogOpen(false);
  };

  const primaryColor = branding?.primary_color || '#8B5CF6';
  const accentColor = branding?.accent_color || '#F59E0B';

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-5">
            {branding?.company_logo_url ? (
              <img src={branding.company_logo_url} alt="Logo" className="h-16 w-16 rounded-xl object-contain" />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {(branding?.company_name || 'C').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {branding?.company_name || 'Our Portfolio'}
              </h1>
              {branding?.tagline && (
                <p className="mt-1 text-lg text-muted-foreground">{branding.tagline}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            {branding?.website_url && (
              <a
                href={branding.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Globe className="h-4 w-4" />
                {branding.website_url.replace(/^https?:\/\//, '')}
              </a>
            )}
            {branding?.support_email && (
              <a
                href={`mailto:${branding.support_email}`}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4" />
                {branding.support_email}
              </a>
            )}
          </div>

          <div className="mt-8">
            <Button
              size="lg"
              onClick={() => setDialogOpen(true)}
              style={{ backgroundColor: primaryColor }}
              className="text-white hover:opacity-90 transition-opacity"
            >
              <Send className="mr-2 h-4 w-4" />
              Request a Proposal
            </Button>
          </div>
        </div>
      </header>

      {/* Projects Grid */}
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-8 text-2xl font-semibold text-foreground">Featured Projects</h2>

        {featuredProjects.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProjects.map((project) => (
              <Card key={project.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                {/* Feature Image */}
                <div className="aspect-video bg-muted/50 flex items-center justify-center overflow-hidden">
                  {project.feature_image_url ? (
                    <img
                      src={project.feature_image_url}
                      alt={project.project_name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <CardContent className="p-5">
                  <h3 className="text-lg font-semibold text-foreground">{project.project_name}</h3>
                  {getClientName(project.client_id) && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      {getClientName(project.client_id)}
                    </p>
                  )}
                  <div className="mt-3">
                    <Badge variant="outline" className="text-xs">
                      {projectTypeLabels[project.project_type] || project.project_type}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">No projects to show yet</p>
            <p className="text-muted-foreground mt-1">Check back soon for our latest work</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {branding?.company_name || 'Company'}. All rights reserved.
        </div>
      </footer>

      {/* Request Proposal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          {step === 'details' && (
            <>
              <DialogHeader>
                <DialogTitle>Request a Proposal</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitDetails} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      value={clientForm.name}
                      onChange={(e) => setClientForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={clientForm.email}
                      onChange={(e) => setClientForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={clientForm.phone}
                      onChange={(e) => setClientForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+91 9876543210"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Input
                      value={clientForm.company_name}
                      onChange={(e) => setClientForm(p => ({ ...p, company_name: e.target.value }))}
                      placeholder="Company name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input
                    value={clientForm.project_name}
                    onChange={(e) => setClientForm(p => ({ ...p, project_name: e.target.value }))}
                    placeholder="e.g. Website Redesign"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project Type</Label>
                  <Select
                    value={clientForm.project_type}
                    onValueChange={(v) => setClientForm(p => ({ ...p, project_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-time">One-time Project</SelectItem>
                      <SelectItem value="amc">Annual Maintenance (AMC)</SelectItem>
                      <SelectItem value="retainer">Retainer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit">Next: Project Details →</Button>
                </div>
              </form>
            </>
          )}

          {step === 'questionnaire' && (
            <>
              <DialogHeader>
                <DialogTitle>Tell us about your project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {Object.keys(questionnaire).map((question) => (
                  <div key={question} className="space-y-2">
                    <Label className="text-sm">{question}</Label>
                    <Textarea
                      value={questionnaire[question]}
                      onChange={(e) => setQuestionnaire(p => ({ ...p, [question]: e.target.value }))}
                      placeholder="Your answer..."
                      className="min-h-[70px] resize-none"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep('details')}>← Back</Button>
                <Button onClick={handleSubmitQuestionnaire} disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                  ) : (
                    <><Send className="mr-2 h-4 w-4" />Submit Request</>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-foreground">Request Submitted!</h3>
              <p className="mt-2 text-muted-foreground max-w-sm">
                Thank you for your interest. We'll review your request and get back to you shortly.
              </p>
              <Button className="mt-6" onClick={resetForm}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
