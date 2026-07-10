import { useParams, Link } from 'react-router-dom';
import { useState, useRef } from 'react';
import { ArrowLeft, Calendar, FolderKanban, FileText, FileSignature, Receipt, Files, Building2, Clock, StickyNote, Star, StarOff, Upload, Image as ImageIcon, Loader2, X } from 'lucide-react';

import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { ProjectTimesheets } from '@/components/timesheets/ProjectTimesheets';
import { ProjectNotes } from '@/components/notes/ProjectNotes';
import { toast } from 'sonner';

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  amc: 'Annual Maintenance Contract',
  retainer: 'Retainer Contract',
  fixed: 'Fixed Contract',
};

type DocumentItem = {
  id: string;
  kind: 'proposal' | 'contract' | 'invoice';
  title: string;
  subtitle: string;
  status: string;
  href: string;
  sortDate: string;
};

export default function ProjectDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const featureImageRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const { canViewFinancials } = useWorkspaceUser();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });



  const { data: client } = useQuery({
    queryKey: ['project-client', project?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, company_name')
        .eq('id', project!.client_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!project?.client_id,
  });

  const { data: projectProposals = [] } = useQuery({
    queryKey: ['project-proposals', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('project_id', id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: projectContracts = [] } = useQuery({
    queryKey: ['project-contracts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('project_id', id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: projectInvoices = [] } = useQuery({
    queryKey: ['project-invoices', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('project_id', id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: invoiceAmounts = [] } = useQuery({
    queryKey: ['project-invoice-amounts', id, projectInvoices.map((i) => i.id).join(',')],
    queryFn: async () => {
      const ids = projectInvoices.map((i) => i.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase.from('invoice_amounts').select('invoice_id, total_amount').in('invoice_id', ids);
      if (error) throw error;
      return data;
    },
    enabled: projectInvoices.length > 0,
  });
  const invoiceAmountById = new Map(invoiceAmounts.map((a) => [a.invoice_id, a.total_amount]));

  // Unified "Documents" list — proposals, contracts, and invoices for this
  // project, sorted together by recency rather than split across separate
  // near-empty tabs (a project typically only has a handful of each).
  const documents: DocumentItem[] = [
    ...projectProposals.map((p): DocumentItem => ({
      id: p.id,
      kind: 'proposal',
      title: p.title,
      subtitle: p.validity_date ? `Valid until ${format(new Date(p.validity_date), 'MMM d, yyyy')}` : '',
      status: p.status,
      href: `/proposals/${p.id}`,
      sortDate: p.created_at,
    })),
    ...projectContracts.map((c): DocumentItem => ({
      id: c.id,
      kind: 'contract',
      title: CONTRACT_TYPE_LABELS[c.contract_type] || c.contract_type,
      subtitle: `${canViewFinancials ? formatCurrency(Number(c.value)) : '••••••'} · ${format(new Date(c.start_date), 'MMM d')} – ${format(new Date(c.end_date), 'MMM d, yyyy')}`,
      status: c.status,
      href: `/contracts/${c.id}`,
      sortDate: c.created_at,
    })),
    ...projectInvoices.map((inv): DocumentItem => {
      const amount = invoiceAmountById.get(inv.id);
      return {
        id: inv.id,
        kind: 'invoice',
        title: `Invoice ${inv.invoice_number}`,
        subtitle: [
          canViewFinancials ? (amount != null ? formatCurrency(amount) : null) : '••••••',
          inv.due_date ? `Due ${format(new Date(inv.due_date), 'MMM d, yyyy')}` : null,
        ].filter(Boolean).join(' · '),
        status: inv.status,
        href: '/invoices',
        sortDate: inv.created_at,
      };
    }),
  ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

  const DOCUMENT_ICONS: Record<DocumentItem['kind'], typeof FileText> = {
    proposal: FileText,
    contract: FileSignature,
    invoice: Receipt,
  };

  const toggleFeatured = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('projects')
        .update({ is_featured: !project?.is_featured })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      toast.success(project?.is_featured ? 'Removed from portfolio' : 'Added to portfolio');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleFeatureImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }

    setUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Not authenticated'); return; }
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${id}/feature.${ext}`;
      const { error: uploadError } = await supabase.storage.from('project-files').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Store the storage path; we generate signed URLs on demand because the bucket is private.
      const { error } = await supabase.from('projects').update({ feature_image_url: path }).eq('id', id!);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-feature-image', id] });
      toast.success('Feature image updated');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingImage(false);
      if (featureImageRef.current) featureImageRef.current.value = '';
    }
  };

  const removeFeatureImage = async () => {
    const { error } = await supabase.from('projects').update({ feature_image_url: null }).eq('id', id!);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['project', id] });
    queryClient.invalidateQueries({ queryKey: ['project-feature-image', id] });
    toast.success('Feature image removed');
  };

  // Sign the feature image URL (private bucket). Accepts either a raw storage path
  // or a legacy public URL written before the bucket was made private.
  const PUBLIC_PREFIX_RE = /\/storage\/v1\/object\/public\/project-files\//;
  const { data: featureImageSignedUrl } = useQuery({
    queryKey: ['project-feature-image', id, project?.feature_image_url],
    queryFn: async () => {
      const raw = project?.feature_image_url;
      if (!raw) return null;
      let path: string | null = raw;
      if (PUBLIC_PREFIX_RE.test(raw)) {
        path = raw.split(PUBLIC_PREFIX_RE)[1].split('?')[0];
      } else if (/^https?:\/\//i.test(raw)) {
        return raw; // external URL
      } else {
        path = raw.split('?')[0];
      }
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from('project-files')
        .createSignedUrl(path, 60 * 60);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
    enabled: !!project?.feature_image_url,
    staleTime: 50 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">Project not found</h2>
          <Link to="/projects" className="mt-2 text-primary hover:underline">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/projects">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{project.project_name}</h1>
            <StatusBadge status={project.status as any} />
            <Badge variant="secondary" className="capitalize">{project.project_type}</Badge>
          </div>
        </div>
        <Button
          variant={project.is_featured ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleFeatured.mutate()}
          disabled={toggleFeatured.isPending}
          className="gap-2"
        >
          {project.is_featured ? <Star className="h-4 w-4" /> : <StarOff className="h-4 w-4" />}
          {project.is_featured ? 'Featured' : 'Add to Portfolio'}
        </Button>
      </div>

      {/* Feature Image + Project Info */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Feature Image */}
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <Label className="text-sm font-medium text-muted-foreground mb-2 block">Feature Image</Label>
            <div className="aspect-video rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden relative group">
              {project.feature_image_url ? (
                <>
                  <img src={featureImageSignedUrl ?? ''} alt={`${project?.project_name ?? 'Project'} feature image`} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => featureImageRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1" />Replace
                    </Button>
                    <Button size="sm" variant="destructive" onClick={removeFeatureImage}>
                      <X className="h-3.5 w-3.5 mr-1" />Remove
                    </Button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => featureImageRef.current?.click()}
                  className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {uploadingImage ? <Loader2 className="h-8 w-8 animate-spin" /> : <ImageIcon className="h-8 w-8" />}
                  <span className="text-xs">{uploadingImage ? 'Uploading...' : 'Add Feature Image'}</span>
                </button>
              )}
            </div>
            <input ref={featureImageRef} type="file" accept="image/*" onChange={handleFeatureImageUpload} className="hidden" />
          </CardContent>
        </Card>

        {/* Project Info Card */}
        <Card className="lg:col-span-2">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {client && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Client:</span>
                <Link to={`/clients/${client.id}`} className="text-primary hover:underline font-medium">
                  {client.client_name}
                  {client.company_name && ` (${client.company_name})`}
                </Link>
              </div>
            )}
            {project.start_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Start:</span>
                <span className="text-foreground">{format(new Date(project.start_date), 'MMM dd, yyyy')}</span>
              </div>
            )}
            {project.end_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">End:</span>
                <span className="text-foreground">{format(new Date(project.end_date), 'MMM dd, yyyy')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timesheets" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timesheets" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Timesheets
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <Files className="h-4 w-4" />
            Documents ({documents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timesheets" className="mt-4">
          <ProjectTimesheets projectId={id!} />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <ProjectNotes projectId={id!} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="space-y-3">
            {documents.map((doc) => {
              const Icon = DOCUMENT_ICONS[doc.kind];
              return (
                <Link key={`${doc.kind}-${doc.id}`} to={doc.href} className="block">
                  <Card className="transition-all hover:border-primary/20 hover:shadow-sm">
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground hover:text-primary transition-colors">{doc.title}</p>
                          {doc.subtitle && (
                            <p className="mt-1 text-sm text-muted-foreground">{doc.subtitle}</p>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={doc.status as any} />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
            {documents.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No proposals, contracts, or invoices linked to this project</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
