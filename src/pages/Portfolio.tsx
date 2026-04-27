import { useRef, useState } from 'react';
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
import { Globe, Building2, Send, CheckCircle, Loader2, Image as ImageIcon, Mail, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';

const BUDGET_OPTIONS = [
  { value: '10k-25k', label: '₹10,000 – ₹25,000' },
  { value: '25k-50k', label: '₹25,000 – ₹50,000' },
  { value: '50k-100k', label: '₹50,000 – ₹1,00,000' },
  { value: '100k-300k', label: '₹1,00,000 – ₹3,00,000' },
  { value: '300k+', label: '₹3,00,000+' },
];

const REFERRAL_OPTIONS = ['Friends', 'Co-Worker', 'At an Event', 'Social Media', 'Others'];

const MAX_FILE_MB = 5;
const ALLOWED_MIME = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const projectTypeLabels: Record<string, string> = {
  'one-time': 'One-time',
  'amc': 'AMC',
  'retainer': 'Retainer',
  'hourly': 'Hourly',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Portfolio() {
  const { userId: routeParam } = useParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<'details' | 'questionnaire' | 'success'>('details');
  const [submitting, setSubmitting] = useState(false);

  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    project_name: '',
    project_type: 'one-time',
  });

  const [questionnaire, setQuestionnaire] = useState({
    primaryGoal: '',
    budget: '',
    timelineWeeks: '',
    requirements: '',
    referral: '',
  });

  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: branding } = useQuery({
    queryKey: ['portfolio-branding', routeParam],
    queryFn: async () => {
      if (!routeParam) return null;
      const isUuid = UUID_RE.test(routeParam);
      const query = supabase
        .from('public_portfolio_branding' as any)
        .select('user_id, slug, company_name, company_logo_url, tagline, primary_color, accent_color, website_url, support_email');
      const { data, error } = isUuid
        ? await query.eq('user_id', routeParam).maybeSingle()
        : await query.eq('slug', routeParam.toLowerCase()).maybeSingle();
      if (error) throw error;
      return data as unknown as {
        user_id: string;
        slug: string | null;
        company_name: string | null;
        company_logo_url: string | null;
        tagline: string | null;
        primary_color: string | null;
        accent_color: string | null;
        website_url: string | null;
        support_email: string | null;
      } | null;
    },
    enabled: !!routeParam,
  });

  // Resolved owner user_id (used for projects + onboarding edge function)
  const userId = branding?.user_id;

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error('Unsupported file type');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`File too large (max ${MAX_FILE_MB}MB)`);
      return;
    }
    setAttachment(file);
  };

  const handleSubmitQuestionnaire = async () => {
    setSubmitting(true);
    try {
      const budgetLabel = BUDGET_OPTIONS.find(o => o.value === questionnaire.budget)?.label || '';
      const timelineText = questionnaire.timelineWeeks
        ? `${questionnaire.timelineWeeks} week${Number(questionnaire.timelineWeeks) === 1 ? '' : 's'}`
        : '';

      const answers: Record<string, string> = {
        'What is the primary goal of this project?': questionnaire.primaryGoal.trim(),
        'What is your estimated budget range?': budgetLabel,
        'What is your expected timeline?': timelineText,
        'Do you have any specific requirements or preferences?': questionnaire.requirements.trim(),
        'How did you hear about us?': questionnaire.referral,
      };

      let attachmentPayload: { name: string; type: string; data: string } | undefined;
      if (attachment) {
        const data = await fileToBase64(attachment);
        attachmentPayload = { name: attachment.name, type: attachment.type, data };
      }

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
            Object.entries(answers).filter(([, v]) => v && v.trim())
          ),
          attachment: attachmentPayload,
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
    setQuestionnaire({ primaryGoal: '', budget: '', timelineWeeks: '', requirements: '', referral: '' });
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setDialogOpen(false);
  };

  const primaryColor = branding?.primary_color || '#8B5CF6';
  const accentColor = branding?.accent_color || '#F59E0B';
  const companyName = branding?.company_name || 'Our Portfolio';

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
      {/* Hero Section */}
      <header
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="flex flex-col items-center text-center gap-6">
            {branding?.company_logo_url ? (
              <img
                src={branding.company_logo_url}
                alt={companyName}
                className="h-20 w-20 rounded-2xl object-contain bg-white/90 p-2 shadow-lg"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold bg-white/90 shadow-lg"
                style={{ color: primaryColor }}>
                {companyName.charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-sm">
                {companyName}
              </h1>
              {branding?.tagline && (
                <p className="mt-3 text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
                  {branding.tagline}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-white/80 text-sm">
              {branding?.website_url && (
                <a
                  href={branding.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors bg-white/10 rounded-full px-4 py-1.5 backdrop-blur-sm"
                >
                  <Globe className="h-4 w-4" />
                  {branding.website_url.replace(/^https?:\/\//, '')}
                </a>
              )}
              {branding?.support_email && (
                <a
                  href={`mailto:${branding.support_email}`}
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors bg-white/10 rounded-full px-4 py-1.5 backdrop-blur-sm"
                >
                  <Mail className="h-4 w-4" />
                  {branding.support_email}
                </a>
              )}
            </div>

            <Button
              size="lg"
              onClick={() => setDialogOpen(true)}
              className="mt-2 bg-white hover:bg-white/90 shadow-lg text-base font-semibold px-8"
              style={{ color: primaryColor }}
            >
              <Send className="mr-2 h-4 w-4" />
              Request a Proposal
            </Button>
          </div>
        </div>
      </header>

      {/* Projects Grid */}
      <main className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="mb-10 text-2xl font-bold text-gray-900">Featured Projects</h2>

        {featuredProjects.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProjects.map((project) => {
              const imageUrl = project.feature_image_url
                ? getStoragePublicUrl(project.feature_image_url)
                : '';
              return (
                <Card key={project.id} className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-0 shadow-md bg-white">
                  <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={project.project_name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-300">
                        <ImageIcon className="h-12 w-12" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-5">
                    <h3 className="text-lg font-semibold text-gray-900">{project.project_name}</h3>
                    {getClientName(project.client_id) && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-500">
                        <Building2 className="h-3.5 w-3.5" />
                        {getClientName(project.client_id)}
                      </p>
                    )}
                    <div className="mt-3">
                      <Badge
                        variant="outline"
                        className="text-xs border-0 font-medium px-3 py-1"
                        style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                      >
                        {projectTypeLabels[project.project_type] || project.project_type}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-700">No projects to show yet</p>
            <p className="text-gray-400 mt-1">Check back soon for our latest work</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} {companyName}. All rights reserved.
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
                      <SelectItem value="hourly">Hourly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" style={{ backgroundColor: primaryColor }} className="text-white">
                    Next: Project Details →
                  </Button>
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
                <div className="space-y-2">
                  <Label className="text-sm">What is the primary goal of this project?</Label>
                  <Textarea
                    value={questionnaire.primaryGoal}
                    onChange={(e) => setQuestionnaire(p => ({ ...p, primaryGoal: e.target.value }))}
                    placeholder="Describe what you want to achieve..."
                    className="min-h-[90px] resize-y"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">What is your estimated budget range?</Label>
                  <Select
                    value={questionnaire.budget}
                    onValueChange={(v) => setQuestionnaire(p => ({ ...p, budget: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a budget range" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUDGET_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Expected timeline (in weeks)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={104}
                      value={questionnaire.timelineWeeks}
                      onChange={(e) => setQuestionnaire(p => ({ ...p, timelineWeeks: e.target.value }))}
                      placeholder="e.g. 4"
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">weeks</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Do you have any specific requirements or preferences?</Label>
                  <Textarea
                    value={questionnaire.requirements}
                    onChange={(e) => setQuestionnaire(p => ({ ...p, requirements: e.target.value }))}
                    placeholder="Share any details, references, must-haves..."
                    className="min-h-[90px] resize-y"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">How did you hear about us?</Label>
                  <Select
                    value={questionnaire.referral}
                    onValueChange={(v) => setQuestionnaire(p => ({ ...p, referral: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {REFERRAL_OPTIONS.map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Attach a file (optional)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={ALLOWED_MIME.join(',')}
                    onChange={handleFileSelect}
                  />
                  {attachment ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{attachment.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({(attachment.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setAttachment(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full justify-start"
                    >
                      <Paperclip className="mr-2 h-4 w-4" />
                      Choose file (max {MAX_FILE_MB}MB)
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Images, PDF, Word, Excel, or text files.
                  </p>
                </div>
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep('details')}>← Back</Button>
                <Button onClick={handleSubmitQuestionnaire} disabled={submitting}
                  style={{ backgroundColor: primaryColor }} className="text-white">
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
              <div className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: `${primaryColor}15` }}>
                <CheckCircle className="h-8 w-8" style={{ color: primaryColor }} />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">Request Submitted!</h3>
              <p className="mt-2 text-gray-500 max-w-sm">
                Thank you for your interest. We'll review your request and get back to you shortly.
              </p>
              <Button className="mt-6" onClick={resetForm} style={{ backgroundColor: primaryColor }} >Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
