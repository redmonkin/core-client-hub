import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
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
import { useWorkspaceUser } from "@/hooks/useWorkspaceUser";
import { PASSWORD_HINT, checkNewPassword } from "@/lib/password-policy";
import { CAPTCHA_ENABLED, CAPTCHA_ERROR, CAPTCHA_FAILED_MESSAGE, CAPTCHA_PENDING_MESSAGE, Captcha, type CaptchaHandle } from "@/components/auth/Captcha";
import { Loader2, User, Building2, Phone, Briefcase, Mail, Upload, Trash2, Camera, CheckCircle2, Circle, Link, Copy, Lock, Bell, Eye, CheckCircle, XCircle, Calendar, AlertTriangle } from "lucide-react";

interface NotificationPreferences {
  id?: string;
  proposal_viewed: boolean;
  proposal_approved: boolean;
  proposal_rejected: boolean;
  contract_renewal: boolean;
  comment_added: boolean;
  task_assigned: boolean;
  task_completed: boolean;
}

const defaultPreferences: NotificationPreferences = {
  proposal_viewed: true,
  proposal_approved: true,
  proposal_rejected: true,
  contract_renewal: true,
  comment_added: true,
  task_assigned: true,
  task_completed: true,
};

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspaceUserId } = useWorkspaceUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Profile state
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [portfolioSlug, setPortfolioSlug] = useState<string>("");

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordCaptcha, setPasswordCaptcha] = useState<string | null>(null);
  const passwordCaptchaRef = useRef<CaptchaHandle>(null);

  // Notification state
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPref, setSavingPref] = useState(false);

  // Delete account state
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || "");
      setCompany(user.user_metadata?.company || "");
      setJobTitle(user.user_metadata?.job_title || "");
      setPhone(user.user_metadata?.phone || "");
      setBio(user.user_metadata?.bio || "");
      setAvatarUrl(user.user_metadata?.avatar_url || null);
      setLoading(false);
      fetchPreferences();
    }
  }, [user]);

  useEffect(() => {
    if (!workspaceUserId) return;
    (async () => {
      const { data } = await supabase
        .from("branding_settings")
        .select("slug" as any)
        .eq("user_id", workspaceUserId)
        .maybeSingle();
      setPortfolioSlug(((data as any)?.slug as string) || "");
    })();
  }, [workspaceUserId]);

  const fetchPreferences = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences(data);
      } else {
        const { data: newPrefs, error: insertError } = await supabase
          .from("notification_preferences")
          .insert({ user_id: currentUser.id, ...defaultPreferences })
          .select()
          .single();

        if (insertError) throw insertError;
        if (newPrefs) setPreferences(newPrefs);
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setLoadingPrefs(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    setSavingPref(true);
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { error } = await supabase
        .from("notification_preferences")
        .update({ [key]: value })
        .eq("user_id", currentUser.id);

      if (error) throw error;

      toast({ title: "Saved", description: "Notification preference updated" });
    } catch (error) {
      console.error("Error updating preference:", error);
      setPreferences(preferences);
      toast({ title: "Error", description: "Failed to update preference", variant: "destructive" });
    } finally {
      setSavingPref(false);
    }
  };

  const profileFields = useMemo(() => [
    { key: 'avatar', label: 'Profile Photo', filled: !!avatarUrl },
    { key: 'fullName', label: 'Full Name', filled: !!fullName.trim() },
    { key: 'company', label: 'Company', filled: !!company.trim() },
    { key: 'jobTitle', label: 'Job Title', filled: !!jobTitle.trim() },
    { key: 'phone', label: 'Phone Number', filled: !!phone.trim() },
    { key: 'bio', label: 'Bio', filled: !!bio.trim() },
  ], [avatarUrl, fullName, company, jobTitle, phone, bio]);

  const completedFields = profileFields.filter(f => f.filled).length;
  const totalFields = profileFields.length;
  const completionPercentage = Math.round((completedFields / totalFields) * 100);

  const getCompletionColor = () => {
    if (completionPercentage >= 100) return "text-green-600";
    if (completionPercentage >= 60) return "text-amber-600";
    return "text-muted-foreground";
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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `avatar.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrlWithCache = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: avatarUrlWithCache },
      });

      if (updateError) throw updateError;

      setAvatarUrl(avatarUrlWithCache);

      toast({ title: "Avatar Updated", description: "Your profile picture has been updated" });
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast({ title: "Error", description: error.message || "Failed to upload avatar", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;

    setUploadingAvatar(true);

    try {
      const { data: files } = await supabase.storage
        .from("avatars")
        .list(user.id);

      if (files && files.length > 0) {
        const filePaths = files.map(f => `${user.id}/${f.name}`);
        await supabase.storage.from("avatars").remove(filePaths);
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: null },
      });

      if (updateError) throw updateError;

      setAvatarUrl(null);

      toast({ title: "Avatar Removed", description: "Your profile picture has been removed" });
    } catch (error: any) {
      console.error("Error removing avatar:", error);
      toast({ title: "Error", description: error.message || "Failed to remove avatar", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          company,
          job_title: jobTitle,
          phone,
          bio,
        },
      });

      if (error) throw error;

      toast({ title: "Profile Updated", description: "Your profile has been saved successfully" });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({ title: "Error", description: error.message || "Failed to update profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }

    if (!user?.email) return;

    if (CAPTCHA_ENABLED && !passwordCaptcha) {
      toast({ title: "Error", description: CAPTCHA_PENDING_MESSAGE, variant: "destructive" });
      return;
    }

    setSavingPassword(true);

    try {
      const passwordError = await checkNewPassword(newPassword);
      if (passwordError) {
        toast({ title: "Error", description: passwordError, variant: "destructive" });
        return;
      }

      // Confirm it's really the account holder (not someone at an unlocked
      // computer) by checking the current password first.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
        options: { captchaToken: passwordCaptcha ?? undefined },
      });
      if (verifyError) {
        const description = CAPTCHA_ERROR.test(verifyError.message) ? CAPTCHA_FAILED_MESSAGE : "Your current password is incorrect";
        toast({ title: "Error", description, variant: "destructive" });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      toast({ title: "Password Updated", description: "Your password has been changed successfully" });
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast({ title: "Error", description: error.message || "Failed to update password", variant: "destructive" });
    } finally {
      passwordCaptchaRef.current?.reset();
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast({ title: "Error", description: "Please type DELETE to confirm", variant: "destructive" });
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

      toast({ title: "Account Deleted", description: "Your account has been permanently deleted" });

      await supabase.auth.signOut();
      navigate("/");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast({ title: "Error", description: error.message || "Failed to delete account", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteConfirmation("");
    }
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
    {
      key: "comment_added" as const,
      label: "New Comment",
      description: "Get notified when a client comments on a proposal, contract, or invoice",
      icon: Bell,
    },
    {
      key: "task_assigned" as const,
      label: "Task Assigned",
      description: "Get notified when a timesheet task is assigned to you",
      icon: CheckCircle2,
    },
    {
      key: "task_completed" as const,
      label: "Task Completed",
      description: "Get notified when a team member completes an assigned task",
      icon: CheckCircle,
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
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Profile"
        description="Manage your personal profile, security, and notification preferences"
      />

      {/* Profile Completeness */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Profile Completeness</CardTitle>
              <CardDescription>
                Complete your profile to help others know more about you
              </CardDescription>
            </div>
            <span className={`text-2xl font-bold ${getCompletionColor()}`}>
              {completionPercentage}%
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={completionPercentage} className="h-2" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {profileFields.map((field) => (
              <div
                key={field.key}
                className={`flex items-center gap-1.5 text-xs ${
                  field.filled ? 'text-green-600' : 'text-muted-foreground'
                }`}
              >
                {field.filled ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{field.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-1">
          <CardHeader className="text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <Avatar className="h-32 w-32">
                  <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                  <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="h-8 w-8 text-foreground" />
                </button>
              </div>
              <div>
                <CardTitle className="text-xl">{fullName || "Your Name"}</CardTitle>
                <CardDescription>{user?.email}</CardDescription>
                {jobTitle && company && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {jobTitle} at {company}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload Photo
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
            <p className="text-xs text-muted-foreground text-center">
              JPG, PNG or GIF. Max 2MB.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* Edit Profile Form */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Edit Profile</CardTitle>
            </div>
            <CardDescription>
              Update your personal and professional information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Company
                  </Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Enter your company name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jobTitle" className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    Job Title
                  </Label>
                  <Input
                    id="jobTitle"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Enter your job title"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us a little about yourself..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Brief description for your profile.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Change Password */}
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
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
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
            <Captcha ref={passwordCaptchaRef} onToken={setPasswordCaptcha} />
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
                disabled={savingPref}
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
