import { useEffect, useState, useRef } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceUser } from "@/hooks/useWorkspaceUser";
import { Loader2, Upload, Trash2, Palette, Globe, Building2, Mail } from "lucide-react";
import { TeamManagement } from "@/components/settings/TeamManagement";

interface BrandingSettings {
  id?: string;
  company_name: string;
  company_logo_url: string;
  primary_color: string;
  accent_color: string;
  tagline: string;
  website_url: string;
  support_email: string;
  slug: string;
}

const defaultBranding: BrandingSettings = {
  company_name: "",
  company_logo_url: "",
  primary_color: "#8B5CF6",
  accent_color: "#F59E0B",
  tagline: "",
  website_url: "",
  support_email: "",
  slug: "",
};

export default function Settings() {
  const { user } = useAuth();
  const { workspaceUserId, loading: workspaceLoading } = useWorkspaceUser();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Branding state
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || workspaceLoading || !workspaceUserId) return;
    fetchBranding();
  }, [user, workspaceLoading, workspaceUserId]);

  const fetchBranding = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !workspaceUserId) return;

      const { data, error } = await supabase
        .from("branding_settings")
        .select("*")
        .eq("user_id", workspaceUserId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setBranding({
          id: data.id,
          company_name: data.company_name || "",
          company_logo_url: data.company_logo_url || "",
          primary_color: data.primary_color || "#8B5CF6",
          accent_color: data.accent_color || "#F59E0B",
          tagline: data.tagline || "",
          website_url: data.website_url || "",
          support_email: data.support_email || "",
          slug: ((data as any).slug as string) || "",
        });
      }
    } catch (error) {
      console.error("Error fetching branding:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Please upload an image file", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Error", description: "Image must be less than 2MB", variant: "destructive" });
      return;
    }

    setUploadingLogo(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `logo.${fileExt}`;
      const filePath = `${user.id}/branding/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const logoUrlWithCache = `${publicUrl}?t=${Date.now()}`;
      setBranding(prev => ({ ...prev, company_logo_url: logoUrlWithCache }));

      toast({ title: "Logo Uploaded", description: "Your company logo has been uploaded" });
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast({ title: "Error", description: error.message || "Failed to upload logo", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setBranding(prev => ({ ...prev, company_logo_url: "" }));
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBranding(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const brandingData: any = {
        user_id: workspaceUserId!,
        company_name: branding.company_name || null,
        company_logo_url: branding.company_logo_url || null,
        primary_color: branding.primary_color,
        accent_color: branding.accent_color,
        tagline: branding.tagline || null,
        website_url: branding.website_url || null,
        support_email: branding.support_email || null,
        slug: branding.slug ? branding.slug.trim().toLowerCase() : null,
      };

      const { error } = await supabase
        .from("branding_settings")
        .upsert(brandingData, { onConflict: "user_id" });

      if (error) throw error;

      toast({ title: "Branding Saved", description: "Your client portal branding has been updated" });
    } catch (error: any) {
      console.error("Error saving branding:", error);
      toast({ title: "Error", description: error.message || "Failed to save branding settings", variant: "destructive" });
    } finally {
      setSavingBranding(false);
    }
  };

  if (loading || workspaceLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Workspace Settings"
        description="Manage your workspace, team, and client portal branding"
      />

      {/* Team Management */}
      <TeamManagement />

      {/* Client Portal Branding */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Client Portal Branding</CardTitle>
          </div>
          <CardDescription>
            Customize how your client portal appears to clients
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveBranding} className="space-y-6">
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Company Logo</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50 overflow-hidden">
                  {branding.company_logo_url ? (
                    <img
                      src={branding.company_logo_url}
                      alt="Company logo"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="gap-2"
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Upload Logo
                    </Button>
                    {branding.company_logo_url && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveLogo}
                        className="gap-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG or SVG. Max 2MB. Recommended: 200x200px
                  </p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Company Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="companyName"
                    placeholder="Your Company Name"
                    value={branding.company_name}
                    onChange={(e) => setBranding(prev => ({ ...prev, company_name: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  placeholder="Your company tagline"
                  value={branding.tagline}
                  onChange={(e) => setBranding(prev => ({ ...prev, tagline: e.target.value }))}
                />
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website URL</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="websiteUrl"
                    type="url"
                    placeholder="https://yourcompany.com"
                    value={branding.website_url}
                    onChange={(e) => setBranding(prev => ({ ...prev, website_url: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Support Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="supportEmail"
                    type="email"
                    placeholder="support@yourcompany.com"
                    value={branding.support_email}
                    onChange={(e) => setBranding(prev => ({ ...prev, support_email: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Brand Colors */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    id="primaryColor"
                    value={branding.primary_color}
                    onChange={(e) => setBranding(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="h-10 w-14 rounded border border-input cursor-pointer"
                  />
                  <Input
                    value={branding.primary_color}
                    onChange={(e) => setBranding(prev => ({ ...prev, primary_color: e.target.value }))}
                    placeholder="#8B5CF6"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accentColor">Accent Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    id="accentColor"
                    value={branding.accent_color}
                    onChange={(e) => setBranding(prev => ({ ...prev, accent_color: e.target.value }))}
                    className="h-10 w-14 rounded border border-input cursor-pointer"
                  />
                  <Input
                    value={branding.accent_color}
                    onChange={(e) => setBranding(prev => ({ ...prev, accent_color: e.target.value }))}
                    placeholder="#F59E0B"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg border p-4 space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Preview</Label>
              <div className="flex items-center gap-3">
                {branding.company_logo_url ? (
                  <img src={branding.company_logo_url} alt="Logo preview" className="h-10 w-10 object-contain" />
                ) : (
                  <div 
                    className="h-10 w-10 rounded flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: branding.primary_color }}
                  >
                    {branding.company_name ? branding.company_name.charAt(0).toUpperCase() : "C"}
                  </div>
                )}
                <div>
                  <p className="font-semibold" style={{ color: branding.primary_color }}>
                    {branding.company_name || "Your Company Name"}
                  </p>
                  {branding.tagline && (
                    <p className="text-xs text-muted-foreground">{branding.tagline}</p>
                  )}
                </div>
              </div>
            </div>

            <Button type="submit" disabled={savingBranding}>
              {savingBranding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Branding"
              )}
            </Button>

            {/* Portfolio Link & Slug */}
            {workspaceUserId && (() => {
              const slugValue = (branding.slug || "").trim().toLowerCase();
              const portfolioPath = slugValue || workspaceUserId;
              const portfolioUrl = `${window.location.origin}/portfolio/${portfolioPath}`;
              return (
                <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <div>
                    <Label htmlFor="portfolioSlug" className="text-xs text-muted-foreground uppercase tracking-wide">
                      Portfolio URL Slug
                    </Label>
                    <div className="mt-2 flex items-center gap-0">
                      <span className="inline-flex items-center h-10 px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground whitespace-nowrap">
                        {window.location.origin.replace(/^https?:\/\//, "")}/portfolio/
                      </span>
                      <Input
                        id="portfolioSlug"
                        value={branding.slug}
                        onChange={(e) =>
                          setBranding(prev => ({
                            ...prev,
                            slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                          }))
                        }
                        placeholder="your-brand"
                        maxLength={40}
                        className="rounded-l-none"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      3–40 lowercase letters, numbers or hyphens. Save branding to apply.
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Public Portfolio Link</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        readOnly
                        value={portfolioUrl}
                        className="text-sm bg-background"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(portfolioUrl);
                          toast({ title: "Copied!", description: "Portfolio link copied to clipboard" });
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Share this link so clients can view your portfolio and request proposals.
                    </p>
                  </div>
                </div>
              );
            })()}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
