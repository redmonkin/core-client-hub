import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Bell, Eye, CheckCircle, XCircle, Calendar, Loader2, User, Lock, Mail, Trash2, AlertTriangle, Upload, Palette, Globe, Building2 } from "lucide-react";

interface BrandingSettings {
  id?: string;
  company_name: string;
  company_logo_url: string;
  primary_color: string;
  accent_color: string;
  tagline: string;
  website_url: string;
  support_email: string;
}

const defaultBranding: BrandingSettings = {
  company_name: "",
  company_logo_url: "",
  primary_color: "#8B5CF6",
  accent_color: "#F59E0B",
  tagline: "",
  website_url: "",
  support_email: "",
};

interface NotificationPreferences {
  id?: string;
  proposal_viewed: boolean;
  proposal_approved: boolean;
  proposal_rejected: boolean;
  contract_renewal: boolean;
}

const defaultPreferences: NotificationPreferences = {
  proposal_viewed: true,
  proposal_approved: true,
  proposal_rejected: true,
  contract_renewal: true,
};

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile state
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Delete account state
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Branding state
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPreferences();
    fetchBranding();
    if (user) {
      setFullName(user.user_metadata?.full_name || "");
      setAvatarUrl(user.user_metadata?.avatar_url || null);
    }
  }, [user]);

  const fetchBranding = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("branding_settings")
        .select("*")
        .eq("user_id", user.id)
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
        });
      }
    } catch (error) {
      console.error("Error fetching branding:", error);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image must be less than 2MB",
        variant: "destructive",
      });
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

      toast({
        title: "Logo Uploaded",
        description: "Your company logo has been uploaded",
      });
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
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

      const brandingData = {
        user_id: user.id,
        company_name: branding.company_name || null,
        company_logo_url: branding.company_logo_url || null,
        primary_color: branding.primary_color,
        accent_color: branding.accent_color,
        tagline: branding.tagline || null,
        website_url: branding.website_url || null,
        support_email: branding.support_email || null,
      };

      const { error } = await supabase
        .from("branding_settings")
        .upsert(brandingData, { onConflict: "user_id" });

      if (error) throw error;

      toast({
        title: "Branding Saved",
        description: "Your client portal branding has been updated",
      });
    } catch (error: any) {
      console.error("Error saving branding:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save branding settings",
        variant: "destructive",
      });
    } finally {
      setSavingBranding(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences(data);
      } else {
        const { data: newPrefs, error: insertError } = await supabase
          .from("notification_preferences")
          .insert({ user_id: user.id, ...defaultPreferences })
          .select()
          .single();

        if (insertError) throw insertError;
        if (newPrefs) setPreferences(newPrefs);
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
      toast({
        title: "Error",
        description: "Failed to load notification preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    setSaving(true);
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notification_preferences")
        .update({ [key]: value })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Notification preference updated",
      });
    } catch (error) {
      console.error("Error updating preference:", error);
      setPreferences(preferences);
      toast({
        title: "Error",
        description: "Failed to update preference",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image must be less than 2MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `avatar.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Add cache buster to URL
      const avatarUrlWithCache = `${publicUrl}?t=${Date.now()}`;

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: avatarUrlWithCache },
      });

      if (updateError) throw updateError;

      setAvatarUrl(avatarUrlWithCache);

      toast({
        title: "Avatar Updated",
        description: "Your profile picture has been updated",
      });
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload avatar",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;

    setUploadingAvatar(true);

    try {
      // List files in user's folder
      const { data: files } = await supabase.storage
        .from("avatars")
        .list(user.id);

      // Delete all files in user's folder
      if (files && files.length > 0) {
        const filePaths = files.map(f => `${user.id}/${f.name}`);
        await supabase.storage.from("avatars").remove(filePaths);
      }

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: null },
      });

      if (updateError) throw updateError;

      setAvatarUrl(null);

      toast({
        title: "Avatar Removed",
        description: "Your profile picture has been removed",
      });
    } catch (error: any) {
      console.error("Error removing avatar:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove avatar",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");

      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully",
      });
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast({
        title: "Error",
        description: "Please type DELETE to confirm",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("delete-account", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to delete account");
      }

      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted",
      });

      await supabase.auth.signOut();
      navigate("/");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteConfirmation("");
    }
  };

  const getUserInitials = () => {
    if (fullName) {
      return fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const notificationOptions = [
    {
      key: "proposal_viewed" as const,
      label: "Proposal Viewed",
      description: "Get notified when a client views your proposal",
      icon: Eye,
    },
    {
      key: "proposal_approved" as const,
      label: "Proposal Approved",
      description: "Get notified when a client approves your proposal",
      icon: CheckCircle,
    },
    {
      key: "proposal_rejected" as const,
      label: "Proposal Rejected",
      description: "Get notified when a client rejects your proposal",
      icon: XCircle,
    },
    {
      key: "contract_renewal" as const,
      label: "Contract Renewal",
      description: "Get reminded about upcoming contract renewals",
      icon: Calendar,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Settings"
        description="Manage your account and notification preferences"
      />

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle>Profile Settings</CardTitle>
          </div>
          <CardDescription>
            Update your personal information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                JPG, PNG or GIF. Max 2MB.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="pl-10 bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <CardTitle>Change Password</CardTitle>
          </div>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

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
          </form>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Notification Preferences</CardTitle>
          </div>
          <CardDescription>
            Choose which notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {notificationOptions.map((option) => (
            <div
              key={option.key}
              className="flex items-center justify-between space-x-4 py-3 border-b border-border last:border-0"
            >
              <div className="flex items-start gap-3">
                <option.icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor={option.key} className="text-base font-medium">
                    {option.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </div>
              <Switch
                id={option.key}
                checked={preferences[option.key]}
                onCheckedChange={(checked) => updatePreference(option.key, checked)}
                disabled={saving}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium text-foreground">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Delete Account
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <p>
                      This action is <strong>permanent and irreversible</strong>. All your data will be deleted, including:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>All clients and their information</li>
                      <li>All projects and proposals</li>
                      <li>All contracts and documents</li>
                      <li>Your account and profile data</li>
                    </ul>
                    <div className="pt-2">
                      <Label htmlFor="deleteConfirm" className="text-foreground">
                        Type <strong>DELETE</strong> to confirm:
                      </Label>
                      <Input
                        id="deleteConfirm"
                        type="text"
                        placeholder="DELETE"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>
                    Cancel
                  </AlertDialogCancel>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmation !== "DELETE" || deleting}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete My Account"
                    )}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
